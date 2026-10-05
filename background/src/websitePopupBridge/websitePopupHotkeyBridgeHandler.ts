/** Background authority for popup Hotkey validation and capture tab ownership. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { extractSnippetIdFromCompoundId } from '../../../src/shared-components/utils/idGenerator';
import { getAllUserHotkeys } from '../../../src/shared-components/hotkeys/core/hotkeyDbData';
import { normalizeHotkeyString } from '../../../src/shared-components/hotkeys/core/eventParser';
import { getHotkeyReservation } from '../../../src/shared-components/hotkeys/core/reservedHotkeys';
import { saveHotkey } from '../../../src/shared-components/hotkeys/core/hotkeyManager';
import { getWebsitePopupCreatedEntityReferenceId } from './websitePopupCreatedEntityReference';
import type { WebsitePopupBaseCreateEntity } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import {
  isWebsitePopupHotkeyBridgeRequest,
  type WebsitePopupHotkeyBridgeResponse,
  type WebsitePopupHotkeyCheck,
  type WebsitePopupHotkeyConflict,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';

type HotkeyBridgeSendResponse = (response: WebsitePopupHotkeyBridgeResponse) => void;
type ActiveCapture = { token: string; expiresAt: number };
const activeCapturesByTab = new Map<number, ActiveCapture>();
const CAPTURE_LEASE_MS = 5 * 60 * 1000;
const HOTKEY_USER_ID = 'local_user';

const normalize = (value: string) => normalizeHotkeyString(value).replace(/\s+/g, '').toLowerCase();

const getChromeCommands = () => new Promise<chrome.commands.Command[]>((resolve, reject) => {
  try {
    chrome.commands.getAll(commands => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || 'Unable to inspect extension commands.'));
      else resolve(commands || []);
    });
  } catch (error) {
    reject(error);
  }
});

const getOwnerLabel = async (referenceId: string, referenceType: string): Promise<string> => {
  const type = referenceType.toLowerCase();
  const rawId = extractSnippetIdFromCompoundId(referenceId);
  const ids = [...new Set([rawId, referenceId])].filter(Boolean);
  for (const id of ids) {
    if (type === 'webcollection') { const item = await db.collections.get(referenceId); if (item) return item.name; }
    if (type === 'note') { const item = await db.notes.get(id); if (item) return item.title; }
    if (type === 'link') { const item = await db.links.get(id); if (item) return item.title; }
    if (type === 'snippet') { const item = await db.snippets.get(id); if (item) return item.title; }
    if (type === 'todo') { const item = await db.todos.get(id); if (item) return item.name; }
    if (type === 'agent') { const item = await db.chatAgents.get(id); if (item) return item.title; }
    if (type === 'prompt' || type === 'aiprompt') { const item = await db.aiPrompts.get(id); if (item) return item.title; }
    if (type === 'session' || type === 'collection') {
      const item = await db.workspaceSessions.get(id) || await db.workspaceViews.get(id);
      if (item) return item.title;
    }
    if (type === 'command') { const item = await db.commands.get(id); if (item) return item.label; }
    if (type === 'bookmark') { const item = await db.workspaceViews.get(id); if (item) return item.title; }
  }
  return referenceId;
};

export async function checkWebsitePopupHotkey(
  rawValue: string,
  currentReferenceId?: string,
): Promise<WebsitePopupHotkeyCheck> {
  const value = normalizeHotkeyString(rawValue);
  if (!value) return { status: 'error', value, message: 'Capture a Hotkey first.' };
  const parts = value.split('+');
  if (parts.length < 2 || !parts.some(part => part === 'Ctrl' || part === 'Alt' || part === 'Meta')
    || !parts[parts.length - 1] || ['Ctrl', 'Alt', 'Shift', 'Meta'].includes(parts[parts.length - 1])) {
    return { status: 'error', value, message: 'Capture a key combination with a modifier.' };
  }
  const commands = await getChromeCommands();
  const reservation = getHotkeyReservation(value, commands);
  if (reservation) return { status: 'error', value, message: reservation.errorMessage, conflictId: reservation.conflictId };

  const records = await getAllUserHotkeys(HOTKEY_USER_ID);
  const collisions = records.filter(record => normalize(record.combination) === normalize(value)
    && record.referenceId !== currentReferenceId);
  if (collisions.length === 0) return { status: 'available', value };
  if (collisions.length > 1) {
    return { status: 'error', value, message: 'Several items use this Hotkey. Resolve the duplicate assignments first.' };
  }

  const assignment = collisions[0];
  const label = await getOwnerLabel(assignment.referenceId, assignment.referenceType);
  const conflict: WebsitePopupHotkeyConflict = {
    id: assignment.id,
    referenceId: assignment.referenceId,
    referenceType: assignment.referenceType,
    label,
  };
  if (assignment.referenceType === 'command') {
    return { status: 'error', value, message: `Hotkey "${value}" is reserved by "${label}".` };
  }
  return {
    status: 'conflict', value, conflict,
    message: `Hotkey "${value}" is already assigned to "${label}".`,
  };
}

const loadCreatedHotkeyTarget = async (entity: WebsitePopupBaseCreateEntity, id: string) => {
  switch (entity) {
    case 'note': return db.notes.get(id);
    case 'link': return db.links.get(id);
    case 'todo': return db.todos.get(id);
    case 'snippet': return db.snippets.get(id);
    case 'agent': return db.aiPrompts.get(id);
  }
};

export async function assignWebsitePopupCreatedHotkey(
  entity: WebsitePopupBaseCreateEntity,
  entityId: string,
  value: string,
  approval?: WebsitePopupHotkeyConflict,
) {
  const record = await loadCreatedHotkeyTarget(entity, entityId);
  if (!record) throw new Error('The created item could not be found. Hotkey was not assigned.');
  const compoundId = getWebsitePopupCreatedEntityReferenceId(record);
  await assertWebsitePopupHotkeyAvailable(value, approval, compoundId);
  const normalized = normalizeHotkeyString(value);
  await saveHotkey(entityId, compoundId, normalized, entity === 'agent' ? 'aiPrompt' : entity, undefined, undefined, approval || null);
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.flatMap(tab => tab.id
    ? [chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'hotkeysMap' }).catch(() => undefined)]
    : []));
}

export async function assertWebsitePopupHotkeyAvailable(
  value: string,
  approval?: WebsitePopupHotkeyConflict,
  currentReferenceId?: string,
) {
  const currentCheck = await checkWebsitePopupHotkey(value, currentReferenceId);
  if (currentCheck.status === 'error') throw new Error(currentCheck.message);
  if (currentCheck.status === 'conflict') {
    const matchesApproval = approval
      && currentCheck.conflict.id === approval.id
      && currentCheck.conflict.referenceId === approval.referenceId
      && currentCheck.conflict.referenceType === approval.referenceType;
    if (!matchesApproval) throw new Error(`${currentCheck.message} Review and approve Overwrite again.`);
  }
  return currentCheck.value;
}

export function isWebsitePopupHotkeyCaptureActive(tabId: number): boolean {
  const capture = activeCapturesByTab.get(tabId);
  if (!capture) return false;
  if (capture.expiresAt <= Date.now()) {
    activeCapturesByTab.delete(tabId);
    return false;
  }
  return true;
}

export function clearWebsitePopupHotkeyCaptureForTab(tabId: number): void {
  activeCapturesByTab.delete(tabId);
}

export function handleWebsitePopupHotkeyBridgeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: HotkeyBridgeSendResponse,
): boolean {
  if (!isWebsitePopupHotkeyBridgeRequest(message)) return false;
  const tabId = sender.tab?.id;
  if (message.operation !== 'validate' && typeof tabId !== 'number') {
    sendResponse({ success: false, error: 'Hotkey capture requires an active website tab.' });
    return true;
  }
  if (message.operation === 'capture-start' || message.operation === 'capture-stop') {
    if (message.operation === 'capture-start') {
      activeCapturesByTab.set(tabId!, { token: message.token, expiresAt: Date.now() + CAPTURE_LEASE_MS });
      sendResponse({ success: true, capture: 'started', token: message.token });
    } else {
      const active = activeCapturesByTab.get(tabId!);
      if (active?.token === message.token) activeCapturesByTab.delete(tabId!);
      sendResponse({ success: true, capture: 'stopped', token: message.token });
    }
    return true;
  }
  if (message.operation !== 'validate') return false;
  void (async () => {
    try {
      let currentReferenceId: string | undefined;
      if (message.currentEntityId && message.currentEntityId !== 'new') {
        const records = await getAllUserHotkeys(HOTKEY_USER_ID);
        currentReferenceId = records.find(record => extractSnippetIdFromCompoundId(record.referenceId) === message.currentEntityId)?.referenceId;
      }
      const check = await checkWebsitePopupHotkey(message.value, currentReferenceId);
      sendResponse({ success: true, check });
    } catch (error: unknown) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
}

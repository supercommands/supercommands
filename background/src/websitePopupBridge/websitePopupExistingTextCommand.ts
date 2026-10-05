/** Background-owned Text Command edits for existing popup search results. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { requireWebCollectionAssignmentTarget } from '../../../src/allObjectFolder/src/createObject/collections/collectionAssignmentData';
import { getAllUserShortcuts, normalizeShortcutTrigger } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
import { saveShortcutGuarded } from '../../../src/shared-components/shortcuts/core/shortcutManager';
import { shortcutOwnersMatch } from '../../../src/shared-components/shortcuts/core/shortcutAssignmentTypes';
import { extractSnippetIdFromCompoundId } from '../../../src/shared-components/utils/idGenerator';
import type { WebsitePopupTextCommandTargetEntity } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupTextCommandConflict } from '../../../src/shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
import { checkWebsitePopupTextCommand } from './textCommandBridgeHandler';
import { getWebsitePopupCreatedEntityReferenceId } from './websitePopupCreatedEntityReference';

type EditableEntity = WebsitePopupTextCommandTargetEntity;

const getRecord = async (entity: EditableEntity, id: string) => {
  switch (entity) {
    case 'note': return db.notes.get(id);
    case 'link': return db.links.get(id);
    case 'todo': return db.todos.get(id);
    case 'snippet': return db.snippets.get(id);
    case 'agent': return db.chatAgents.get(id);
    case 'prompt': return db.aiPrompts.get(id);
    case 'collection': return db.workspaceSessions.get(id);
    case 'webCollection': return requireWebCollectionAssignmentTarget(id);
    case 'bookmark': return chrome.bookmarks.get(id).then(records => records[0]);
  }
};

const matchesEntity = (referenceType: string, entity: EditableEntity) =>
  referenceType === entity || (entity === 'prompt' && referenceType === 'aiPrompt')
  || (entity === 'collection' && referenceType === 'session');

export async function updateWebsitePopupExistingTextCommand(
  entity: EditableEntity,
  entityId: string,
  rawValue: string,
  approval?: WebsitePopupTextCommandConflict,
  expectedValue = '',
  expectedReferenceId = '',
): Promise<{ value: string; changedTable: string; referenceId: string }> {
  const record = await getRecord(entity, entityId);
  if (!record) throw new Error('This item is no longer available.');
  const shortcuts = await getAllUserShortcuts();
  const existing = shortcuts.filter(shortcut => matchesEntity(shortcut.referenceType, entity)
    && (shortcut.referenceId === entityId
      || extractSnippetIdFromCompoundId(shortcut.referenceId) === entityId));
  if (existing.length > 1) throw new Error('This item has multiple Text Commands. Resolve those assignments first.');
  const currentValue = normalizeShortcutTrigger(existing[0]?.trigger || '').replace(/^\/+/, '');
  if (currentValue !== normalizeShortcutTrigger(expectedValue).replace(/^\/+/, '')
    || (existing[0] && existing[0].referenceId !== expectedReferenceId)) {
    throw new Error('This item’s Text Command changed. Reopen the editor to review its current value.');
  }
  const referenceId = entity === 'webCollection' ? entityId : existing[0]?.referenceId
    || getWebsitePopupCreatedEntityReferenceId(record as { id: string; organisationId?: string;  });
  const value = normalizeShortcutTrigger(rawValue);
  if (value) {
    const check = await checkWebsitePopupTextCommand(value, referenceId);
    if (check.status === 'error') throw new Error(check.message);
    if (check.status === 'conflict' && !(approval && shortcutOwnersMatch(
      check.conflict.owners || [check.conflict], approval.owners || [approval])
      && (approval.mode !== 'add' || check.conflict.canShare))) {
      throw new Error(`${check.message} Review and approve Overwrite again.`);
    }
  }
  await saveShortcutGuarded(referenceId, value, entity === 'prompt' ? 'aiPrompt' : entity, approval);
  const changedTable = entity === 'prompt' ? 'aiPrompts' : entity === 'agent' ? 'chatAgents'
    : entity === 'webCollection' ? 'collections' : entity === 'collection' ? 'workspaces' : entity === 'bookmark' ? 'bookmarks'
    : entity === 'todo' ? 'todos' : `${entity}s`;
  if (entity === 'note') await db.notes.update(entityId, { shortcut: value });
  if (entity === 'link') await db.links.update(entityId, { shortcut: value });
  if (entity === 'todo') await db.todos.update(entityId, { shortcut: value });
  if (entity === 'snippet') await db.snippets.update(entityId, { shortcut: value });
  return { value, changedTable, referenceId };
}

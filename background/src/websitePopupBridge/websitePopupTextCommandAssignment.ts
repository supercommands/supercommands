/** Background-only guarded assignment for popup Create text commands. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { getItemCompoundId } from '../../../src/shared-components/utils/idGenerator';
import { saveShortcutGuarded } from '../../../src/shared-components/shortcuts/core/shortcutManager';
import { shortcutOwnersMatch } from '../../../src/shared-components/shortcuts/core/shortcutAssignmentTypes';
import { normalizeShortcutTrigger } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
import type { WebsitePopupBaseCreateEntity } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupTextCommandConflict } from '../../../src/shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
import { checkWebsitePopupTextCommand } from './textCommandBridgeHandler';

const getRecord = async (entity: WebsitePopupBaseCreateEntity, id: string) => {
  switch (entity) {
    case 'note': return db.notes.get(id);
    case 'link': return db.links.get(id);
    case 'todo': return db.todos.get(id);
    case 'snippet': return db.snippets.get(id);
    case 'agent': return db.aiPrompts.get(id);
  }
};

const matchesApproval = (
  current: WebsitePopupTextCommandConflict,
  approved: WebsitePopupTextCommandConflict | undefined,
) => Boolean(approved && shortcutOwnersMatch(current.owners || [current], approved.owners || [approved])
  && (approved.mode !== 'add' || current.canShare));

export async function assertWebsitePopupTextCommandAvailable(
  value: string,
  approval?: WebsitePopupTextCommandConflict,
  currentReferenceId?: string,
) {
  const check = await checkWebsitePopupTextCommand(value, currentReferenceId);
  if (check.status === 'error') throw new Error(check.message);
  if (check.status === 'conflict' && !matchesApproval(check.conflict, approval)) {
    throw new Error(`${check.message} Review and approve Overwrite again.`);
  }
  return check.value;
}

export async function assignWebsitePopupCreatedTextCommand(
  entity: WebsitePopupBaseCreateEntity,
  entityId: string,
  rawValue: string,
  approval?: WebsitePopupTextCommandConflict,
) {
  const record = await getRecord(entity, entityId);
  if (!record) throw new Error('The created item could not be found. Text Command was not assigned.');
  const referenceId = getItemCompoundId(record);
  const value = normalizeShortcutTrigger(rawValue);
  await assertWebsitePopupTextCommandAvailable(value, approval, referenceId);
  await saveShortcutGuarded(referenceId, value, entity === 'agent' ? 'aiPrompt' : entity, approval);
  // Keep the entity's existing shortcut field synchronized with the central assignment.
  switch (entity) {
    case 'note': await db.notes.update(entityId, { shortcut: value }); break;
    case 'link': await db.links.update(entityId, { shortcut: value }); break;
    case 'todo': await db.todos.update(entityId, { shortcut: value }); break;
    case 'snippet': await db.snippets.update(entityId, { shortcut: value }); break;
    case 'agent': break;
  }
}

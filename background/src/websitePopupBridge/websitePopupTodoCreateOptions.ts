/** Validates popup Todo selections and preserves the Anytime alarm choice for the shared creator. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { parseDueDateInput } from '../../../src/allObjectFolder/src/createObject/todos/utils/dueDateParser';
import type { TodoReference } from '../../../src/allObjectFolder/src/createObject/todos/todoTypes';
import type { WebsitePopupBaseCreateDraft } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES } from '../../../src/shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';

const allowedReferenceTypes = new Set<string>(WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES.map(category => category.type));

async function resolveTodoReferences(draft: WebsitePopupBaseCreateDraft): Promise<TodoReference[]> {
  const selections = draft.selectedValuesByField?.reference || [];
  if (String(draft.fieldValues.reference || '').trim() && selections.length === 0) {
    throw new Error('Choose Attach items from the saved-item results.');
  }
  const seen = new Set<string>();
  const references: TodoReference[] = [];
  for (const selection of selections) {
    const type = selection.referenceType;
    const id = String(selection.targetId || '').trim();
    if (selection.kind !== 'reference' || !type || !allowedReferenceTypes.has(type) || !id) {
      throw new Error('An attachment is invalid. Remove it and select it again.');
    }
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const record = type === 'note' ? await db.notes.get(id)
      : type === 'link' ? await db.links.get(id)
      : type === 'aiPrompt' ? await db.aiPrompts.get(id)
      : await db.chatAgents.get(id);
    if (!record || ('deletedAt' in record && record.deletedAt != null)) {
      throw new Error(`The attachment "${selection.label}" is no longer available.`);
    }
    references.push({ type, id, name: 'label' in record ? String(record.label) : String(record.title) });
  }
  return references;
}

export async function resolveWebsitePopupTodoCreateOptions(draft: WebsitePopupBaseCreateDraft) {
  const recurring = String(draft.fieldValues.recurring || '').trim().toLowerCase();
  if (recurring && !['one-time', 'daily', 'weekly', 'monthly'].includes(recurring)) {
    throw new Error('Choose a valid Recurring option.');
  }
  const time = String(draft.fieldValues.time || '').trim();
  let scheduleTime = Date.now();
  let isAnytime = !time;
  if (time) {
    const parsed = parseDueDateInput(time);
    if (!parsed.valid) throw new Error('Choose a valid future Time option.');
    isAnytime = parsed.value.time === null;
    const [year, month, day] = parsed.value.date.split('-').map(Number);
    const [hour, minute] = (parsed.value.time || '09:00').split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year
      || date.getMonth() !== month - 1 || date.getDate() !== day
      || date.getHours() !== hour || date.getMinutes() !== minute) {
      throw new Error('The selected Time is invalid in the current timezone.');
    }
    // Date-only "Today" means anytime today, not a past 09:00 alarm.
    scheduleTime = !parsed.value.time && date.getTime() <= Date.now()
      ? Date.now()
      : date.getTime();
  }
  const references = await resolveTodoReferences(draft);
  return {
    references,
    scheduleType: recurring && recurring !== 'one-time' ? 'recurring' as const : 'one-time' as const,
    recurringCycle: recurring && recurring !== 'one-time' ? recurring : undefined,
    scheduleTime,
    isAnytime,
  };
}

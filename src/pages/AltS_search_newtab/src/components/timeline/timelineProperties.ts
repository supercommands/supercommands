import { getCollectionItem, updateCollectionItem } from '../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import { saveUserHotkeyGuarded, deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { updateNote, deleteNote } from '../../../../../allObjectFolder/src/createObject/notes/noteData';
import { updateLink, deleteLink } from '../../../../../allObjectFolder/src/createObject/links/linkData';
import { updateTodoContent, deleteTodo } from '../../../../../allObjectFolder/src/createObject/todos/todoData';
import { updateSnippet, deleteSnippet } from '../../../../../allObjectFolder/src/createObject/snippets/snippetData';
import { updateAiPrompt, deleteAiPrompt } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { db, deleteItemAssociations } from '../../../../../storage/indexDB/dbConfig';
import { saveShortcutGuarded } from '../../../../../shared-components/shortcuts/core/shortcutManager';
import { resolveShortcutItem } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import { saveHotkey, clearHotkey } from '../../../../../shared-components/hotkeys/core/hotkeyManager';
import type { TimelineItem } from './timelineData';

export type TimelineEditorKind = 'note' | 'link' | 'todo' | 'snippet' | 'aiPrompt';

export const isTimelineEditorItem = (item: TimelineItem): item is TimelineItem & { kind: TimelineEditorKind } =>
    item.kind === 'note' || item.kind === 'link' || item.kind === 'todo' || item.kind === 'snippet' || item.kind === 'aiPrompt';

export const canEditTimelineAssignment = (item: TimelineItem) => isTimelineEditorItem(item) || item.kind === 'collection';
export const canEditTimelineTags = (item: TimelineItem) => isTimelineEditorItem(item) || item.kind === 'collectionItem';

export async function saveTimelineCommand(item: TimelineItem, value: string): Promise<void> {
    if (!canEditTimelineAssignment(item)) throw new Error('This item does not support command assignment.');
    const command = value.trim().toLowerCase();
    const target = await resolveShortcutItem(item.id);
    await saveShortcutGuarded(target.referenceId, command, target.referenceType);
}

export async function saveTimelineHotkey(item: TimelineItem, value: string, conflictId?: string, referenceId = item.id): Promise<void> {
    if (!canEditTimelineAssignment(item)) throw new Error('This item does not support hotkey assignment.');
    const hotkey = value.trim();
    if (hotkey) {
        const conflict = conflictId ? await db.userHotkeys.where('referenceId').equals(conflictId).first() : undefined;
        if (conflictId && !conflict) throw new Error('This Hotkey changed owners. Validate and approve Overwrite again.');
        const approval = conflict ? { id: conflict.id, referenceId: conflict.referenceId, referenceType: conflict.referenceType } : null;
        if (item.kind === 'collection') await saveUserHotkeyGuarded(hotkey, item.id, 'webCollection', approval);
        else if (isTimelineEditorItem(item)) await saveHotkey(item.id, referenceId, hotkey, item.kind, undefined, undefined, approval);
    }
    else if (item.kind === 'collection') await deleteUserHotkeyByReference(item.id);
    else if (isTimelineEditorItem(item)) await clearHotkey(item.id, referenceId, item.kind);
    if (item.kind === 'collection' && typeof chrome !== 'undefined') {
        void chrome.runtime?.sendMessage({ action: 'INVALIDATE_HOTKEYS_CACHE' }).catch(() => {});
    }
}

export async function saveTimelineTags(item: TimelineItem, tagIds: string[]): Promise<void> {
    if (!canEditTimelineTags(item)) throw new Error('This item does not support tags.');
    switch (item.kind) {
        case 'collectionItem': {
            const current = await getCollectionItem(item.organisationId, item.id);
            await updateCollectionItem(item.organisationId, item.id, { type: current.type, tagIds, expectedUpdatedAt: current.updatedAt });
            break;
        }
        case 'note': await updateNote(item.id, { tagIds }); break;
        case 'link': await updateLink(item.id, { tagIds }); break;
        case 'todo': await updateTodoContent(item.id, { tagIds, tags: tagIds }); break;
        case 'snippet': await updateSnippet(item.id, { tagIds }); break;
        case 'aiPrompt': await updateAiPrompt(item.id, { tagIds }); break;
    }
}

export async function deleteTimelineEditorItem(item: TimelineItem & { kind: TimelineEditorKind }): Promise<void> {
    // Notes, Links, and Chat Agents already clean associations in their delete API.
    // Todo and Text Expander delete APIs do not, so remove their linked properties first.
    switch (item.kind) {
        case 'note': await deleteNote(item.id); break;
        case 'link': await deleteLink(item.id); break;
        case 'todo': await deleteTodo(item.id); await deleteItemAssociations(item.id); break;
        case 'snippet': await deleteSnippet(item.id); await deleteItemAssociations(item.id); break;
        case 'aiPrompt': await deleteAiPrompt(item.id); break;
    }
}

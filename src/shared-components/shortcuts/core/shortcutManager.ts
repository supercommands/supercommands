import { saveUserShortcut, saveUserShortcutGuarded, deleteUserShortcutByReference } from './shortcutDbData';
import { normalizeShortcutTrigger, resolveShortcutItem } from './shortcutDbData';
import type { ShortcutOverwriteApproval } from './shortcutDbData';
import type { ShortcutReferenceType } from './shortcutDbTypes';
export type ShortcutItemType = 'link' | 'note' | 'snippet' | 'automation' | 'module' | 'command' | 'collection' | 'aiPrompt' | 'todo' | 'agent';
export type StorageMode = 'local' | 'cloud';
export async function resolveShortcutAssignmentChoice(itemId: string, value: string, approval: ShortcutOverwriteApproval) {
    const target = await resolveShortcutItem(itemId);
    await saveShortcutGuarded(target.referenceId, value, target.referenceType, approval);
}
export async function saveShortcut(snippetId: any, compoundId: string, shortcut: string, itemName: string, itemType: ShortcutItemType = 'note', _storageMode?: any, _skipCloud?: any) {
    const normalizedShortcut = normalizeShortcutTrigger(shortcut);
    if (normalizedShortcut) {
        await saveUserShortcut(normalizedShortcut, compoundId, itemType as any);
    }
    else {
        await deleteUserShortcutByReference(compoundId);
    }
    return null;
}
export async function saveShortcutGuarded(referenceId: string, shortcut: string, itemType: ShortcutReferenceType, approval?: ShortcutOverwriteApproval) {
    const saved = await saveUserShortcutGuarded(shortcut, referenceId, itemType, approval);
    return saved;
}
/**
 * Universally clears a shortcut from IndexedDB.
 */
export async function clearShortcut(snippetId: any, compoundId: string, itemType: ShortcutItemType = 'note', _storageMode?: any, _skipCloud?: any) {
    await deleteUserShortcutByReference(compoundId);
}

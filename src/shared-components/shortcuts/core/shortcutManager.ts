import { saveUserShortcut, deleteUserShortcutByReference } from './shortcutDbData';
import { normalizeShortcutTrigger } from './shortcutDbData';

export type ShortcutItemType = 'link' | 'note' | 'snippet' | 'automation' | 'module' | 'command' | 'collection' | 'aiPrompt' | 'todo';
export type StorageMode = 'local' | 'cloud';

function invalidateBackgroundCache() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'INVALIDATE_SHORTCUTS_CACHE' }).catch(() => {});
  }
}

export async function saveShortcut(
  snippetId: any,
  compoundId: string,
  shortcut: string,
  itemName: string,
  itemType: ShortcutItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  const normalizedShortcut = normalizeShortcutTrigger(shortcut);

  if (normalizedShortcut) {
    await saveUserShortcut(normalizedShortcut, compoundId, itemType as any);
  } else {
    await deleteUserShortcutByReference(compoundId);
  }
  
  invalidateBackgroundCache();
  return null;
}

/**
 * Universally clears a shortcut from IndexedDB.
 */
export async function clearShortcut(
  snippetId: any,
  compoundId: string,
  itemType: ShortcutItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  await deleteUserShortcutByReference(compoundId);
  invalidateBackgroundCache();
}

import { saveUserHotkey, deleteUserHotkeyByReference } from './hotkeyDbData';

export type HotkeyItemType = 'note' | 'command' | 'link' | 'automation' | 'module' | 'snippet' | 'collection' | 'todo';
export type StorageMode = 'local' | 'cloud';


function invalidateBackgroundCache() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'INVALIDATE_HOTKEYS_CACHE' }).catch(() => {});
  }
}

export async function saveHotkey(
  _snippetId: any,
  compoundId: string,
  hotkey: string,
  itemType: HotkeyItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  if (hotkey) {
    await saveUserHotkey(hotkey, compoundId, itemType as any);
  } else {
    await deleteUserHotkeyByReference(compoundId);
  }
  invalidateBackgroundCache();
  return null;
}

/**
 * Universally clears a hotkey from IndexedDB.
 */
export async function clearHotkey(
  _snippetId: any,
  compoundId: string,
  itemType: HotkeyItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  await deleteUserHotkeyByReference(compoundId);
  invalidateBackgroundCache();
}

import { saveUserShortcut, deleteUserShortcutByReference } from './shortcutDbData';
import { extractSnippetIdFromCompoundId } from '../../hotkeys/utils/hotkeyUtils';
import { normalizeShortcutTrigger } from './shortcutDbData';

export type ShortcutItemType = 'link' | 'note' | 'snippet' | 'automation' | 'module' | 'command' | 'session' | 'aiPrompt' | 'todo';
export type StorageMode = 'local' | 'cloud';

const syncShortcutToChromeStorage = async (snippetId: string, compoundId: string, shortcut: string | null, itemType: string) => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return;

  const storageKey =
    itemType === 'link'
      ? 'link_commands'
      : itemType === 'session'
        ? 'session_commands'
        : itemType === 'todo'
          ? 'todo_commands'
          : 'note_commands';
  const legacyKeysToClear = itemType === 'session' ? ['note_commands'] : [];

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get([storageKey, ...legacyKeysToClear], (res: any) => {
      const map = res[storageKey] || {};
      if (shortcut) {
        const entry = map[compoundId] || {};
        entry.shortcut = shortcut;
        entry.snippetId = snippetId || extractSnippetIdFromCompoundId(compoundId) || compoundId;
        map[compoundId] = entry;
      } else {
        delete map[compoundId];
      }

      const updates: Record<string, any> = { [storageKey]: map };
      for (const legacyKey of legacyKeysToClear) {
        const legacyMap = { ...(res[legacyKey] || {}) };
        delete legacyMap[compoundId];
        updates[legacyKey] = legacyMap;
      }

      chromeAny.storage.local.set(updates, () => resolve());
    });
  });
};

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
  
  await syncShortcutToChromeStorage(snippetId, compoundId, normalizedShortcut || null, itemType);
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
  await syncShortcutToChromeStorage(snippetId, compoundId, null, itemType);
}

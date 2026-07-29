import { db } from '../../storage/indexDB/dbConfig';

const syncShortcutMigrationToChromeStorage = async (oldId: string, newId: string, itemType: string) => {
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

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get([storageKey], (res: any) => {
      const map = res[storageKey] || {};
      const existingEntry = map[oldId];
      if (existingEntry) {
        map[newId] = { ...existingEntry, snippetId: newId };
        delete map[oldId];
        chromeAny.storage.local.set({ [storageKey]: map }, () => resolve());
      } else {
        resolve();
      }
    });
  });
};

function invalidateBackgroundCache() {
  if (typeof chrome !== 'undefined' && (chrome as any).runtime?.sendMessage) {
    (chrome as any).runtime.sendMessage({ action: 'INVALIDATE_HOTKEYS_CACHE' }).catch(() => {});
  }
}

export async function migrateItemCompoundId(oldId: string, newId: string, itemType: string = 'note') {
  if (!oldId || !newId || oldId === newId) return;

  try {
    // 1. Migrate User Shortcuts
    const oldShortcuts = await db.userShortcuts.where('referenceId').equals(oldId).toArray();
    for (const sc of oldShortcuts) {
      await db.userShortcuts.put({
        ...sc,
        referenceId: newId,
        updatedAt: Date.now(),
      });
    }

    // 2. Migrate User Hotkeys
    const oldHotkeys = await db.userHotkeys.where('referenceId').equals(oldId).toArray();
    for (const hk of oldHotkeys) {
      await db.userHotkeys.put({
        ...hk,
        referenceId: newId,
        updatedAt: Date.now(),
      });
    }

    // 3. Migrate Chrome Storage
    await syncShortcutMigrationToChromeStorage(oldId, newId, itemType);

    // 4. Invalidate Cache
    invalidateBackgroundCache();
    
    // Dispatch storage event to trigger zustand updates in other tabs / components
    window.dispatchEvent(new Event('storage'));
  } catch (error) {
    console.error('[migrateItemCompoundId] Failed to migrate metadata:', error);
  }
}

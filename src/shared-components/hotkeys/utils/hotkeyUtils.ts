import { useDbStore } from '../../../storage/store/useDbStore';
import { getAllUserHotkeys } from '../core/hotkeyDbData';
import { getAllUserShortcuts, normalizeShortcutTrigger } from '../../shortcuts/core/shortcutDbData';

export const readAllShortcuts = async (): Promise<Record<string, string>> => {
  const chromeAny = (window as any)?.chrome;
  const all: Record<string, string> = {};

  // Run one-time migration for old users who only have data in chrome.storage.local
  await migrateLegacyShortcutsIfNeeded();

  // Primary source: IndexedDB (this is where saveShortcut writes)
  try {
    const dbShortcuts = await getAllUserShortcuts();
    dbShortcuts.forEach(rec => {
      if (rec.referenceId && rec.trigger) {
        all[rec.referenceId] = rec.trigger;
      }
    });
  } catch (e) {
    console.warn('[readAllShortcuts] Failed to read IndexedDB shortcuts:', e);
  }

  // Command shortcuts now come from IndexedDB commands so the sheet UI and
  // command editor read the same source of truth.
  try {
    const commands = useDbStore.getState().commands;
    commands.forEach((cmd: any) => {
      const shortcut = cmd?.prefix || '';
      if (cmd?.id && shortcut && !all[cmd.id]) {
        all[cmd.id] = shortcut;
      }
    });
  } catch (e) {
    console.warn('[readAllShortcuts] Failed to read IndexedDB commands:', e);
  }



  return all;
};

export const readAllHotkeys = async (): Promise<Record<string, string>> => {
  const chromeAny = (window as any)?.chrome;
  const all: Record<string, string> = {};

  // Primary source: IndexedDB (this is where saveHotkey writes)
  try {
    const dbHotkeys = await getAllUserHotkeys();
    dbHotkeys.forEach(rec => {
      if (rec.referenceId && rec.combination) {
        all[rec.referenceId] = rec.combination;
      }
    });
  } catch (e) {
    console.warn('[readAllHotkeys] Failed to read IndexedDB hotkeys:', e);
  }

  // Command hotkeys now come from IndexedDB commands so the sheet UI and
  // command editor read the same source of truth.
  try {
    const commands = useDbStore.getState().commands;
    commands.forEach((cmd: any) => {
      const hotkey = cmd?.hotkey || '';
      if (cmd?.id && hotkey && !all[cmd.id]) {
        all[cmd.id] = hotkey;
      }
    });
  } catch (e) {
    console.warn('[readAllHotkeys] Failed to read IndexedDB commands:', e);
  }

  // Supplement with chrome.storage.local for legacy non-command data only.
  if (chromeAny?.storage?.local) {
    await new Promise<void>(resolve => {
      chromeAny.storage.local.get(
        ['alts_command_hotkeys', 'alts_link_hotkeys', 'alts_note_hotkeys', 'alts_automation_hotkeys', 'alts_module_hotkeys'],
        (res: any) => {
          // Local Overrides
          Object.entries(res.alts_command_hotkeys || {}).forEach(([id, hk]) => { if (!all[id]) all[id] = hk as string; });
          Object.entries(res.alts_link_hotkeys || {}).forEach(([id, hk]) => { if (!all[id]) all[id] = hk as string; });
          Object.entries(res.alts_note_hotkeys || {}).forEach(([id, hk]) => { if (!all[id]) all[id] = hk as string; });
          Object.entries(res.alts_automation_hotkeys || {}).forEach(([id, hk]) => { if (!all[id]) all[id] = hk as string; });
          Object.entries(res.alts_module_hotkeys || {}).forEach(([id, hk]) => { if (!all[id]) all[id] = hk as string; });

          resolve();
        },
      );
    });
  }

  // Default fallbacks

  return all;
};

let hasMigratedLegacyShortcuts = false;

async function migrateLegacyShortcutsIfNeeded() {
  if (hasMigratedLegacyShortcuts) return;
  hasMigratedLegacyShortcuts = true;

  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return;

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get(
      ['link_commands', 'note_commands', 'session_commands', 'todo_commands', 'alts_automation_shortcuts'],
      async (res: any) => {
        const hasAnyData = Object.values(res).some(v => v && Object.keys(v as any).length > 0);
        if (!hasAnyData) {
          resolve();
          return;
        }

        console.info('[migrateLegacyShortcuts] Migrating legacy text shortcuts to IndexedDB...');
        const { saveUserShortcut } = await import('../../shortcuts/core/shortcutDbData');
        
        const migrateBucket = async (bucket: any, type: string) => {
          if (!bucket) return;
          for (const [compoundId, data] of Object.entries(bucket)) {
             let sc = '';
             if (typeof data === 'string') sc = data;
             else if (data && (data as any).shortcut) sc = (data as any).shortcut;
             if (sc) {
               await saveUserShortcut(sc, compoundId, type as any).catch(console.error);
             }
          }
        };

        await migrateBucket(res.link_commands, 'link');
        await migrateBucket(res.note_commands, 'note');
        await migrateBucket(res.session_commands, 'session');
        await migrateBucket(res.todo_commands, 'todo');
        await migrateBucket(res.alts_automation_shortcuts, 'automation');

        chromeAny.storage.local.remove(
          ['link_commands', 'note_commands', 'session_commands', 'todo_commands', 'alts_automation_shortcuts'], 
          () => resolve()
        );
      }
    );
  });
}

export { getItemCompoundId, extractSnippetIdFromCompoundId } from '../../utils/idGenerator';

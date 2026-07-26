import { useDbStore } from '../../../storage/store/useDbStore';
import { getAllUserHotkeys } from '../core/hotkeyDbData';
import { getAllUserShortcuts, normalizeShortcutTrigger } from '../../shortcuts/core/shortcutDbData';

export const readAllShortcuts = async (): Promise<Record<string, string>> => {
  const chromeAny = (window as any)?.chrome;
  const all: Record<string, string> = {};

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

  // Supplement with chrome.storage.local for legacy non-command data only.
  if (chromeAny?.storage?.local) {
    await new Promise<void>(resolve => {
      chromeAny.storage.local.get(
        ['link_commands', 'note_commands', 'session_commands', 'alts_automation_shortcuts'],
        (res: any) => {
          const linkCmds = res.link_commands || {};
          const noteCmds = res.note_commands || {};
          const sessionCmds = res.session_commands || {};
          const autoShortcuts = res.alts_automation_shortcuts || {};

          // Link Commands
          Object.entries(linkCmds).forEach(([id, data]: [string, any]) => {
            if (data?.shortcut && !all[id]) all[id] = normalizeShortcutTrigger(data.shortcut);
          });
          // Note Commands
          Object.entries(noteCmds).forEach(([id, data]: [string, any]) => {
            if (data?.shortcut && !all[id]) all[id] = normalizeShortcutTrigger(data.shortcut);
          });
          // Session Commands
          Object.entries(sessionCmds).forEach(([id, data]: [string, any]) => {
            if (data?.shortcut && !all[id]) all[id] = normalizeShortcutTrigger(data.shortcut);
          });
          // Automation Shortcuts
          Object.entries(autoShortcuts).forEach(([id, sc]) => {
            if (typeof sc === 'string' && !all[id]) all[id] = normalizeShortcutTrigger(sc);
          });

          resolve();
        },
      );
    });
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
  if (!all['create']) all['create'] = 'Alt+C';

  return all;
};

export { getItemCompoundId, extractSnippetIdFromCompoundId } from '../../utils/idGenerator';

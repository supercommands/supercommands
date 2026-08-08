import { useState, useEffect, useCallback } from 'react';
import { readAllHotkeys, extractSnippetIdFromCompoundId } from '../utils/hotkeyUtils';
import { useConflictResolver } from '../../utils/useConflictResolver';
import { useDbStore } from '../../../storage/store/useDbStore';
import { findCommandByAnyId } from '../../commands';

export interface ValidationResult {
  isValid: boolean;
  conflictId: string | null;
  errorMessage: string | null;
  conflictingItemName?: string | null;
  isOverrideable?: boolean;
}

export const useHotkeyValidation = () => {
  const [extensionCommands, setExtensionCommands] = useState<any[]>([]);
  const { findConflictingItemName } = useConflictResolver();

  useEffect(() => {
    let mounted = true;
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.commands?.getAll) {
      chromeAny.commands.getAll((cmds: any[]) => {
        if (mounted && cmds) {
          setExtensionCommands(cmds);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const validateHotkey = useCallback(
    async (hotkeyValue: string, currentItemId: string): Promise<ValidationResult> => {
      if (!hotkeyValue) {
        return { isValid: true, conflictId: null, errorMessage: null };
      }

      // 1. Check Extension Commands
      const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      const targetNormal = normalize(hotkeyValue);

      const conflictExtCmd = extensionCommands.find((cmd: any) => {
        if (!cmd.shortcut) return false;
        return normalize(cmd.shortcut) === targetNormal;
      });

      const APP_RESERVED_HOTKEYS = [
        'alt+s',
        'alt+/',
        'ctrl+enter',
        'ctrl+shift+enter',
        'meta+s',
        'meta+c',
        'meta+/',
        'meta+enter',
        'meta+shift+enter'
      ];

      if (conflictExtCmd || APP_RESERVED_HOTKEYS.includes(targetNormal)) {
        return {
          isValid: false,
          conflictId: 'extension-reserved',
          errorMessage: 'Hotkey is reserved by extension',
        };
      }

      // 1.5 Check OS/Browser Reserved Hotkeys
      const OS_BROWSER_RESERVED_HOTKEYS = [
        'alt+tab', 'alt+shift+tab', 'alt+esc', 'alt+f4', 'alt+space',
        'ctrl+alt+delete', 'ctrl+shift+esc', 'printscreen',
        'meta+l', 'meta+d', 'meta+e', 'meta+i', 'meta+m', 'meta+r', 'meta+s', 'meta+q', 'meta+tab', 'meta+v', 'meta+h', 'meta+g', 'meta+p', 'meta+k', 'meta+x', 'meta+.', 'meta+shift+s',
        'meta+ctrl+d', 'meta+ctrl+left', 'meta+ctrl+right', 'meta+ctrl+f4',
        'ctrl+n', 'ctrl+shift+n', 'ctrl+t', 'ctrl+shift+t', 'ctrl+w', 'ctrl+f4', 'ctrl+shift+w',
        'ctrl+tab', 'ctrl+shift+tab', 'ctrl+1', 'ctrl+2', 'ctrl+3', 'ctrl+4', 'ctrl+5', 'ctrl+6', 'ctrl+7', 'ctrl+8', 'ctrl+9',
        'alt+left', 'alt+right', 'alt+home', 'f11',
        'ctrl+l', 'alt+d', 'f6', 'ctrl+f', 'ctrl+g', 'ctrl+shift+g', 'ctrl+h', 'ctrl+j', 'ctrl+p', 'ctrl+s', 'ctrl+o', 'ctrl+u',
        'ctrl+r', 'f5', 'ctrl+shift+r', 'ctrl+d', 'ctrl+shift+b', 'ctrl+shift+o', 'ctrl+shift+delete',
        'ctrl+shift+i', 'f12', 'ctrl+shift+j', 'shift+esc', 'alt+f', 'alt+e',
        'alt+shift+i', 'alt+shift+t', 'alt+shift+a', 'alt+shift+n', 'f7',
        'ctrl+m', 'ctrl+shift+m', 'ctrl+shift+e', 'ctrl+shift+k', 'ctrl+shift+l', 'ctrl+shift+u', 'ctrl+shift+y', 'f9', 'alt+shift+b',
        'meta+space', 'meta+`',
        'meta+h', 'meta+m', 'alt+meta+m', 'meta+q', 'alt+meta+esc',
        'meta+w', 'meta+n', 'meta+t', 'meta+o', 'meta+s', 'meta+p', 'meta+f',
        'meta+a', 'meta+c', 'meta+v', 'meta+x', 'meta+z', 'meta+,',
        'ctrl+meta+f', 'ctrl+meta+q', 'shift+meta+q',
        'shift+meta+3', 'shift+meta+4', 'shift+meta+5',
        'ctrl+meta+space', 'fn+e', 'fn+q',
        'meta+shift+n', 'meta+shift+t', 'meta+shift+w',
        'meta+1', 'meta+2', 'meta+3', 'meta+4', 'meta+5', 'meta+6', 'meta+7', 'meta+8', 'meta+9',
        'meta+l', 'meta+g', 'meta+shift+g', 'meta+r', 'meta+shift+r', 'meta+y', 'meta+shift+j',
        'meta+shift+b', 'meta+alt+b', 'meta+alt+i', 'meta+alt+j', 'meta+shift+m', 'meta+shift+delete',
        'meta+alt+left', 'meta+alt+right'
      ];
      
      if (OS_BROWSER_RESERVED_HOTKEYS.includes(targetNormal)) {
        return {
          isValid: false,
          conflictId: 'os-browser-reserved',
          errorMessage: 'Hotkey is reserved by OS or Browser',
        };
      }

      // 2. Check for duplicates in our DB
      const allHotkeys = await readAllHotkeys();
      const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === hotkeyValue && extractSnippetIdFromCompoundId(id) !== extractSnippetIdFromCompoundId(currentItemId || ''));

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        const msg = conflictName
          ? `Hotkey "${hotkeyValue}" is already assigned to "${conflictName}"`
          : `Hotkey "${hotkeyValue}" is already assigned`;

        const commands = useDbStore.getState().commands;
        let finalConflictId = conflictingId;
        if (findCommandByAnyId(commands, conflictingId)) {
          finalConflictId = conflictingId + '-reserved';
        }

        return {
          isValid: false,
          conflictId: finalConflictId,
          errorMessage: msg,
        };
      }

      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [extensionCommands, findConflictingItemName],
  );

  return { validateHotkey };
};

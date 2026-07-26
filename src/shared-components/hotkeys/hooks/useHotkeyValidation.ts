import { useState, useEffect, useCallback } from 'react';
import { readAllHotkeys, extractSnippetIdFromCompoundId } from '../utils/hotkeyUtils';
import { useConflictResolver } from '../../utils/useConflictResolver';

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

      if (conflictExtCmd) {
        return {
          isValid: false,
          conflictId: 'extension-reserved',
          errorMessage: 'Hotkey is reserved by extension',
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

        return {
          isValid: false,
          conflictId: conflictingId,
          errorMessage: msg,
        };
      }

      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [extensionCommands, findConflictingItemName],
  );

  return { validateHotkey };
};

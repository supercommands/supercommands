import { useCallback } from 'react';
import { readAllShortcuts, extractSnippetIdFromCompoundId } from '../../hotkeys/utils/hotkeyUtils';
import { checkReservedShortcut } from '../core/reservedShortcuts';
import { getReservedShortcutReason, getShortcutTriggerFormatError, normalizeShortcutTrigger } from '../core/shortcutDbData';
import { useConflictResolver } from '../../utils/useConflictResolver';
import { useDbStore } from '../../../storage/store/useDbStore';
import { findCommandByAnyId } from '../../commands';
import type { ValidationResult } from '../../hotkeys';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';

export const useShortcutValidation = () => {
  const { findConflictingItemName } = useConflictResolver();

  const normalizeShortcut = (value: string) => {
    return normalizeShortcutTrigger(value);
  };

  const validateShortcut = useCallback(
    async (shortcutValue: string, currentItemId: string): Promise<ValidationResult> => {
      if (!shortcutValue) {
        return { isValid: true, conflictId: null, errorMessage: null };
      }

      const normalized = normalizeShortcut(shortcutValue);
      if (!normalized) {
        return {
          isValid: false,
          conflictId: null,
          errorMessage: 'Shortcut cannot be empty',
        };
      }

      const formatError = getShortcutTriggerFormatError(shortcutValue);
      if (formatError) {
        return {
          isValid: false,
          conflictId: null,
          errorMessage: formatError,
        };
      }

      // Fetch dynamic omni prefixes from Chrome local storage
      const omniboxPrefixes = await CustomSearchPrefixesForOmniboxStorage.getPrefixes().catch(() => ({}));

      const activePrefixes = Object.values(omniboxPrefixes)
        .filter((prefix): prefix is string => typeof prefix === 'string' && prefix.trim().length > 0)
        .map(prefix => prefix.trim().toLowerCase());

      // Block single characters that are exact matches for the main omni prefixes
      if (activePrefixes.includes(normalized)) {
        return {
          isValid: false,
          conflictId: 'omni-reserved',
          isOverrideable: false,
          errorMessage: `The shortcut "${normalized}" is reserved for the omni prefix`,
        };
      }

      // Check Omnibox Prefixes (these are system reserved and CANNOT be overridden)
      const reservedOmniboxReason = await getReservedShortcutReason(shortcutValue);
      if (reservedOmniboxReason) {
        return {
          isValid: false,
          conflictId: 'omni-reserved',
          isOverrideable: false,
          errorMessage: reservedOmniboxReason,
        };
      }

      // Check for duplicates dynamically against Commands table & User Shortcuts table
      const allShortcuts = await readAllShortcuts();
      const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => {
        if (normalizeShortcut(sc) !== normalized) return false;
        
        const sameItem = 
          id === currentItemId || 
          id.endsWith(`-${currentItemId}`) || 
          (currentItemId && currentItemId !== 'new' && id.includes(currentItemId)) ||
          extractSnippetIdFromCompoundId(id) === extractSnippetIdFromCompoundId(currentItemId || '');
          
        return !sameItem;
      });

      console.log(`[ShortcutDebug] Validating shortcut "${shortcutValue}" for currentItemId "${currentItemId}"...`);

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        if (!conflictName) {
          console.warn(`[ShortcutDebug] Found orphan shortcut trigger "${normalized}" for unknown ID ${conflictingId}. Auto-pruning...`);
          try {
            const { clearShortcut } = await import('../core/shortcutManager');
            await clearShortcut(conflictingId, conflictingId, 'note');
          } catch (e) {
            console.error('Failed to auto-prune orphaned shortcut:', e);
          }
          return { isValid: true, conflictId: null, errorMessage: null };
        }

        console.log(`[ShortcutDebug] CONFLICT DETECTED: Shortcut "${normalized}" is currently assigned to "${conflictName}" (ID: ${conflictingId}). Override button enabled.`);
        return {
          isValid: false,
          conflictId: conflictingId,
          conflictingItemName: conflictName,
          isOverrideable: true,
          errorMessage: `Shortcut "${normalized}" is already assigned to "${conflictName}"`,
        };
      }

      console.log(`[ShortcutDebug] Shortcut "${normalized}" is VALID and available.`);
      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [findConflictingItemName],
  );

  return { validateShortcut };
};

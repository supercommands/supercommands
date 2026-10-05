import { useCallback } from 'react';
import { checkShortcutAssignment } from '../core/shortcutDbData';
import type { ShortcutAssignmentApproval } from '../core/shortcutAssignmentTypes';
import type { ValidationResult } from '../../hotkeys';
type ShortcutValidationOptions = {
    readShortcuts?: () => Promise<Record<string, string>>;
};
export type ShortcutValidationResult = ValidationResult & {
    canShare?: boolean;
    assignmentConflict?: ShortcutAssignmentApproval;
};
export const useShortcutValidation = (options: ShortcutValidationOptions = {}) => {
    const validateShortcut = useCallback(async (value: string, itemId: string): Promise<ShortcutValidationResult> => {
        if (!value.trim())
            return { isValid: true, conflictId: null, errorMessage: null };
        try {
            // Embedded website editors must keep database ownership in the background.
            const check = options.readShortcuts && typeof chrome !== 'undefined'
                ? await chrome.runtime.sendMessage({ action: 'website_popup:text_command', operation: 'validate', value, currentReferenceId: itemId })
                    .then(response => { if (!response?.success)
                    throw new Error(response?.error || 'Could not check Text Command.'); return response.check; })
                : await checkShortcutAssignment(value, itemId);
            if (check.status === 'available')
                return { isValid: true, conflictId: null, errorMessage: null };
            if (check.status === 'error')
                return { isValid: false, conflictId: 'omni-reserved', errorMessage: check.message, isOverrideable: false };
            return { isValid: false, conflictId: check.conflict.id, errorMessage: check.message,
                conflictingItemName: check.conflict.label, isOverrideable: true, canShare: check.conflict.canShare,
                assignmentConflict: check.conflict };
        }
        catch (error) {
            return { isValid: false, conflictId: null, errorMessage: error instanceof Error ? error.message : String(error), isOverrideable: false };
        }
    }, [options.readShortcuts]);
    return { validateShortcut };
};

import { useState, useEffect, useCallback } from 'react';
import { readAllHotkeys, extractSnippetIdFromCompoundId } from '../utils/hotkeyUtils';
import { useConflictResolver } from '../../utils/useConflictResolver';
import { useDbStore } from '../../../storage/store/useDbStore';
import { findCommandByAnyId } from '../../commands';
import { normalizeHotkeyString } from '../core/eventParser';
import { getHotkeyReservation } from '../core/reservedHotkeys';
export interface ValidationResult {
    isValid: boolean;
    conflictId: string | null;
    errorMessage: string | null;
    conflictingItemName?: string | null;
    isOverrideable?: boolean;
}
export const useHotkeyValidation = ({ readHotkeys = readAllHotkeys }: {
    readHotkeys?: () => Promise<Record<string, string>>;
} = {}) => {
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
    const validateHotkey = useCallback(async (hotkeyValue: string, currentItemId: string): Promise<ValidationResult> => {
        if (!hotkeyValue) {
            return { isValid: true, conflictId: null, errorMessage: null };
        }
        const normalize = (s: string) => normalizeHotkeyString(s).replace(/\s+/g, '').toLowerCase();
        const targetNormal = normalize(hotkeyValue);
        const reservation = getHotkeyReservation(hotkeyValue, extensionCommands);
        if (reservation) {
            return {
                isValid: false,
                conflictId: reservation.conflictId,
                errorMessage: reservation.errorMessage,
            };
        }
        // 2. Check for duplicates in our DB
        const allHotkeys = await readHotkeys();
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => normalize(hk) === targetNormal && extractSnippetIdFromCompoundId(id) !== extractSnippetIdFromCompoundId(currentItemId || ''));
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
    }, [extensionCommands, findConflictingItemName, readHotkeys]);
    return { validateHotkey };
};

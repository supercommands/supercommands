import { normalizeShortcutTrigger } from './shortcutDbData';

export interface ReservedShortcut {
  shortcut: string;
  reason: string;
  category: 'system' | 'navigation' | 'settings';
}

// All shortcut validations are now dynamically evaluated against the Commands table and User Shortcuts table.
export const reservedShortcuts: ReservedShortcut[] = [];

/**
 * Legacy check stub. Dynamic checks in useShortcutValidation replace hardcoded statics.
 */
export const checkReservedShortcut = (_shortcutText: string): { isReserved: boolean; conflictReason: string | null } => {
  return { isReserved: false, conflictReason: null };
};

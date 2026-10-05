/**
 * Pure navigation helpers for the centralized popup results layer.
 *
 * Providers and row components never calculate selection. This module owns
 * wrapped movement across the single flattened row sequence and ignores rows
 * that cannot be selected.
 */
import type { WebsitePopupResolvedRow } from './websitePopupResultsTypes';
export type WebsitePopupSelectionDirection = 'next' | 'previous';
export function findFirstSelectableWebsitePopupRowIndex(rows: readonly WebsitePopupResolvedRow[]): number {
    return rows.findIndex(row => !row.disabled);
}
export function findNextSelectableWebsitePopupRowIndex(rows: readonly WebsitePopupResolvedRow[], selectedIndex: number, direction: WebsitePopupSelectionDirection): number {
    if (rows.length === 0)
        return -1;
    const selectableCount = rows.reduce((count, row) => count + (row.disabled ? 0 : 1), 0);
    if (selectableCount === 0)
        return -1;
    const step = direction === 'next' ? 1 : -1;
    let candidate = Number.isInteger(selectedIndex) ? selectedIndex : 0;
    for (let visited = 0; visited < rows.length; visited += 1) {
        candidate = (candidate + step + rows.length) % rows.length;
        if (!rows[candidate]?.disabled)
            return candidate;
    }
    return -1;
}

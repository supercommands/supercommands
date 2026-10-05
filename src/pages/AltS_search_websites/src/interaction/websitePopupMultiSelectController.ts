/**
 * Pure popup multi-select state transitions shared by Create argument adapters.
 *
 * This module knows nothing about React, Chrome tabs, or entity records. It
 * preserves selection order and gives every surface the same toggle/removal
 * semantics before selected values are persisted through the bridge.
 */
import type { WebsitePopupCreateSelectedValue } from './websitePopupInteractionTypes';
export function toggleWebsitePopupMultiSelectValue(existing: readonly WebsitePopupCreateSelectedValue[], nextValue: WebsitePopupCreateSelectedValue, multiple: boolean): WebsitePopupCreateSelectedValue[] {
    if (!multiple)
        return [nextValue];
    return existing.some(value => value.id === nextValue.id)
        ? existing.filter(value => value.id !== nextValue.id)
        : [...existing, nextValue];
}
export function removeLastWebsitePopupMultiSelectValue(values: readonly WebsitePopupCreateSelectedValue[]): WebsitePopupCreateSelectedValue[] {
    return values.slice(0, -1);
}

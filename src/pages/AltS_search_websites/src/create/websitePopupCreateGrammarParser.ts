import { findCommandChainFieldMarkers } from '../../../../shared-components/commandTerminal/chaining/cursorMarkers';
import { getUrlIdentity } from '../../../../shared-components/utils/urlIdentity';
/**
 * Parses a Create draft solely from grammar supplied by the popup background
 * bridge. It has no entity defaults, aliases, settings, or storage access.
 */
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
export type WebsitePopupCreateGrammarDraft = {
    values: Record<string, string>;
    urls: string[];
    presentFields: string[];
};
export type WebsitePopupCreateSessionHydration = {
    fieldValues: Record<string, string>;
    visibleFieldOrder: string[];
    committedOptionalFieldOrder: string[];
    selectedValuesByField: Record<string, WebsitePopupCreateSelectedValue[]>;
};
/**
 * Serializes the independent visible-field draft for compatibility with the
 * existing command-chain route. Visible controls never parse this string back
 * during editing, so user text resembling a prefix remains ordinary text.
 */
export function serializeWebsitePopupCreateGrammarDraft(values: Record<string, string>, grammar: WebsitePopupCreateEntityGrammar): string {
    return [...grammar.fields]
        .sort((left, right) => left.sequence - right.sequence)
        .flatMap(field => {
        const value = String(values[field.field] || '').trim();
        return field.primaryPrefix && value ? [`${field.primaryPrefix} ${value}`] : [];
    })
        .join(' ')
        .trim();
}
export function parseWebsitePopupCreateGrammarDraft(source: string, grammar: WebsitePopupCreateEntityGrammar): WebsitePopupCreateGrammarDraft {
    const normalized = String(source || '');
    const markers = findCommandChainFieldMarkers(normalized, [...grammar.fieldPrefixes], {
        allowUnambiguousPartial: true, requireDash: false,
    }).map(marker => ({ ...marker, valueStart: marker.start + marker.prefix.length }));
    const values: Record<string, string> = {};
    markers.forEach((marker, index) => {
        const nextStart = markers[index + 1]?.start ?? normalized.length;
        const value = normalized.slice(marker.valueStart, nextStart).trim();
        values[marker.field] = [values[marker.field], value].filter(Boolean).join(' ').trim();
    });
    const urls = String(values.url || '')
        .split(/[\n,]+/)
        .map(value => value.trim())
        .filter(Boolean);
    return { values, urls, presentFields: [...new Set(markers.map(marker => marker.field))] };
}
/**
 * The one-time Create-entry parser. Call this only while a fresh session has
 * `fieldsHydrated: false`; subsequent edits read and write `fieldValues`.
 */
export function hydrateWebsitePopupCreateSession(source: string, grammar: WebsitePopupCreateEntityGrammar): WebsitePopupCreateSessionHydration {
    const parsed = parseWebsitePopupCreateGrammarDraft(source, grammar);
    const seenUrls = new Set<string>();
    const urlSelections: WebsitePopupCreateSelectedValue[] = parsed.urls.flatMap(url => {
        const key = getUrlIdentity(url);
        if (seenUrls.has(key))
            return [];
        seenUrls.add(key);
        return [{ id: `custom:${key}`, label: url, serializedValue: url, kind: 'url', url, source: 'custom' }];
    });
    const visibleFieldOrder = grammar.fields
        .filter(field => field.required
        && field.primaryPrefix
        && field.visibleInLeftComposer !== false
        && field.tabCycle !== false)
        .sort((left, right) => left.sequence - right.sequence)
        .map(field => field.field);
    const requiredFields = new Set(visibleFieldOrder);
    const favoritePresent = parsed.presentFields.includes('favorite');
    const favoriteEnabled = favoritePresent
        && String(parsed.values.favorite || '').trim().toLowerCase() !== 'disabled';
    return {
        fieldValues: {
            ...parsed.values,
            ...(urlSelections.length > 0 ? { url: urlSelections.map(selection => selection.url).join(', ') } : {}),
            ...(favoriteEnabled ? { favorite: 'enabled' } : {}),
        },
        selectedValuesByField: {
            ...(urlSelections.length > 0 ? { url: urlSelections } : {}),
            ...(favoriteEnabled ? { favorite: [{
                        id: 'enabled', label: 'Added to Favorites', serializedValue: 'enabled',
                    }] } : {}),
        },
        visibleFieldOrder,
        committedOptionalFieldOrder: parsed.presentFields.filter(field => !requiredFields.has(field) && (field !== 'favorite' || favoriteEnabled)),
    };
}

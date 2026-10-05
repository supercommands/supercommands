/**
 * popup Link URL result sections for the Create composer.
 *
 * Open tabs and bookmark/history suggestions retain their rows when selected.
 * Committed URLs come from the Create session, so a selected URL also remains
 * removable after its source disappears.
 * This catalog owns presentation rows only; the results layer owns activation.
 */
import StackedLinkIcon from '../../../../shared-components/icons/stackedLinkIcon';
import { FaBookmark, FaHistory } from 'react-icons/fa';
import type { WebsitePopupOpenTabOption, WebsitePopupUrlSuggestion } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
import { getUrlIdentity } from '../../../../shared-components/utils/urlIdentity';
export const normalizeWebsitePopupUrlIdentity = getUrlIdentity;
export const normalizeWebsitePopupManualUrl = (query: string): string | null => {
    const raw = query.trim();
    if (!raw || /\s/.test(raw))
        return null;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.href : null;
    }
    catch {
        return null;
    }
};
const matchesQuery = (title: string, url: string, tokens: readonly string[]) => {
    let hostname = '';
    try {
        hostname = new URL(url).hostname;
    }
    catch {
        // The URL still appears in the selected section so it can be removed.
    }
    const searchable = `${title} ${url} ${hostname}`.toLowerCase();
    return tokens.every(token => searchable.includes(token));
};
const linkIcon = (url: string) => (<StackedLinkIcon urls={[url]} size={18} fallback="link" className="website-popup-stacked-icon"/>);
export function buildWebsitePopupCreateLinkUrlSections({ openTabs, suggestions, selectedValues, query, }: {
    openTabs: readonly WebsitePopupOpenTabOption[];
    suggestions: readonly WebsitePopupUrlSuggestion[];
    selectedValues: readonly WebsitePopupCreateSelectedValue[];
    query: string;
}): WebsitePopupResolvedSection[] {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const selectedByUrl = new Map<string, WebsitePopupCreateSelectedValue>(selectedValues.map(value => [
        normalizeWebsitePopupUrlIdentity(String(value.url || value.serializedValue || '')), value
    ] as const));
    const matchingOpenTabUrls = new Set(openTabs
        .filter(tab => matchesQuery(tab.title, tab.url, tokens))
        .map(tab => normalizeWebsitePopupUrlIdentity(tab.url)));
    const suggestionRows = suggestions
        .filter(item => matchesQuery(item.title, item.url, tokens))
        .filter(item => !matchingOpenTabUrls.has(normalizeWebsitePopupUrlIdentity(item.url)))
        .map(item => {
        const selected = selectedByUrl.get(normalizeWebsitePopupUrlIdentity(item.url));
        return {
            id: `create-url:suggestion:${item.id}`,
            icon: linkIcon(item.url),
            iconLayout: 'stacked' as const,
            title: item.title || item.url,
            detail: item.url,
            trailing: item.source === 'bookmark'
                ? <><FaBookmark aria-hidden="true"/>Bookmark</>
                : <><FaHistory aria-hidden="true"/>History</>,
            checkable: true,
            checked: Boolean(selected),
            intent: {
                kind: 'create-property-select' as const,
                field: 'url',
                optionId: selected?.id || `url:${normalizeWebsitePopupUrlIdentity(item.url)}`,
                label: selected?.label || item.title || item.url,
                serializedValue: item.url,
                multiple: true,
                selection: {
                    kind: 'url' as const,
                    url: item.url,
                    source: selected?.source === 'tab' ? 'tab' as const : 'custom' as const,
                    favIconUrl: selected?.favIconUrl,
                },
            },
        };
    });
    const availableRows = openTabs
        .filter(tab => matchesQuery(tab.title, tab.url, tokens))
        .map(tab => {
        const selected = selectedByUrl.get(normalizeWebsitePopupUrlIdentity(tab.url));
        return {
            id: `create-url:available:${tab.id}`,
            icon: linkIcon(tab.url),
            iconLayout: 'stacked' as const,
            title: tab.title || tab.url,
            detail: tab.url,
            checkable: true,
            checked: Boolean(selected),
            intent: {
                kind: 'create-property-select' as const,
                field: 'url',
                optionId: selected?.id || `url:${normalizeWebsitePopupUrlIdentity(tab.url)}`,
                label: selected?.label || tab.title || tab.url,
                serializedValue: tab.url,
                multiple: true,
                selection: {
                    kind: 'url' as const,
                    url: tab.url,
                    source: selected?.source === 'custom' ? 'custom' as const : 'tab' as const,
                    favIconUrl: selected?.favIconUrl || tab.favIconUrl,
                },
            },
        };
    });
    const visibleCandidateUrls = new Set([
        ...suggestionRows.map(row => normalizeWebsitePopupUrlIdentity(row.intent.serializedValue)),
        ...availableRows.map(row => normalizeWebsitePopupUrlIdentity(row.intent.serializedValue))
    ]);
    const selectedRows = (query.trim() ? [] : selectedValues).flatMap(value => {
        const url = String(value.url || value.serializedValue || '').trim();
        if (!url || visibleCandidateUrls.has(normalizeWebsitePopupUrlIdentity(url)))
            return [];
        return [{
                id: `create-url:selected:${value.id}`,
                icon: linkIcon(url),
                iconLayout: 'stacked' as const,
                title: value.label || url,
                detail: url,
                checkable: true,
                checked: true,
                intent: {
                    kind: 'create-property-select' as const,
                    field: 'url',
                    optionId: value.id,
                    label: value.label || url,
                    serializedValue: url,
                    multiple: true,
                    selection: {
                        kind: 'url' as const,
                        url,
                        source: value.source === 'custom' ? 'custom' as const : 'tab' as const,
                        favIconUrl: value.favIconUrl,
                    },
                },
            }];
    });
    return [
        ...(availableRows.length > 0
            ? [{ id: 'create-url-active-tabs', label: 'Active Tabs', rows: availableRows }]
            : []),
        ...(suggestionRows.length > 0
            ? [{ id: 'create-url-suggestions', label: 'Bookmarks and History', rows: suggestionRows }]
            : []),
        ...(selectedRows.length > 0
            ? [{ id: 'create-url-selected-tabs', label: 'Selected URLs', rows: selectedRows }]
            : [])
    ];
}

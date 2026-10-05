/**
 * Pure resolver for centralized popup sections and flattened navigation rows.
 */
import type { WebsitePopupSuggestionRequest } from '../interaction/websitePopupInteractionTypes';
import { WEBSITE_POPUP_SECTION_PROVIDERS } from './websitePopupSectionProviders';
import type { WebsitePopupResolvedRow, WebsitePopupResolvedSection, WebsitePopupResultsContext, } from './websitePopupResultsTypes';
export type ResolvedWebsitePopupResults = {
    sections: WebsitePopupResolvedSection[];
    rows: WebsitePopupResolvedRow[];
};
export function resolveWebsitePopupResults(request: WebsitePopupSuggestionRequest, context: WebsitePopupResultsContext, selectedIndex: number): ResolvedWebsitePopupResults {
    let flattenedIndex = 0;
    const sections = [...WEBSITE_POPUP_SECTION_PROVIDERS]
        .sort((left, right) => left.order - right.order)
        .filter(provider => provider.supports(request))
        .flatMap(provider => {
        const provided = provider.provide(request, context);
        if (!provided)
            return [];
        return (Array.isArray(provided) ? provided : [provided]).map(section => ({
            ...section,
            rows: section.rows.map(row => {
                const rowIndex = flattenedIndex++;
                return { ...row, selected: !row.disabled && rowIndex === selectedIndex };
            }),
        }));
    });
    return {
        sections,
        rows: sections.flatMap(section => section.rows),
    };
}

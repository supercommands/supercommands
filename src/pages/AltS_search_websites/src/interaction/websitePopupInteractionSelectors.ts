/**
 * Derived view contracts for future suggestion providers and UI surfaces.
 *
 * Suggestions themselves are never stored in Zustand. Consumers derive one
 * request from the current route and resolve rows through their own data layer.
 */
import type { WebsitePopupInteractionState, WebsitePopupSuggestionRequest, } from './websitePopupInteractionTypes';
export function selectWebsitePopupSuggestionRequest(state: WebsitePopupInteractionState): WebsitePopupSuggestionRequest {
    switch (state.route.kind) {
        case 'default':
            return { source: 'default', query: '', entity: null };
        case 'suggestions':
            return { source: 'normal', query: state.route.query, entity: null };
        case 'create':
        case 'save':
        case 'filter':
            return {
                source: state.route.kind,
                query: state.route.query,
                entity: state.route.entity,
            };
        case 'submode':
            return {
                source: 'submode',
                query: state.route.query,
                entity: state.route.submode.id,
            };
    }
}
export const selectWebsitePopupQuery = (state: WebsitePopupInteractionState): string => state.inputValue;

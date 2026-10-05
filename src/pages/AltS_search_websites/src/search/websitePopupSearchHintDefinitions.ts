/**
 * Shared fixed hint definitions for popup search headers.
 *
 * The website runtime consumes this object so display text and keycaps remain
 * configured once rather than duplicated across components.
 */
export const DEFAULT_WEBSITE_POPUP_SEARCH_HINT = {
    label: 'Filter',
    shortcut: '/',
} as const;

/**
 * Shared identity registry for the website popup's Page Actions section.
 *
 * Labels, prefixes, and enabled state remain user-configurable prefix-setting
 * data. This registry owns only the supported website action identities, their
 * legacy display order, and the icon role used by presentation adapters.
 */
export type WebsitePageActionId = 'send_to_agent' | 'summarize_page';
export type WebsitePageActionIcon = 'send' | 'summarize';
export type WebsitePageActionDefinition = {
    id: WebsitePageActionId;
    fallbackLabel: string;
    icon: WebsitePageActionIcon;
};
export const WEBSITE_PAGE_ACTION_DEFINITIONS: readonly WebsitePageActionDefinition[] = [
    { id: 'send_to_agent', fallbackLabel: 'Send to Agent', icon: 'send' },
    { id: 'summarize_page', fallbackLabel: 'Summarize Page', icon: 'summarize' }
];

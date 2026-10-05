/** Typed background contract for popup Create option sources. */
import type { TagRecord } from '../../../allObjectFolder/src/createObject/tags/tagTypes';
export const WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION = 'website_popup:create_options' as const;
export type WebsitePopupOpenTabOption = {
    id: string;
    tabId: number;
    title: string;
    url: string;
    favIconUrl?: string;
    windowId: number;
    index: number;
    active: boolean;
};
export type WebsitePopupUrlSuggestion = {
    id: string;
    title: string;
    url: string;
    source: 'bookmark' | 'history';
};
/** Stable Todo reference identities, never inferred from a display title. */
export const WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES = [
    { type: 'note', label: 'Note' },
    { type: 'link', label: 'Link shortcut' },
    { type: 'aiPrompt', label: 'AI Prompts' },
    { type: 'agent', label: 'Chat Agents' }
] as const;
export type WebsitePopupTodoAttachmentType = typeof WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES[number]['type'];
export type WebsitePopupAttachmentOption = {
    id: string;
    type: WebsitePopupTodoAttachmentType;
    label: string;
    detail?: string;
};
export type WebsitePopupCreateOptionsBridgeRequest = {
    action: typeof WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION;
    operation: 'list-open-tabs' | 'list-todo-attachments';
} | {
    action: typeof WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION;
    operation: 'search-link-urls';
    query: string;
} | {
    action: typeof WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION;
    operation: 'create-tag';
    name: string;
};
export type WebsitePopupCreateOptionsBridgeResponse = {
    success: true;
    tabs: WebsitePopupOpenTabOption[];
} | {
    success: true;
    suggestions: WebsitePopupUrlSuggestion[];
} | {
    success: true;
    attachments: WebsitePopupAttachmentOption[];
} | {
    success: true;
    tag: TagRecord;
} | {
    success: false;
    error: string;
};
export function isWebsitePopupCreateOptionsBridgeRequest(value: unknown): value is WebsitePopupCreateOptionsBridgeRequest {
    if (!value || typeof value !== 'object')
        return false;
    const request = value as Partial<WebsitePopupCreateOptionsBridgeRequest>;
    return request.action === WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION
        && (request.operation === 'list-open-tabs'
            || request.operation === 'list-todo-attachments'
            || (request.operation === 'search-link-urls' && typeof request.query === 'string')
            || (request.operation === 'create-tag' && typeof request.name === 'string'));
}

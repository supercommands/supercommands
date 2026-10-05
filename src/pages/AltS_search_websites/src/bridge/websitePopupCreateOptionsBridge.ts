import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
/** Content-safe client for popup Create option sources. */
import { WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION, type WebsitePopupCreateOptionsBridgeResponse, type WebsitePopupAttachmentOption, type WebsitePopupOpenTabOption, type WebsitePopupUrlSuggestion, } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import type { TagRecord } from '../../../../allObjectFolder/src/createObject/tags/tagTypes';
export async function readWebsitePopupOpenTabs(): Promise<WebsitePopupOpenTabOption[]> {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION,
        operation: 'list-open-tabs',
    }) as WebsitePopupCreateOptionsBridgeResponse;
    if (!response?.success)
        throw new Error(response?.error || 'Unable to read open tabs.');
    if (!('tabs' in response))
        throw new Error('The open-tabs response was invalid.');
    return response.tabs;
}
export async function searchWebsitePopupLinkUrls(query: string): Promise<WebsitePopupUrlSuggestion[]> {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION,
        operation: 'search-link-urls',
        query,
    }) as WebsitePopupCreateOptionsBridgeResponse;
    if (!response?.success)
        throw new Error(response?.error || 'Unable to search bookmarks and history.');
    if (!('suggestions' in response))
        throw new Error('The URL suggestions response was invalid.');
    return response.suggestions;
}
/** Reads only attachment-safe option metadata from the background. */
export async function readWebsitePopupTodoAttachments(): Promise<WebsitePopupAttachmentOption[]> {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION,
        operation: 'list-todo-attachments',
    }) as WebsitePopupCreateOptionsBridgeResponse;
    if (!response?.success)
        throw new Error(response?.error || 'Unable to read attachments.');
    if (!('attachments' in response))
        throw new Error('The attachments response was invalid.');
    return response.attachments;
}
export async function createWebsitePopupTag(name: string): Promise<TagRecord> {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_CREATE_OPTIONS_BRIDGE_ACTION,
        operation: 'create-tag',
        name,
    }) as WebsitePopupCreateOptionsBridgeResponse;
    if (!response?.success)
        throw new Error(response?.error || 'Unable to create tag.');
    if (!('tag' in response))
        throw new Error('The create-tag response was invalid.');
    return response.tag;
}

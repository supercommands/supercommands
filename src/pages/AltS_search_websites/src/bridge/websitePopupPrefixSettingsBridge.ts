import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
/**
 * Content-safe client for popup prefix-setting operations.
 *
 * This module is the only popup presentation-side owner of Chrome runtime
 * messaging for prefix settings. It never imports Dexie or database modules.
 */
import { WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION, type WebsitePopupPrefixSettingsBridgeRequest, type WebsitePopupPrefixSettingsBridgeResponse, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
async function sendPrefixSettingsBridgeRequest(request: WebsitePopupPrefixSettingsBridgeRequest): Promise<WebsitePopupPrefixSettingsBridgeResponse> {
    const response = await sendWebsitePopupRuntimeMessage(request) as WebsitePopupPrefixSettingsBridgeResponse;
    if (!response?.success) {
        throw new Error(response?.error || 'The website popup prefix-settings request failed.');
    }
    return response;
}
/** Read the live prefix records required by popup's centralized default sections. */
export async function readWebsitePopupDefaultPrefixSettings() {
    const response = await sendPrefixSettingsBridgeRequest({
        action: WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION,
        operation: 'list-default-prefixes',
    });
    if (!('categoryPrefixSettings' in response) ||
        !('actionPrefixSettings' in response) ||
        !('subcommandPrefixSettings' in response) ||
        !('createGrammar' in response) ||
        !('actionGrammar' in response)) {
        throw new Error('The website popup default-prefix request returned an invalid response.');
    }
    return response;
}
export async function updateWebsitePopupPrefixSetting(input: {
    type: 'category' | 'action' | 'subcommand';
    category: string;
    value: string;
    expectedValue: string;
    approval?: import('../../../../shared-components/shortcuts/core/shortcutAssignmentTypes').ShortcutAssignmentApproval;
}) {
    const response = await sendPrefixSettingsBridgeRequest({
        action: WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION,
        operation: 'update-prefix',
        ...input,
    });
    if (!('updatedPrefix' in response))
        throw new Error('The prefix update returned an invalid response.');
    return response.updatedPrefix;
}

import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
/** Content-safe client for the background-owned popup search snapshot. */
import { normalizeWebsitePopupSearchSnapshot, WEBSITE_POPUP_SEARCH_BRIDGE_ACTION, type WebsitePopupSearchBridgeResponse, } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
export async function readWebsitePopupSearchSnapshot() {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_SEARCH_BRIDGE_ACTION,
        operation: 'read-snapshot',
    }) as WebsitePopupSearchBridgeResponse;
    if (!response?.success) {
        throw new Error(response?.error || 'The website popup search snapshot request failed.');
    }
    return normalizeWebsitePopupSearchSnapshot(response.snapshot);
}

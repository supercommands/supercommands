import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
/** Content-safe client for popup Create text-command validation. */
import { WEBSITE_POPUP_TEXT_COMMAND_BRIDGE_ACTION, type WebsitePopupTextCommandBridgeResponse, } from '../../../../shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
export async function validateWebsitePopupTextCommand(value: string, currentReferenceId?: string, prefixTarget?: {
    type: string;
    category: string;
}) {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_TEXT_COMMAND_BRIDGE_ACTION,
        operation: 'validate',
        value,
        currentReferenceId,
        prefixTarget,
    }) as WebsitePopupTextCommandBridgeResponse;
    if (!response?.success)
        throw new Error(response?.error || 'Unable to check the text command.');
    return response.check;
}

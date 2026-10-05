import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
/** Content-safe client for popup Hotkey validation and capture ownership. */
import { WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION, type WebsitePopupHotkeyBridgeResponse, } from '../../../../shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';
export async function validateWebsitePopupHotkey(value: string, currentEntityId?: string) {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION,
        operation: 'validate',
        value,
        currentEntityId,
    }) as WebsitePopupHotkeyBridgeResponse;
    if (!response?.success || !('check' in response)) {
        throw new Error(response?.success ? 'The Hotkey validation response was invalid.' : response?.error || 'Unable to validate Hotkey.');
    }
    return response.check;
}
export async function startWebsitePopupHotkeyCapture(token: string) {
    return captureRequest('capture-start', token);
}
export async function stopWebsitePopupHotkeyCapture(token: string) {
    return captureRequest('capture-stop', token);
}
async function captureRequest(operation: 'capture-start' | 'capture-stop', token: string) {
    const response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION,
        operation,
        token,
    }) as WebsitePopupHotkeyBridgeResponse;
    if (!response?.success || !('capture' in response)) {
        throw new Error(response?.success ? 'The Hotkey capture response was invalid.' : response?.error || 'Unable to update Hotkey capture.');
    }
    return response;
}

/** Typed popup Hotkey validation and per-tab capture lifecycle. */
import type { HotkeyReferenceType } from '../../hotkeys/core/hotkeyDbTypes';
export const WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION = 'website_popup:hotkey' as const;
export type WebsitePopupHotkeyConflict = {
    id: string;
    referenceId: string;
    referenceType: HotkeyReferenceType;
    label: string;
};
export type WebsitePopupHotkeyCheck = {
    status: 'available';
    value: string;
} | {
    status: 'conflict';
    value: string;
    message: string;
    conflict: WebsitePopupHotkeyConflict;
} | {
    status: 'error';
    value: string;
    message: string;
    conflictId?: 'extension-reserved' | 'os-browser-reserved';
};
export type WebsitePopupHotkeyBridgeRequest = {
    action: typeof WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION;
    operation: 'validate';
    value: string;
    currentEntityId?: string;
} | {
    action: typeof WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION;
    operation: 'capture-start' | 'capture-stop';
    token: string;
};
export type WebsitePopupHotkeyBridgeResponse = {
    success: true;
    check: WebsitePopupHotkeyCheck;
} | {
    success: true;
    capture: 'started' | 'stopped';
    token: string;
} | {
    success: false;
    error: string;
};
export function isWebsitePopupHotkeyBridgeRequest(value: unknown): value is WebsitePopupHotkeyBridgeRequest {
    if (!value || typeof value !== 'object')
        return false;
    const request = value as Partial<WebsitePopupHotkeyBridgeRequest>;
    if (request.action !== WEBSITE_POPUP_HOTKEY_BRIDGE_ACTION)
        return false;
    if (request.operation === 'validate')
        return typeof request.value === 'string';
    return (request.operation === 'capture-start' || request.operation === 'capture-stop')
        && typeof request.token === 'string';
}

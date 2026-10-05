/** Typed popup contract for checking a proposed Create text command. */
export const WEBSITE_POPUP_TEXT_COMMAND_BRIDGE_ACTION = 'website_popup:text_command' as const;
export type { ShortcutAssignmentApproval as WebsitePopupTextCommandConflict } from '../../shortcuts/core/shortcutAssignmentTypes';
import type { ShortcutAssignmentApproval as WebsitePopupTextCommandConflict } from '../../shortcuts/core/shortcutAssignmentTypes';
export type WebsitePopupTextCommandCheck = {
    status: 'available';
    value: string;
} | {
    status: 'conflict';
    value: string;
    message: string;
    conflict: WebsitePopupTextCommandConflict;
} | {
    status: 'error';
    value: string;
    message: string;
};
export type WebsitePopupTextCommandBridgeRequest = {
    action: typeof WEBSITE_POPUP_TEXT_COMMAND_BRIDGE_ACTION;
    operation: 'validate';
    value: string;
    currentReferenceId?: string;
    prefixTarget?: {
        type: string;
        category: string;
    };
};
export type WebsitePopupTextCommandBridgeResponse = {
    success: true;
    check: WebsitePopupTextCommandCheck;
} | {
    success: false;
    error: string;
};
export function isWebsitePopupTextCommandBridgeRequest(value: unknown): value is WebsitePopupTextCommandBridgeRequest {
    if (!value || typeof value !== 'object')
        return false;
    const request = value as Partial<WebsitePopupTextCommandBridgeRequest>;
    return request.action === WEBSITE_POPUP_TEXT_COMMAND_BRIDGE_ACTION
        && request.operation === 'validate'
        && typeof request.value === 'string'
        && (request.currentReferenceId === undefined || typeof request.currentReferenceId === 'string')
        && (request.prefixTarget === undefined || Boolean(request.prefixTarget
            && typeof request.prefixTarget.type === 'string' && typeof request.prefixTarget.category === 'string'));
}

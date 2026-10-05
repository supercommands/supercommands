/** Content-safe client for centralized popup execution operations. */
import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
import { WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION, type WebsitePopupExecutionBridgeRequest, type WebsitePopupExecutionBridgeResponse, } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
/** No response means the background outcome may be unknown; callers must not retry automatically. */
export class WebsitePopupExecutionTransportError extends Error {
    constructor(message: string) { super(message); this.name = 'WebsitePopupExecutionTransportError'; }
}
export async function executeWebsitePopupBridgeOperation(operation: WebsitePopupExecutionBridgeRequest['operation']) {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const context = { requestId, action: WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION, kind: operation.kind, version: undefined as string | undefined };
    // Diagnostics must not throw before the guarded transport handles an expired context.
    try { context.version = chrome.runtime.getManifest().version; } catch { /* Version unavailable. */ }
    console.info('[WebsitePopup execution] Sending', context);
    // Observation only: a slow request is neither cancelled nor retried.
    const pendingWarning = setTimeout(() => {
      console.warn('[WebsitePopup execution] Still awaiting background response', { ...context, elapsedMs: Date.now() - startedAt });
    }, 10000);
    let response: WebsitePopupExecutionBridgeResponse;
    try {
      response = await sendWebsitePopupRuntimeMessage({
        action: WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION,
        requestId,
        operation,
      }) as WebsitePopupExecutionBridgeResponse;
    } catch (error) {
      console.error('[WebsitePopup execution] Transport failed', { ...context, elapsedMs: Date.now() - startedAt }, error);
      throw new WebsitePopupExecutionTransportError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(pendingWarning);
    }
    console.info('[WebsitePopup execution] Response received', { ...context, elapsedMs: Date.now() - startedAt, success: response?.success, status: response?.success ? response.outcome.status : undefined, error: response?.success === false ? response.error : undefined });
    if (!response?.success) {
        console.error('[WebsitePopup] Execution rejected:', operation.kind, response?.error || 'No successful response');
        throw new Error(response?.error || 'The website popup execution request failed.');
    }
    return response.outcome;
}

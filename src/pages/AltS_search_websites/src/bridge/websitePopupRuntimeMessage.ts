/** Normalize stale content-script failures at the shared popup transport boundary. */
const staleContextMessage = 'The extension was reloaded or updated. Refresh this page, then reopen the popup.';

export async function sendWebsitePopupRuntimeMessage(request: unknown): Promise<unknown> {
    try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) throw new Error(staleContextMessage);
        return await chrome.runtime.sendMessage(request);
    } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        if (/extension context invalidated/i.test(message)) throw new Error(staleContextMessage);
        throw failure;
    }
}

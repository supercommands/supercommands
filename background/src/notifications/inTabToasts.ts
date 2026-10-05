/**
 * @file inTabToasts.ts
 * @description Injects and displays visual toast notifications inside active browser tabs.
 */

/**
 * Shows a premium toast notification in the active browser tab by injecting a DOM element.
 * Respects restricted pages (like `chrome://` settings) and routes through extension message
 * channels if the active tab is an extension-managed page where scripting injection is prohibited.
 *
 * @param title The title header of the toast notification (e.g. "SuperCommands Notification").
 * @param message The main message content to display.
 */
export async function showInTabToast(
  title: string,
  message: string,
  toastType: 'success' | 'error' | 'warning' | 'info' = 'info',
  targetTabId?: number,
) {
  try {
    const tabs = targetTabId === undefined
      ? await chrome.tabs.query({ active: true, currentWindow: true })
      : [];
    const tab = targetTabId === undefined ? tabs[0] : await chrome.tabs.get(targetTabId).catch(() => null);

    if (!tab || !tab.id) {
      console.warn('[Background] No active tab with ID found for toast');
      return;
    }

    const isRestricted = tab.url?.startsWith('chrome://') && !tab.url?.includes('AltS_search_newtab');
    const isOurExtension =
      tab.url?.startsWith('chrome-extension://' + chrome.runtime.id) || tab.url?.includes('AltS_search_newtab');

    if (isRestricted && !isOurExtension) {
      console.warn('[Background] Cannot show toast on a restricted system page:', tab.url);
      return;
    }
    // If it's our extension page, we MUST use sendMessage as executeScript is restricted
    if (isOurExtension) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'SHOW_TOAST',
          message: `${title}: ${message}`,
          toastType,
        })
        .catch(err => console.warn('[Background] Failed to send toast message to extension tab:', err));
      return;
    }

    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TOAST', title, message, toastType });
  } catch (err) {
    console.error('[Background] Failed to show in-tab toast:', err);
  }
}

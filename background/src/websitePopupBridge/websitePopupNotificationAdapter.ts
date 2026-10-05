/**
 * Shared popup website-popup notification boundary.
 *
 * popup background operations report outcomes through the established in-tab
 * toast channel and always target the tab that initiated the bridge request.
 */
import { showInTabToast } from '../notifications/inTabToasts';
import { BRAND_TOAST_TITLE } from '../../../src/shared-components/brandingConfig';

export type WebsitePopupNotificationType = 'success' | 'error' | 'info';

export function notifyWebsitePopup(
  sender: chrome.runtime.MessageSender,
  message: string,
  type: WebsitePopupNotificationType = 'info',
) {
  if (String(sender.url || '').startsWith(chrome.runtime.getURL('AltS_search_newtab/index.html'))) {
    void (async () => {
      const tabId = sender.tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (typeof tabId !== 'number') return;
      await chrome.runtime.sendMessage({
        type: 'website_popup:toast',
        targetTabId: tabId,
        message: `${BRAND_TOAST_TITLE}: ${message}`,
        toastType: type,
      }).catch(() => undefined);
    })();
    return;
  }
  void showInTabToast(BRAND_TOAST_TITLE, message, type, sender.tab?.id);
}

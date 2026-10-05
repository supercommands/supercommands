import { isCollectionNewTabUrl } from '../../../../src/shared-components/collections/collectionCaptureSource';
/** Page-DOM command transport for website content scripts and our new tab page. */
export function isNewTabPageSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && isCollectionNewTabUrl(String(sender.url || ''));
}

export function sendPageDomMessage<T = any>(
  tabId: number,
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = isNewTabPageSender(sender) ? { ...message, targetTabId: tabId } : message;
    const onResponse = (response: any) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      } else if (response?.ok === false) {
        reject(new Error(response.error || 'page_action_failed'));
      } else {
        resolve(response);
      }
    };
    if (isNewTabPageSender(sender)) chrome.runtime.sendMessage(payload, onResponse);
    else chrome.tabs.sendMessage(tabId, payload, onResponse);
  });
}

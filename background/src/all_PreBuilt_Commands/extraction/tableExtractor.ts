/**
 * @file tableExtractor.ts
 * @description Routes webpage table extraction to the already-loaded content script.
 */
import { sendPageDomMessage } from './pageMessageTransport';

const getTargetTabId = async (tabId: unknown, sender: chrome.runtime.MessageSender) => {
  if (typeof tabId === 'number' && tabId > 0) return tabId;
  if (sender?.tab?.id) return sender.tab.id;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id;
};

export const handleTablesCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'execute_table_download') {
    (async () => {
      const targetTabId = await getTargetTabId(request.tabId, sender);
      if (typeof targetTabId !== 'number' || targetTabId <= 0) {
        sendResponse({ ok: false, error: 'invalid_tab_id' });
        return;
      }

      sendPageDomMessage(targetTabId, {
        action: 'execute_table_download',
        downloadType: request.downloadType,
        options: request.options,
      }, sender)
        .then(response => sendResponse(response || { ok: true }))
        .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    })();
    return true;
  }

  return undefined;
};

/**
 * @file imageExtractor.ts
 * @description Handles image download requests and routes page image discovery to the content script.
 */
import { sendPageDomMessage } from './pageMessageTransport';

const getTargetTabId = async (tabId: unknown, sender: chrome.runtime.MessageSender) => {
  if (typeof tabId === 'number' && tabId > 0) return tabId;
  if (sender?.tab?.id) return sender.tab.id;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id;
};

export const handleImagesCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'supercommands:download-image' || request.action === 'cmdos:download-image' || request.type === 'IMAGE_DOWNLOAD') {
    const url = request.url || request.payload?.url;
    const filename = request.filename;
    console.log('[Background] Received download-image request:', {
      filename,
      urlPrefix: url?.substring(0, 100),
    });

    if (!url) {
      sendResponse({ ok: false, error: 'No URL provided' });
      return false;
    }

    if (!chrome.downloads?.download) {
      sendResponse({ ok: false, error: 'Downloads API unavailable' });
      return false;
    }

    try {
      chrome.downloads.download(
        {
          url,
          filename,
          conflictAction: 'uniquify',
          saveAs: false,
        },
        downloadId => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('[Background] Download failed:', lastError.message, url);
            sendResponse({ ok: false, error: lastError.message });
          } else {
            sendResponse({ ok: true, downloadId });
          }
        },
      );
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true;
  }

  if (request.action === 'execute_image_download') {
    (async () => {
      const targetTabId = await getTargetTabId(request.tabId, sender);
      if (typeof targetTabId !== 'number' || targetTabId <= 0) {
        sendResponse({ ok: false, error: 'invalid_tab_id' });
        return;
      }

      sendPageDomMessage(targetTabId, {
        action: 'execute_image_download',
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

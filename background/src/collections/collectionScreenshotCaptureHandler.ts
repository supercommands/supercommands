import { captureVisiblePng } from '../all_PreBuilt_Commands/extraction/captureVisiblePng';
import { WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION, WEBSITE_POPUP_SCREENSHOT_CANCEL_ACTION, WebsitePopupScreenshotCaptureError, type WebsitePopupScreenshotCaptureResponse } from '../../../src/shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
import { captureFullPageCanvas, screenshotBlobToDataUrl, isFullPageCaptureRunning } from '../all_PreBuilt_Commands/extraction/captureFullPageCanvas';
import { validateImageAsset } from '../../../src/storage/assets/assetPolicy';
import { createCollectionSourceCheck, isCollectionCaptureSender } from './collectionWebScrapingSource';
import { isCollectionSourceUrl, isCollectionNewTabUrl } from '../../../src/shared-components/collections/collectionCaptureSource';
const pending = new Map<string, { cancelled: boolean }>();

/** Capture only: no database, asset, download or clipboard side effects. */
export function handleCollectionScreenshotCapture(
  message: unknown, sender: chrome.runtime.MessageSender,
  sendResponse: (response: WebsitePopupScreenshotCaptureResponse | { ok: true }) => void,
): boolean {
  if (!message || typeof message !== 'object' || !('action' in message)) return false;
  if (message.action === WEBSITE_POPUP_SCREENSHOT_CANCEL_ACTION) {
    const payload = 'payload' in message ? message.payload : null;
    if (isCollectionCaptureSender(sender) && sender.tab?.id !== undefined
        && payload && typeof payload === 'object' && 'operationId' in payload && typeof payload.operationId === 'string') {
      const operation = pending.get(`${sender.tab.id}:${payload.operationId}`);
      if (operation) operation.cancelled = true;
    }
    sendResponse({ ok: true });
    return true;
  }
  if (message.action !== WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION) return false;
  void (async () => {
    let invalidated = false;
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    let operationKey: string | null = null;
    let expectedSourceUrl: string | null = null;
    const onActivated = (info: chrome.tabs.TabActiveInfo) => {
      if (info.windowId === windowId && info.tabId !== tabId) invalidated = true;
    };
    const onUpdated = (id: number, change: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && ((change.url && change.url !== expectedSourceUrl) || change.status === 'loading')) invalidated = true;
    };
    const onRemoved = (id: number) => { if (id === tabId) invalidated = true; };
    try {
      const payload = 'payload' in message ? message.payload : null;
      if (!payload || typeof payload !== 'object' || !('operationId' in payload) || !('sourceUrl' in payload)
          || typeof payload.operationId !== 'string' || !payload.operationId.trim()
          || typeof payload.sourceUrl !== 'string' || !isCollectionSourceUrl(payload.sourceUrl)
          || !isCollectionCaptureSender(sender)
          || tabId === undefined || windowId === undefined) {
        throw new Error('Screenshot capture requires the originating tab.');
      }
      const { operationId, sourceUrl } = payload;
      expectedSourceUrl = sourceUrl;
      const verifySource = createCollectionSourceCheck(sender, sourceUrl, 'Screenshot capture');
      const mode = 'mode' in payload ? payload.mode : 'area';
      if (mode !== 'area' && mode !== 'visible' && mode !== 'full-page') throw new Error('Invalid screenshot mode.');
      const key = `${tabId}:${operationId}`;
      if (isFullPageCaptureRunning(tabId) || [...pending.keys()].some(key => key.startsWith(`${tabId}:`))) {
        throw new Error('A screenshot capture is still finishing in this tab. Try again shortly.');
      }
      operationKey = key;
      const operation = { cancelled: false };
      pending.set(operationKey, operation);
      chrome.tabs.onActivated.addListener(onActivated);
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
      const verify = async () => {
        if (operation.cancelled || invalidated) {
          throw new Error('The website changed or is no longer the active tab. Start capture again.');
        }
        await verifySource();
        if (operation.cancelled || invalidated) {
          throw new Error('The website changed or is no longer the active tab. Start capture again.');
        }
      };
      let dataUrl: string;
      if (mode === 'full-page') {
        const { canvas } = await captureFullPageCanvas(tabId, sender, verify);
        try {
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          validateImageAsset(blob);
          await verify();
          dataUrl = await screenshotBlobToDataUrl(blob);
        } finally { canvas.width = 0; canvas.height = 0; }
      } else dataUrl = await captureVisiblePng(windowId, verify);
      await verify();
      sendResponse({ ok: true, result: { operationId, sourceUrl, dataUrl } });
    } catch (error) {
      const permission = error instanceof WebsitePopupScreenshotCaptureError && error.code === 'CAPTURE_PERMISSION_REQUIRED';
      let message = error instanceof Error ? error.message : 'Screenshot capture failed.';
      if (permission && expectedSourceUrl && isCollectionNewTabUrl(expectedSourceUrl)) {
        const commands = await chrome.commands.getAll().catch(() => []);
        const shortcut = commands.find(command => command.name === 'open_alts')?.shortcut;
        message = shortcut ? `Press ${shortcut} to allow New Tab capture and retry this screenshot. Your Collection selection is kept.`
          : 'Assign the popup shortcut in Chrome Extension Shortcuts, then press it to retry this screenshot. Your Collection selection is kept.';
      }
      sendResponse({ ok: false, error: message, ...(permission ? { code: 'CAPTURE_PERMISSION_REQUIRED' as const } : {}) });
    } finally {
      if (operationKey) pending.delete(operationKey);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }
  })();
  return true;
}

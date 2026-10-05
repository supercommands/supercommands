/** One shared queue for visible captures, including existing download commands. */
import { WebsitePopupScreenshotCaptureError } from '../../../../src/shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
let queue: Promise<unknown> = Promise.resolve();
let lastCaptureAt = 0;
export function captureVisiblePng(windowId?: number, verify?: () => Promise<void>): Promise<string> {
  const task = queue.then(async () => {
    const delay = Math.max(0, 550 - (Date.now() - lastCaptureAt));
    if (delay) await new Promise<void>(resolve => setTimeout(resolve, delay));
    await verify?.();
    lastCaptureAt = Date.now();
    const result = await new Promise<string>((resolve, reject) => {
      const complete = (dataUrl: string) => {
        const error = chrome.runtime.lastError;
        if (error || !dataUrl) {
          const message = error?.message || 'Failed to capture visible tab.';
          const permission = /activeTab|<all_urls>|permission.*(?:required|denied)|(?:requires?|missing).*permission/i.test(message);
          reject(new WebsitePopupScreenshotCaptureError(message, permission ? 'CAPTURE_PERMISSION_REQUIRED' : undefined));
        }
        else resolve(dataUrl);
      };
      if (windowId === undefined) chrome.tabs.captureVisibleTab({ format: 'png' }, complete);
      else chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, complete);
    });
    await verify?.();
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}

import { sendWebsitePopupRuntimeMessage } from './websitePopupRuntimeMessage';
import { WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION, WEBSITE_POPUP_SCREENSHOT_CANCEL_ACTION, WebsitePopupScreenshotCaptureError, type WebsitePopupScreenshotCaptureRequest, type WebsitePopupScreenshotCaptureResponse } from '../../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
export async function cancelWebsitePopupScreenshot(operationId: string) {
  await sendWebsitePopupRuntimeMessage({ action: WEBSITE_POPUP_SCREENSHOT_CANCEL_ACTION, payload: { operationId } }).catch(() => undefined);
}

export async function captureWebsitePopupScreenshot(payload: WebsitePopupScreenshotCaptureRequest['payload']) {
  const request: WebsitePopupScreenshotCaptureRequest = { action: WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION, payload };
  const response = await sendWebsitePopupRuntimeMessage(request) as WebsitePopupScreenshotCaptureResponse;
  if (!response?.ok) throw new WebsitePopupScreenshotCaptureError(response?.error || 'Unable to capture this page.', response?.code);
  if (response.result.operationId !== payload.operationId || response.result.sourceUrl !== payload.sourceUrl
      || !response.result.dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('The screenshot response does not match the current capture.');
  }
  return response.result;
}

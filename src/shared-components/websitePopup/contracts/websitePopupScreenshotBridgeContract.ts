export const WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION = 'collection_screenshot_capture';
export const WEBSITE_POPUP_SCREENSHOT_CANCEL_ACTION = 'collection_screenshot_cancel';
export const NEW_TAB_SCREENSHOT_SHORTCUT_RETRY = 'collection:retry-screenshot-after-shortcut';
export type WebsitePopupScreenshotErrorCode = 'CAPTURE_PERMISSION_REQUIRED';
export class WebsitePopupScreenshotCaptureError extends Error {
  constructor(message: string, readonly code?: WebsitePopupScreenshotErrorCode) { super(message); }
}
export type WebsitePopupScreenshotCaptureMode = 'area' | 'visible' | 'full-page';
export type WebsitePopupScreenshotCaptureRequest = {
  action: typeof WEBSITE_POPUP_SCREENSHOT_CAPTURE_ACTION;
  payload: { operationId: string; sourceUrl: string; mode?: WebsitePopupScreenshotCaptureMode };
};
export type WebsitePopupScreenshotCaptureResponse = {
  ok: true;
  result: { operationId: string; sourceUrl: string; dataUrl: string };
} | { ok: false; error: string; code?: WebsitePopupScreenshotErrorCode };

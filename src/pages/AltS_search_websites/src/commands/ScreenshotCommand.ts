import type { PageActionCommand } from './types';

/**
 * Capture Screenshot (Visible Area)
 *
 * Closes the AltQ popup, waits 800ms for the closing animation to finish,
 * then sends a 'CAPTURE_VISIBLE_TAB' message to the background service worker
 * which saves the visible page view as a PNG to the Downloads folder.
 */
export const ScreenshotCommand: PageActionCommand = {
  id: 'capture_screenshot',
  label: 'Capture Screenshot',
  prefix: 'visiblescreen',
  keywords: ['capture', 'shot', 'image', 'photo', 'screen', 'visible', 'png'],
  description: 'Save the visible page area as a PNG to Downloads',
  action: 'CAPTURE_VISIBLE_TAB',
  needsPopupClose: true,
};

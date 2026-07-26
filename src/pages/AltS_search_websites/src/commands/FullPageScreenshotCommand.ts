import type { PageActionCommand } from './types';

/**
 * Capture Full Page Screenshot
 *
 * Closes the AltQ popup, waits 800ms for the closing animation to finish,
 * then sends a 'CAPTURE_FULL_PAGE' message to the background service worker.
 * The extension scrolls down the entire page automatically, stitches the frames
 * together, and exports a complete high-resolution PNG to the Downloads folder.
 */
export const FullPageScreenshotCommand: PageActionCommand = {
  id: 'capture_full_screenshot',
  label: 'Capture Full Page',
  prefix: 'fullscreenshot',
  keywords: ['capture', 'full', 'page', 'scroll', 'screenshot', 'whole', 'entire', 'png'],
  description: 'Scroll and stitch the entire page into a single PNG',
  action: 'CAPTURE_FULL_PAGE',
  needsPopupClose: true,
};

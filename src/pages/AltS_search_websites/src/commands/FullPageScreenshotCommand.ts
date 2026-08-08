import type { PageActionCommand } from './types';

export const FullPageScreenshotCommand: PageActionCommand = {
  id: 'capture_full_screenshot',
  label: 'Capture Full Page',
  prefix: 'fullscreenshot',
  keywords: ['capture', 'full', 'page', 'scroll', 'screenshot', 'whole', 'entire', 'png', 'jpg', 'pdf'],
  description: 'Scroll and stitch the entire page into a single image or PDF',
  action: 'CAPTURE_FULL_PAGE',
  needsPopupClose: true,
};

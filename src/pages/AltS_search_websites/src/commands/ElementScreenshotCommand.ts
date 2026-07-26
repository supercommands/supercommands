import type { PageActionCommand } from './types';

/**
 * Capture Element Screenshot
 *
 * Closes the AltQ popup, then sends an 'INIT_ELEMENT_SELECTION' message to
 * the background script. This activates an interactive on-page selector overlay.
 * As you hover, elements highlight, and clicking one captures just that specific
 * element as a PNG to the Downloads folder.
 */
export const ElementScreenshotCommand: PageActionCommand = {
  id: 'capture_element_screenshot',
  label: 'Capture Element',
  prefix: 'elementscreenshot',
  keywords: ['capture', 'element', 'part', 'select', 'pick', 'hover', 'screenshot', 'section'],
  description: 'Hover to highlight, click to capture any element as a PNG',
  action: 'INIT_ELEMENT_SELECTION',
  needsPopupClose: true,
};

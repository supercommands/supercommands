import type { PageActionCommand } from './types';

export const ClipOutScreenshotCommand: PageActionCommand = {
  id: 'capture_clip_screenshot',
  label: 'Clip & Download Screenshot',
  prefix: 'screen',
  keywords: ['clip', 'copy', 'screenshot', 'capture', 'shot', 'image', 'clipboard', 'png'],
  description: 'Save visible area as PNG to Downloads AND copy to Clipboard',
  action: 'CAPTURE_AND_CLIP_VISIBLE_TAB',
  needsPopupClose: true,
};

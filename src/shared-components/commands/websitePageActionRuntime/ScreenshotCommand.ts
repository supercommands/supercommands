import type { PageActionCommand } from './types';

export const ScreenshotCommand: PageActionCommand = {
    id: 'capture_screenshot',
    label: 'Capture Screenshot',
    prefix: 'visiblescreen',
    keywords: ['capture', 'shot', 'image', 'photo', 'screen', 'visible', 'png'],
    description: 'Save the visible page area as a PNG to Downloads',
    action: 'CAPTURE_VISIBLE_TAB',
    needsPopupClose: true,
};

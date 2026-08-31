import type { PageActionCommand } from './types';

/**
 * Download All Images
 *
 * Sends an 'execute_image_download' message with downloadType 'all' to the
 * background script. The extension scans the page, extracts all image sources,
 * and brings up a download manager interface so you can selectively or
 * bulk-download them.
 *
 * The AltQ popup closes first so the download manager UI renders cleanly.
 */
export const DownloadAllImagesCommand: PageActionCommand = {
  id: 'downloadallimages',
  label: 'Download All Images',
  prefix: 'dp',
  keywords: ['download', 'images', 'all', 'save', 'export', 'bulk', 'pictures', 'photos'],
  description: 'Scan the page and bulk-download all images',
  action: 'execute_image_download',
  needsPopupClose: false,
};

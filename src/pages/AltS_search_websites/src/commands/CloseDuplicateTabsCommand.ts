import type { PageActionCommand } from './types';

/**
 * Definition for the "Close Duplicate Tabs" page action command.
 * Closes all tabs that share the exact same URL.
 */
export const CloseDuplicateTabsCommand: PageActionCommand = {
  id: 'close_duplicate_tabs',
  label: 'Close Duplicate Tabs',
  prefix: 'cdt',
  keywords: ['close', 'duplicate', 'tabs', 'cdt'],
  description: 'Close all duplicate tabs with identical URLs across all windows',
  action: 'execute_close_duplicate_tabs',
  needsPopupClose: false,
};

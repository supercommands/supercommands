import type { PageActionCommand } from './types';

/**
 * Definition for the "Unmute All Tabs" page action command.
 * Unmutes all tabs in the current window.
 */
export const UnmuteAllTabsCommand: PageActionCommand = {
  id: 'unmute_all_tabs',
  label: 'Unmute All Tabs',
  prefix: 'unmute',
  keywords: ['unmute', 'tabs', 'sound', 'umat'],
  description: 'Unmute all open tabs in the current window',
  action: 'execute_unmute_all_tabs',
  needsPopupClose: false,
};

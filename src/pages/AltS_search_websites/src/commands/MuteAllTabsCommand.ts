import type { PageActionCommand } from './types';

/**
 * Definition for the "Mute All Tabs" page action command.
 * Mutes all tabs in the current window.
 */
export const MuteAllTabsCommand: PageActionCommand = {
  id: 'mute_all_tabs',
  label: 'Mute All Tabs',
  prefix: 'mute',
  keywords: ['mute', 'tabs', 'silence', 'mat'],
  description: 'Mute all open tabs in the current window',
  action: 'execute_mute_all_tabs',
  needsPopupClose: false,
};

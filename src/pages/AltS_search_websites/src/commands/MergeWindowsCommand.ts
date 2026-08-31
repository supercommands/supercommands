import type { PageActionCommand } from './types';

/**
 * Merge All Windows
 *
 * Sends an 'execute_merge_windows' message to the background script.
 * The background script will collect all tabs from all open Chrome windows
 * and move them into the current active window, closing the empty windows.
 */
export const MergeWindowsCommand: PageActionCommand = {
  id: 'merge_windows',
  label: 'Merge All Windows',
  prefix: 'merge',
  keywords: ['merge', 'windows', 'tabs', 'consolidate', 'group', 'mw'],
  description: 'Merge all open tabs from all windows into the current window',
  action: 'execute_merge_windows',
  needsPopupClose: false,
};

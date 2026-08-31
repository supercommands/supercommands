import type { PageActionCommand } from './types';

/**
 * Download All Tables
 *
 * Sends an 'execute_table_download' message with downloadType 'all' to the
 * background script. The extension parses all <table> elements on the current
 * page and automatically converts them to CSV files for download.
 *
 * The AltQ popup closes first so the download manager UI renders cleanly.
 */
export const DownloadAllTablesCommand: PageActionCommand = {
  id: 'downloadalltables',
  label: 'Download All Tables',
  prefix: 'tables',
  keywords: ['download', 'tables', 'all', 'save', 'export', 'csv', 'excel', 'data', 'spreadsheet'],
  description: 'Parse all <table> elements and download them as CSV files',
  action: 'execute_table_download',
  needsPopupClose: false,
};

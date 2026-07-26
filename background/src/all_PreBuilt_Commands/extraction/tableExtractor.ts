/**
 * @file tableExtractor.ts
 * @description Handles extraction of tabular data from the webpage.
 */
import { nowUtc } from '../../../../src/shared-components/utils';

export const handleTablesCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'execute_table_download') {
    (async () => {
      const { tabId, downloadType, options } = request;
      console.log('[Background] execute_table_download message received:', { tabId, downloadType, options });

      let targetTabId = tabId;
      if (!targetTabId && sender?.tab?.id) {
        targetTabId = sender.tab.id;
      }
      if (!targetTabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          targetTabId = activeTab.id;
        }
      }

      if (!chrome.scripting?.executeScript) {
        console.error('[Background] ✗ Scripting API not available');
        sendResponse({ ok: false, error: 'scripting_api_unavailable' });
        return;
      }

      if (typeof targetTabId !== 'number' || targetTabId <= 0) {
        console.error('[Background] ✗ Invalid tab ID:', targetTabId);
        sendResponse({ ok: false, error: 'invalid_tab_id' });
        return;
      }
      try {
        chrome.scripting.executeScript(
          {
            target: { tabId: targetTabId },
            func: async () => {
              console.log('[Injected Script] Initializing table extraction on page...');
              try {
                const tables = document.querySelectorAll('table');
                console.log('[Injected Script] Found tables count:', tables.length);
                if (tables.length === 0) {
                  alert('No tables found on this page.');
                  return { success: false, error: 'No tables found' };
                }

                const tableToCSV = (table: HTMLTableElement): string => {
                  const rows = table.querySelectorAll('tr');
                  const csvRows: string[] = [];

                  rows.forEach(row => {
                    const cells = row.querySelectorAll('th, td');
                    const rowData: string[] = [];

                    cells.forEach(cell => {
                      let text = (cell as HTMLElement).innerText || '';
                      text = text.replace(/"/g, '""');
                      if (text.includes(',') || text.includes('\n') || text.includes('"')) {
                        text = `"${text}"`;
                      }
                      rowData.push(text);
                    });

                    csvRows.push(rowData.join(','));
                  });

                  return csvRows.join('\n');
                };

                const downloadCSV = (csv: string, filename: string) => {
                  const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                  window.postMessage(
                    {
                      type: 'TASKLABS_DOWNLOAD_IMAGE',
                      dataUrl: dataUrl,
                      filename: filename,
                    },
                    '*',
                  );
                };

                const existingDialog = document.getElementById('tasklabs-table-dialog');
                if (existingDialog) {
                  existingDialog.parentElement?.removeChild(existingDialog);
                }

                const overlay = document.createElement('div');
                overlay.id = 'tasklabs-table-main-container';
                overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.1);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                font-family: system-ui, -apple-system, sans-serif;
                padding-right: 20px;
                box-sizing: border-box;
              `;

                const dialog = document.createElement('div');
                dialog.id = 'tasklabs-table-dialog';
                dialog.style.cssText = `
                width: 450px;
                max-width: 90vw;
                height: 90vh;
                max-height: 90vh;
                background: rgb(235 235 235 / 75%);
                backdrop-filter: blur(30px) saturate(180%);
                -webkit-backdrop-filter: blur(30px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                box-shadow: -10px 0 40px -10px rgba(0, 0, 0, 0.1);
                color: #1f2937;
                overflow: hidden;
              `;

                const header = document.createElement('div');
                header.style.cssText = `
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
              `;
                header.innerHTML = `
                <div>
                  <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Download Tables</h2>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">${tables.length} table(s) found</p>
                </div>
                <button id="tasklabs-table-close" style="
                  background: none;
                  border: none;
                  font-size: 24px;
                  cursor: pointer;
                  color: #6b7280;
                  padding: 4px 8px;
                  border-radius: 6px;
                  transition: background 0.2s;
                ">×</button>
              `;
                dialog.appendChild(header);

                const tableList = document.createElement('div');
                tableList.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 12px;
              `;

                const selectedTables = new Set<number>();

                tables.forEach((table, index) => {
                  const rows = table.querySelectorAll('tr').length;
                  const cols = table.querySelectorAll('tr:first-child th, tr:first-child td').length;
                  const headerText =
                    table.querySelector('th, caption')?.textContent?.substring(0, 50) || `Table ${index + 1}`;

                  const tableItem = document.createElement('div');
                  tableItem.dataset.tableIndex = String(index);
                  tableItem.style.cssText = `
                  display: flex;
                  align-items: center;
                  padding: 12px;
                  margin-bottom: 8px;
                  background: rgba(255, 255, 255, 0.5);
                  border: 2px solid transparent;
                  border-radius: 10px;
                  cursor: pointer;
                  transition: all 0.2s;
                `;

                  const checkbox = document.createElement('input');
                  checkbox.type = 'checkbox';
                  checkbox.style.cssText = `
                  width: 18px;
                  height: 18px;
                  margin-right: 12px;
                  cursor: pointer;
                `;
                  checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                      selectedTables.add(index);
                      tableItem.style.borderColor = '#3b82f6';
                      tableItem.style.background = 'rgba(59, 130, 246, 0.1)';
                    } else {
                      selectedTables.delete(index);
                      tableItem.style.borderColor = 'transparent';
                      tableItem.style.background = 'rgba(255, 255, 255, 0.5)';
                    }
                    updateDownloadButton();
                  });

                  const info = document.createElement('div');
                  info.style.cssText = 'flex: 1;';
                  info.innerHTML = `
                  <div style="font-weight: 500; font-size: 14px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${headerText}</div>
                  <div style="font-size: 12px; color: #6b7280;">${rows} rows × ${cols} columns</div>
                `;

                  const previewBtn = document.createElement('button');
                  previewBtn.textContent = 'Preview';
                  previewBtn.style.cssText = `
                  background: rgba(0, 0, 0, 0.05);
                  border: none;
                  padding: 6px 12px;
                  border-radius: 6px;
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.2s;
                `;
                  previewBtn.addEventListener('mouseenter', () => {
                    previewBtn.style.background = 'rgba(0, 0, 0, 0.1)';
                  });
                  previewBtn.addEventListener('mouseleave', () => {
                    previewBtn.style.background = 'rgba(0, 0, 0, 0.05)';
                  });
                  previewBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    table.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    table.style.outline = '3px solid #3b82f6';
                    setTimeout(() => {
                      table.style.outline = '';
                    }, 2000);
                  });

                  tableItem.appendChild(checkbox);
                  tableItem.appendChild(info);
                  tableItem.appendChild(previewBtn);

                  tableItem.addEventListener('click', e => {
                    if (
                      (e.target as HTMLElement).tagName !== 'INPUT' &&
                      (e.target as HTMLElement).tagName !== 'BUTTON'
                    ) {
                      checkbox.checked = !checkbox.checked;
                      checkbox.dispatchEvent(new Event('change'));
                    }
                  });

                  tableList.appendChild(tableItem);
                });

                dialog.appendChild(tableList);

                const footer = document.createElement('div');
                footer.style.cssText = `
                padding: 16px 20px;
                border-top: 1px solid rgba(0, 0, 0, 0.1);
                display: flex;
                gap: 10px;
              `;

                const selectAllBtn = document.createElement('button');
                selectAllBtn.textContent = 'Select All';
                selectAllBtn.style.cssText = `
                flex: 1;
                padding: 10px;
                background: rgba(0, 0, 0, 0.05);
                border: none;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.2s;
              `;
                selectAllBtn.addEventListener('click', () => {
                  const checkboxes = tableList.querySelectorAll(
                    'input[type="checkbox"]',
                  ) as NodeListOf<HTMLInputElement>;
                  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                  checkboxes.forEach(cb => {
                    cb.checked = !allChecked;
                    cb.dispatchEvent(new Event('change'));
                  });
                });

                const downloadBtn = document.createElement('button');
                downloadBtn.id = 'tasklabs-table-download';
                downloadBtn.textContent = 'Download Selected (0)';
                downloadBtn.disabled = true;
                downloadBtn.style.cssText = `
                flex: 2;
                padding: 10px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                opacity: 0.5;
              `;

                const updateDownloadButton = () => {
                  const count = selectedTables.size;
                  downloadBtn.textContent = `Download Selected (${count})`;
                  downloadBtn.disabled = count === 0;
                  downloadBtn.style.opacity = count === 0 ? '0.5' : '1';
                  downloadBtn.style.cursor = count === 0 ? 'not-allowed' : 'pointer';
                };

                downloadBtn.addEventListener('click', () => {
                  if (selectedTables.size === 0) return;

                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

                  selectedTables.forEach(index => {
                    const table = tables[index] as HTMLTableElement;
                    const csv = tableToCSV(table);
                    const filename = `table-${index + 1}-${timestamp}.csv`;
                    downloadCSV(csv, filename);
                  });

                  overlay.remove();
                });

                footer.appendChild(selectAllBtn);
                footer.appendChild(downloadBtn);
                dialog.appendChild(footer);

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                const closeBtn = document.getElementById('tasklabs-table-close');
                if (closeBtn) {
                  closeBtn.addEventListener('click', () => {
                    overlay.remove();
                    window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                  });
                }

                overlay.addEventListener('click', e => {
                  if (e.target === overlay) {
                    overlay.remove();
                    window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                  }
                });

                const escHandler = (e: KeyboardEvent) => {
                  if (e.key === 'Escape') {
                    overlay.remove();
                    window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                    document.removeEventListener('keydown', escHandler);
                  }
                };
                document.addEventListener('keydown', escHandler);

                return { success: true, tableCount: tables.length };
              } catch (error) {
                console.error('[Table Download] Error:', error);
                return { success: false, error: String(error) };
              }
            },
          },
          results => {
            sendResponse({ ok: true, results });
          },
        );
      } catch (error) {
        console.error('[Background] Error executing table download script:', error);
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }

  return undefined;
  return false;
  return undefined;
};

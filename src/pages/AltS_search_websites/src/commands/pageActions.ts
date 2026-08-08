/**
 * AltQ Page-Action Commands Registry
 *
 * This module owns all commands that execute directly on the current page
 * (screenshots, downloads) rather than navigating to a AltS_search_newtab URL.
 *
 * How they integrate with AltQ:
 *  - They are merged into the `allCommands` list so they appear in the
 *    "Commands" section of AltQ's board/list view.
 *  - When selected, `handleExecute` in App.tsx detects `category: 'page_action'`
 *    and calls `executePageActionCommand()` exported from this module instead of
 *    the normal AltS_search_newtab navigation path.
 */

import type { PageActionCommand } from './types';
import { ScreenshotCommand } from './ScreenshotCommand';
import { ClipOutScreenshotCommand } from './ClipOutScreenshotCommand';
import { FullPageScreenshotCommand } from './FullPageScreenshotCommand';
import { DownloadAllImagesCommand } from './DownloadAllImagesCommand';
import { DownloadAllTablesCommand } from './DownloadAllTablesCommand';
import { MergeWindowsCommand } from './MergeWindowsCommand';
import { CloseDuplicateTabsCommand } from './CloseDuplicateTabsCommand';
import { MuteAllTabsCommand } from './MuteAllTabsCommand';
import { UnmuteAllTabsCommand } from './UnmuteAllTabsCommand';
import { useUIStore } from '../../../../shared-components/uiStateManager';

/** All page-action commands in display order */
export const PAGE_ACTION_COMMANDS: PageActionCommand[] = [
  ScreenshotCommand,
  ClipOutScreenshotCommand,
  FullPageScreenshotCommand,
  DownloadAllImagesCommand,
  DownloadAllTablesCommand,
  MergeWindowsCommand,
  CloseDuplicateTabsCommand,
  MuteAllTabsCommand,
  UnmuteAllTabsCommand,
];

/**
 * Shape expected by AltQ's filtered.commands / allCommands arrays.
 * `category: 'page_action'` is the discriminator checked by handleExecute.
 */
export interface AltQPageActionItem {
  id: string;
  label: string;
  name: string; // AltQ uses 'name' for display
  prefix: string;
  keywords: string[];
  description?: string;
  category: 'page_action';
  isGlobal: false;
  // Execution metadata — carried through so handleExecute doesn't need a lookup
  _action: string;
  _needsPopupClose: boolean;
}

/** Convert PageActionCommand → AltQ list item */
function toAltQItem(cmd: PageActionCommand): AltQPageActionItem {
  return {
    id: cmd.id,
    label: cmd.label,
    name: cmd.label,
    prefix: cmd.prefix,
    keywords: cmd.keywords,
    description: cmd.description,
    category: 'page_action',
    isGlobal: false,
    _action: cmd.action,
    _needsPopupClose: cmd.needsPopupClose,
  };
}

/** Ready-to-use AltQ list items for all page-action commands */
export const PAGE_ACTION_ITEMS: AltQPageActionItem[] = PAGE_ACTION_COMMANDS.map(toAltQItem);

/**
 * Execute a page-action command.
 *
 * @param item  The AltQPageActionItem selected by the user
 * @param onClose  AltQ's close callback — called immediately so the popup
 *                 disappears before any capture/download happens
 */
export async function executePageActionCommand(item: AltQPageActionItem, onClose: () => void): Promise<void> {
  // Always close the AltQ popup first
  onClose();

  if (item._needsPopupClose) {
    // Wait for the popup close animation (same 800ms grace as AltS used)
    await new Promise<void>(resolve => setTimeout(resolve, 800));
  }

  const action = item._action || (item as any).action || item.id;

  try {
    if (action === 'execute_image_download') {
      // Download All Images — opens the download manager UI
      chrome.runtime.sendMessage({ action, downloadType: 'all', options: {} }, response => {
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_image_download failed:', chrome.runtime.lastError);
        } else {
          useUIStore.getState().queueNotification({ message: '🖼️ Downloading all images...', type: 'success' });
        }
      });
    } else if (action === 'execute_table_download') {
      // Download All Tables — converts tables to CSV
      chrome.runtime.sendMessage({ action, downloadType: 'all', options: {} }, response => {
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_table_download failed:', chrome.runtime.lastError);
        } else {
          useUIStore.getState().queueNotification({ message: '📊 Downloading all tables...', type: 'success' });
        }
      });
    } else if (action === 'CAPTURE_VISIBLE_TAB' || action === 'CAPTURE_AND_CLIP_VISIBLE_TAB') {
      const isClip = action === 'CAPTURE_AND_CLIP_VISIBLE_TAB';
      chrome.runtime.sendMessage({ action }, response => {
        if (chrome.runtime.lastError) {
          // Port closed due to popup unmounting; task continues in background
          console.log('[AltQ PageAction] Message sent to background service worker.');
        } else if (response?.success) {
          useUIStore.getState().queueNotification({
            message: isClip
              ? '📋 Image copied to Clipboard & saved to Downloads!'
              : '📸 Screenshot saved to Downloads',
            type: 'success',
          });
        }
      });
    } else if (action === 'CAPTURE_FULL_PAGE') {
      showFormatSelectionModal(async (format) => {
        const bgAction = `CAPTURE_FULL_PAGE_${format}`;
        const response = await chrome.runtime.sendMessage({ action: bgAction });
        if (response?.success) {
          useUIStore.getState().queueNotification({ message: `📄 Full page screenshot saved as ${format}`, type: 'success' });
        } else {
          console.error(`[AltQ PageAction] ${bgAction} failed:`, response?.error);
        }
      });
    } else if (action === 'execute_merge_windows') {
      console.log('[AltQ PageAction] Sending execute_merge_windows message to background...');
      chrome.runtime.sendMessage({ action }, response => {
        console.log('[AltQ PageAction] execute_merge_windows response:', response);
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_merge_windows failed with lastError:', chrome.runtime.lastError);
        } else {
          useUIStore.getState().queueNotification({ message: '🪟 All windows merged!', type: 'success' });
        }
      });
    } else if (action === 'execute_close_duplicate_tabs') {
      console.log('[AltQ PageAction] Sending execute_close_duplicate_tabs message to background...');
      chrome.runtime.sendMessage({ action }, response => {
        console.log('[AltQ PageAction] execute_close_duplicate_tabs response:', response);
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_close_duplicate_tabs failed:', chrome.runtime.lastError);
        } else if (response?.success) {
          const count = response.count || 0;
          if (count > 0) {
            useUIStore.getState().queueNotification({ message: `🗑️ Closed ${count} duplicate tab${count > 1 ? 's' : ''}!`, type: 'success' });
          } else {
            useUIStore.getState().queueNotification({ message: '👍 No duplicate tabs found!', type: 'success' });
          }
        }
      });
    } else if (action === 'execute_mute_all_tabs') {
      console.log('[AltQ PageAction] Sending execute_mute_all_tabs message to background...');
      chrome.runtime.sendMessage({ action }, response => {
        console.log('[AltQ PageAction] execute_mute_all_tabs response:', response);
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_mute_all_tabs failed:', chrome.runtime.lastError);
        } else if (response?.success) {
          const count = response.count || 0;
          if (count > 0) {
            useUIStore.getState().queueNotification({ message: `🔇 Muted ${count} tab${count > 1 ? 's' : ''}!`, type: 'success' });
          } else {
            useUIStore.getState().queueNotification({ message: '👍 No tabs to mute!', type: 'success' });
          }
        } else {
          console.error('[AltQ PageAction] execute_mute_all_tabs returned error:', response?.error);
          useUIStore.getState().queueNotification({ message: `❌ Error muting tabs: ${response?.error}`, type: 'error' });
        }
      });
    } else if (action === 'execute_unmute_all_tabs') {
      console.log('[AltQ PageAction] Sending execute_unmute_all_tabs message to background...');
      chrome.runtime.sendMessage({ action }, response => {
        console.log('[AltQ PageAction] execute_unmute_all_tabs response:', response);
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_unmute_all_tabs failed:', chrome.runtime.lastError);
        } else if (response?.success) {
          const count = response.count || 0;
          if (count > 0) {
            useUIStore.getState().queueNotification({ message: `🔊 Unmuted ${count} tab${count > 1 ? 's' : ''}!`, type: 'success' });
          } else {
            useUIStore.getState().queueNotification({ message: '👍 No tabs to unmute!', type: 'success' });
          }
        } else {
          console.error('[AltQ PageAction] execute_unmute_all_tabs returned error:', response?.error);
          useUIStore.getState().queueNotification({ message: `❌ Error unmuting tabs: ${response?.error}`, type: 'error' });
        }
      });
    } else {
      console.warn('[AltQ PageAction] Unknown action:', action);
    }
  } catch (err: any) {
    console.error('[AltQ PageAction] Error executing page action:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helper — creates standalone DOM toast on host page/portal host
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Internal helper — creates standalone DOM modal for format selection
// ---------------------------------------------------------------------------
function showFormatSelectionModal(onSelect: (format: 'PNG' | 'JPG' | 'PDF') => void): void {
  const container = document.body;
  const modalId = `altq-format-modal-${Date.now()}`;
  
  // Detect current active theme from storage or system preference
  const applyThemeToModal = (dialog: HTMLElement, title: HTMLElement, cancelBtn: HTMLElement, buttons: HTMLButtonElement[]) => {
    chrome.storage.local.get(['theme', 'example-theme-storage'], (result) => {
      const storedTheme = result.theme || result['example-theme-storage'];
      const isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        dialog.style.background = '#1e1e2d';
        dialog.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        dialog.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.6)';
        title.style.color = '#f3f4f6';
        
        buttons.forEach(btn => {
          btn.style.background = 'rgba(255, 255, 255, 0.08)';
          btn.style.color = '#e5e7eb';
          btn.style.border = '1px solid rgba(255, 255, 255, 0.12)';
          
          btn.onmouseover = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.16)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            btn.style.color = '#ffffff';
          };
          btn.onmouseout = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.08)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            btn.style.color = '#e5e7eb';
          };
        });

        cancelBtn.style.color = '#9ca3af';
        cancelBtn.onmouseover = () => cancelBtn.style.color = '#f3f4f6';
        cancelBtn.onmouseout = () => cancelBtn.style.color = '#9ca3af';
      } else {
        dialog.style.background = '#ffffff';
        dialog.style.border = '1px solid rgba(0, 0, 0, 0.08)';
        dialog.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
        title.style.color = '#111827';

        buttons.forEach(btn => {
          btn.style.background = '#f3f4f6';
          btn.style.color = '#374151';
          btn.style.border = '1px solid #e5e7eb';

          btn.onmouseover = () => {
            btn.style.background = '#e5e7eb';
            btn.style.borderColor = '#d1d5db';
            btn.style.color = '#111827';
          };
          btn.onmouseout = () => {
            btn.style.background = '#f3f4f6';
            btn.style.borderColor = '#e5e7eb';
            btn.style.color = '#374151';
          };
        });

        cancelBtn.style.color = '#6b7280';
        cancelBtn.onmouseover = () => cancelBtn.style.color = '#111827';
        cancelBtn.onmouseout = () => cancelBtn.style.color = '#6b7280';
      }
    });
  };

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2147483647;';
  
  const dialog = document.createElement('div');
  dialog.style.cssText = 'padding:24px 28px;border-radius:16px;display:flex;flex-direction:column;gap:20px;font-family:Inter,system-ui,sans-serif;min-width:320px;transition:all 0.2s ease;';
  
  const title = document.createElement('div');
  title.textContent = 'Save Full Page As...';
  title.style.cssText = 'font-weight:600;font-size:16px;text-align:center;letter-spacing:-0.01em;';
  
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';
  
  const createdButtons: HTMLButtonElement[] = [];

  const createBtn = (text: string, format: 'PNG' | 'JPG' | 'PDF') => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.cssText = `flex:1;padding:10px 18px;border-radius:10px;cursor:pointer;font-weight:600;font-size:14px;transition:all 0.15s ease-in-out;outline:none;`;
    btn.onmousedown = () => btn.style.transform = 'scale(0.96)';
    btn.onmouseup = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => {
      overlay.remove();
      onSelect(format);
    };
    createdButtons.push(btn);
    return btn;
  };
  
  btnRow.appendChild(createBtn('PDF', 'PDF'));
  btnRow.appendChild(createBtn('PNG', 'PNG'));
  btnRow.appendChild(createBtn('JPG', 'JPG'));
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:2px;padding:8px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:500;transition:color 0.2s ease;outline:none;';
  cancelBtn.onclick = () => overlay.remove();
  
  applyThemeToModal(dialog, title, cancelBtn, createdButtons);

  dialog.appendChild(title);
  dialog.appendChild(btnRow);
  dialog.appendChild(cancelBtn);
  overlay.appendChild(dialog);
  container.appendChild(overlay);
}

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
import { FullPageScreenshotCommand } from './FullPageScreenshotCommand';
import { DownloadAllImagesCommand } from './DownloadAllImagesCommand';
import { DownloadAllTablesCommand } from './DownloadAllTablesCommand';

/** All page-action commands in display order */
export const PAGE_ACTION_COMMANDS: PageActionCommand[] = [
  ScreenshotCommand,
  FullPageScreenshotCommand,
  DownloadAllImagesCommand,
  DownloadAllTablesCommand,
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

  const action = item._action;

  try {
    if (action === 'execute_image_download') {
      // Download All Images — opens the download manager UI
      chrome.runtime.sendMessage({ action, downloadType: 'all', options: {} }, response => {
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_image_download failed:', chrome.runtime.lastError);
        } else {
        }
      });
    } else if (action === 'execute_table_download') {
      // Download All Tables — converts tables to CSV
      chrome.runtime.sendMessage({ action, downloadType: 'all', options: {} }, response => {
        if (chrome.runtime.lastError) {
          console.error('[AltQ PageAction] execute_table_download failed:', chrome.runtime.lastError);
        } else {
        }
      });
    } else if (action === 'CAPTURE_VISIBLE_TAB') {
      // Visible-area screenshot → saved to Downloads
      const response = await chrome.runtime.sendMessage({ action });
      if (response?.success) {
        showAltQToast('📸 Screenshot saved to Downloads', '#1a73e8');
      } else {
        console.error('[AltQ PageAction] CAPTURE_VISIBLE_TAB failed:', response?.error);
      }
    } else if (action === 'CAPTURE_FULL_PAGE') {
      // Full-page screenshot (scrolls, stitches, saves)
      const response = await chrome.runtime.sendMessage({ action });
      if (response?.success) {
        showAltQToast('📄 Full page screenshot saved to Downloads', '#1a73e8');
      } else {
        console.error('[AltQ PageAction] CAPTURE_FULL_PAGE failed:', response?.error);
      }
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
function showAltQToast(message: string, bg = '#1a73e8'): void {
  const container =
    (window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__ || document.body;
  const toastId = `altq-page-action-toast-${Date.now()}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    `background:${bg}`,
    'color:white',
    'padding:10px 22px',
    'border-radius:20px',
    'z-index:2147483647',
    'font-family:system-ui,sans-serif',
    'font-size:13px',
    'font-weight:600',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'transition:opacity 0.2s ease-in-out',
  ].join(';');
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}


/**
 * @file sessionSettings.ts
 * @description Manages session open behavior settings. These settings control
 * how session links are opened (same window vs new window), tab pinning behavior,
 * and auto-save preferences.
 */

export interface SessionOpenSettings {
  /** Whether to open session tabs in the current window or a new window */
  openMode: 'same_window' | 'new_window';

  /** Auto-save behavior: append closed/opened tabs, sync exactly to window, or dont save */
  autoSaveMode: 'auto_save' | 'dont_save';

  /** Whether same-window launch should clear the window before opening the session */
  focusWindow?: boolean;

  /** Whether the session editor newtab itself should be pinned when opening a session */
  pinSessionTab?: boolean;
}

export const DEFAULT_SESSION_SETTINGS: SessionOpenSettings = {
  openMode: 'new_window',
  autoSaveMode: 'auto_save',
  focusWindow: false,
  pinSessionTab: true,
};

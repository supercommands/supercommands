/**
 * @file sessionSettings.ts
 * @description Manages session open behavior settings. These settings control
 * how session links are opened (same window vs new window), tab pinning behavior,
 * and auto-save preferences.
 */
export interface SessionOpenSettings {
    /** Whether to open session tabs in the current window or a new window */
    openMode: 'same_window' | 'new_window';
    /** Whether to open session tabs in a new tab in the current window without replacing current tab */
    openInNewTab?: boolean;
    /** Auto-save behavior: append closed/opened tabs, sync exactly to window, or dont save */
    autoSaveMode: 'auto_save' | 'dont_save';
    /** Canonical switch for session focus restrictions and managed loading. */
    focusMode: boolean;
    /** Whether same-window launch should clear the window before opening the session */
    focusWindow?: boolean;
    /** Whether the session editor newtab itself should be pinned when opening a session */
    pinSessionTab?: boolean;
    /** Whether running this session should restrict browsing to allowed domains */
    deepFocusMode?: boolean;
    /** Manually allowed exact hostnames for deep focus mode */
    deepFocusAllowedDomains?: string[];
    /** Auto-derived session-link hostnames the user removed from Deep Focus allowance */
    deepFocusBlockedDomains?: string[];
}
export const DEFAULT_SESSION_SETTINGS: SessionOpenSettings = {
    openMode: 'new_window',
    openInNewTab: false,
    autoSaveMode: 'dont_save',
    focusMode: false,
    pinSessionTab: true,
    deepFocusAllowedDomains: [],
    deepFocusBlockedDomains: [],
};
export function normalizeSessionOpenSettings(settings?: Partial<SessionOpenSettings> | null): SessionOpenSettings {
    const focusMode = typeof settings?.focusMode === 'boolean'
        ? settings.focusMode
        : settings?.focusWindow === true || settings?.deepFocusMode === true;
    const next: SessionOpenSettings = {
        ...DEFAULT_SESSION_SETTINGS,
        ...(settings || {}),
        focusMode,
    };
    delete next.focusWindow;
    delete next.deepFocusMode;
    if (next.openMode === 'new_window') {
        next.openInNewTab = false;
        return next;
    }
    next.openMode = 'same_window';
    return next;
}

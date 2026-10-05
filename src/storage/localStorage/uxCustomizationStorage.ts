export type TodoDisplayMode = 'collapse' | 'data-blur' | 'pin';
// --- Todo Display Mode Handle Storage ---
export const getStoredTodoDisplayMode = async (): Promise<TodoDisplayMode> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['todo_display_mode'], resolve));
            return result.todo_display_mode || 'collapse';
        }
    }
    catch (e) {
        console.error('Failed to get stored todo display mode:', e);
    }
    return 'collapse';
};
export const setStoredTodoDisplayMode = async (mode: TodoDisplayMode): Promise<void> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            await new Promise<void>(resolve => chromeAny.storage.local.set({ todo_display_mode: mode }, resolve));
        }
    }
    catch (e) {
        console.error('Failed to store todo display mode:', e);
    }
};
export type TodoSheetGroupingModePreference = 'default' | 'priority';
export const getStoredTodoSheetGroupingMode = async (): Promise<TodoSheetGroupingModePreference> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['todo_sheet_grouping_mode'], resolve));
            return result.todo_sheet_grouping_mode === 'priority' ? 'priority' : 'default';
        }
    }
    catch (e) {
        console.error('Failed to get stored todo sheet grouping mode:', e);
    }
    return 'default';
};
export const setStoredTodoSheetGroupingMode = async (mode: TodoSheetGroupingModePreference): Promise<void> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            await new Promise<void>(resolve => chromeAny.storage.local.set({ todo_sheet_grouping_mode: mode }, resolve));
        }
    }
    catch (e) {
        console.error('Failed to store todo sheet grouping mode:', e);
    }
};
// --- Search Handle Focus Preferences Storage ---
export const getStoredSearchFocusPreference = async (): Promise<boolean> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['rtq_focus_on'], resolve));
            return result.rtq_focus_on !== false; // Default to true
        }
    }
    catch (e) {
        console.error('Failed to get search focus preference:', e);
    }
    return true;
};
export const setStoredSearchFocusPreference = async (focusOn: boolean): Promise<void> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            await new Promise<void>(resolve => chromeAny.storage.local.set({ rtq_focus_on: focusOn }, resolve));
        }
    }
    catch (e) {
        console.error('Failed to store search focus preference:', e);
    }
};
// --- Alt+S Website Backdrop Blur Preference ---
// Older versions stored a boolean under this key. Keep reading that shape so
// an enabled preference retains the previous 8px appearance after upgrading.
export const ALT_S_WEBSITE_BACKDROP_BLUR_KEY = 'alt_s_website_backdrop_blur_enabled';
export const DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH = 0;
export const LEGACY_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH = 80;
export type AltSWebsiteBackdropBlurPreference = number | boolean;
export const normalizeAltSWebsiteBackdropBlurStrength = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(100, Math.max(0, Math.round(value)));
    }
    return value === true ? LEGACY_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH : DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH;
};
export const getAltSWebsiteBackdropBlurPixels = (value: unknown): number => normalizeAltSWebsiteBackdropBlurStrength(value) / 10;
export type LayoutViewMode = 'board' | 'sheet';
export const getStoredLayoutViewMode = async (): Promise<LayoutViewMode> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['new_tab_view_mode_temp'], resolve));
            return result.new_tab_view_mode_temp || 'board';
        }
    }
    catch (e) {
        console.error('Failed to get stored layout view mode:', e);
    }
    return 'board';
};
export const setStoredLayoutViewMode = async (mode: LayoutViewMode): Promise<void> => {
    try {
        const chromeAny = (globalThis as any).chrome;
        if (chromeAny?.storage?.local) {
            await new Promise<void>(resolve => chromeAny.storage.local.set({ new_tab_view_mode_temp: mode }, resolve));
        }
    }
    catch (e) {
        console.error('Failed to store layout view mode:', e);
    }
};

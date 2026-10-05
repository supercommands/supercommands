import { DEFAULT_THEME_ID, isValidThemeId, migrateThemeId } from '@extension/ui/lib/theme/registry';
import { CRITICAL_THEME_TOKEN_KEYS, resolveNewTabTheme } from '@extension/ui/lib/theme/resolveNewTabTheme';
import type { ThemeProfile } from '@extension/ui/lib/theme/types';
import { BRAND } from '../../../shared-components/brandingConfig';
/**
 * Gate script - runs BEFORE React to decide: redirect or show.
 * This script either:
 * 1. Redirects to chrome://newtab if disabled (before anything renders)
 * 2. Applies the focus hack if enabled (bypasses omnibox stealing focus)
 * 3. Applies a critical first-frame theme before React mounts
 */
const THEME_STARTUP_HINT_KEY = BRAND.storageKeys.themeStartupHint;
const LEGACY_THEME_STARTUP_HINT_KEY = BRAND.legacyStorageKeys.themeStartupHint;
const THEME_STARTUP_SNAPSHOT_KEY = BRAND.storageKeys.themeStartupSnapshot;
const LEGACY_THEME_STARTUP_SNAPSHOT_KEY = BRAND.legacyStorageKeys.themeStartupSnapshot;
const WALLPAPER_STARTUP_HINT_KEY = BRAND.storageKeys.wallpaperStartupHint;
const LEGACY_WALLPAPER_STARTUP_HINT_KEY = BRAND.legacyStorageKeys.wallpaperStartupHint;
const applyGateDecision = ({ omniboxOverrideEnabled, hasFocusParam, }: {
    omniboxOverrideEnabled: boolean;
    hasFocusParam: boolean;
}) => {
    if (!omniboxOverrideEnabled) {
        showBody();
        return;
    }
    if (!hasFocusParam) {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('focus') !== 'true') {
            currentUrl.searchParams.set('focus', 'true');
            window.location.replace(currentUrl.toString());
        }
        return;
    }
    showBody();
};
function resolveThemeId(id: string | undefined | null): string {
    if (id && isValidThemeId(id))
        return id;
    if (id) {
        const migrated = migrateThemeId(id);
        if (isValidThemeId(migrated))
            return migrated;
    }
    return DEFAULT_THEME_ID;
}
function readThemeStartupHint(): string | undefined {
    try {
        return (window.localStorage?.getItem(THEME_STARTUP_HINT_KEY) ||
            window.localStorage?.getItem(LEGACY_THEME_STARTUP_HINT_KEY));
    }
    catch {
        return undefined;
    }
}
function readWallpaperStartupHint(): string {
    try {
        return (window.localStorage?.getItem(WALLPAPER_STARTUP_HINT_KEY) ||
            window.localStorage?.getItem(LEGACY_WALLPAPER_STARTUP_HINT_KEY) ||
            'none');
    }
    catch {
        return 'none';
    }
}
function writeThemeStartupHint(id: string): void {
    try {
        window.localStorage?.setItem(THEME_STARTUP_HINT_KEY, id);
    }
    catch {
        // localStorage is only a startup hint; chrome.storage remains canonical.
    }
}
function isPackagedWallpaperId(id: unknown): id is string {
    return typeof id === 'string' && id !== 'none' && id !== 'custom' && /^[A-Za-z0-9._-]+$/.test(id);
}
function writeWallpaperStartupHint(id: unknown): void {
    try {
        if (id === 'custom' || isPackagedWallpaperId(id)) {
            window.localStorage?.setItem(WALLPAPER_STARTUP_HINT_KEY, id);
        }
        else {
            window.localStorage?.setItem(WALLPAPER_STARTUP_HINT_KEY, 'none');
        }
    }
    catch {
        // localStorage is only a startup hint; chrome.storage remains canonical.
    }
}
function writeCriticalThemeStartupSnapshot(theme: ThemeProfile): void {
    try {
        const tokens: Record<string, string> = {};
        CRITICAL_THEME_TOKEN_KEYS.forEach(key => {
            const value = theme.tokens[key];
            if (value !== undefined) {
                tokens[key] = value;
            }
        });
        window.localStorage?.setItem(THEME_STARTUP_SNAPSHOT_KEY, JSON.stringify({
            themeId: theme.id,
            isDark: Boolean(theme.isDark),
            glassBlur: theme.glassBlur || '12px',
            tokens,
        }));
    }
    catch {
        // The snapshot is only a first-paint optimization.
    }
}
function applyCriticalTheme(theme: ThemeProfile | undefined): void {
    if (!theme)
        return;
    const root = document.documentElement;
    root.classList.toggle('dark', Boolean(theme.isDark));
    root.style.colorScheme = theme.isDark ? 'dark' : 'light';
    root.dataset.appearanceThemeId = theme.id;
    CRITICAL_THEME_TOKEN_KEYS.forEach(key => {
        const value = theme.tokens[key];
        if (value !== undefined) {
            root.style.setProperty(`--color-${key}`, value);
        }
    });
    root.style.setProperty('--glass-blur', `blur(${theme.glassBlur || '12px'}) saturate(1.2)`);
    root.style.setProperty('--color-backdrop', `blur(${theme.glassBlur || '12px'}) saturate(1.2)`);
}
// Synchronous first-frame guard: use the last selected theme hint before async chrome.storage resolves.
applyCriticalTheme(resolveNewTabTheme(resolveThemeId(readThemeStartupHint()), readWallpaperStartupHint()));
(async () => {
    try {
        // Check if chrome.storage.local is available
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            showBody();
            return;
        }
        const url = new URL(window.location.href);
        const hasFocusParam = url.searchParams.get('focus') === 'true' || url.searchParams.get('focus_sheet_ui_first_column') === 'true';
        let decided = false;
        // Optimistic fast-path: if storage doesn't respond in 40ms, assume defaults to avoid blank screen
        const optimisticTimer = window.setTimeout(() => {
            if (decided)
                return;
            decided = true;
            applyGateDecision({
                omniboxOverrideEnabled: false,
                hasFocusParam,
            });
        }, 40);
        // Load theme and settings together to ensure theme is applied before body is shown
        // Read canonical 'theme-id-storage-key', obsolete 'appearance-theme', AND legacy 'theme' key for migration compat
        const result = await chrome.storage.local.get([
            'theme-id-storage-key',
            'appearance-theme',
            'theme',
            'omnibox_override_enabled',
            'wallpaper-id-storage-key'
        ]);
        let canonicalId: string | undefined = result['theme-id-storage-key'];
        const obsoleteAppearanceThemeId: unknown = result['appearance-theme'];
        const legacyId: string | undefined = result['theme'];
        // Legacy migration only. Do not use as a current theme source.
        if (!canonicalId && typeof obsoleteAppearanceThemeId === 'string' && obsoleteAppearanceThemeId.trim() !== '') {
            canonicalId = obsoleteAppearanceThemeId;
            try {
                await chrome.storage.local.set({ 'theme-id-storage-key': obsoleteAppearanceThemeId });
            }
            catch (err) {
                console.warn('[gate.ts] Failed to migrate appearance-theme to theme-id-storage-key:', err);
            }
        }
        if (result['appearance-theme'] !== undefined) {
            try {
                const checkLocal = await chrome.storage.local.get(['theme-id-storage-key']);
                if (checkLocal['theme-id-storage-key']) {
                    await chrome.storage.local.remove('appearance-theme');
                }
            }
            catch (err) {
                console.warn('[gate.ts] Failed to remove obsolete appearance-theme key:', err);
            }
        }
        const resolvedThemeId = resolveThemeId(canonicalId || legacyId);
        const storedWallpaperId = result['wallpaper-id-storage-key'] || 'none';
        const resolvedTheme = resolveNewTabTheme(resolvedThemeId, storedWallpaperId);
        applyCriticalTheme(resolvedTheme);
        writeThemeStartupHint(resolvedThemeId);
        writeCriticalThemeStartupSnapshot(resolvedTheme);
        writeWallpaperStartupHint(storedWallpaperId);
        const resolved = {
            omniboxOverrideEnabled: result.omnibox_override_enabled !== false,
        };
        if (!decided) {
            decided = true;
            window.clearTimeout(optimisticTimer);
            applyGateDecision({
                omniboxOverrideEnabled: resolved.omniboxOverrideEnabled,
                hasFocusParam,
            });
        }
    }
    catch (error) {
        // On any error, show the page to avoid blank screen
        console.warn('[gate.ts] Error:', error);
        showBody();
    }
})();
/**
 * Helper to show the body (unhide from CSS display:none)
 */
function showBody() {
    // Body is no longer hidden by default to prevent a loading screen.
    return;
}

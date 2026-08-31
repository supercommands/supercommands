import { DEFAULT_THEME_ID, getTheme, isValidThemeId, migrateThemeId } from '@extension/ui/lib/theme/registry';
import type { ThemeProfile } from '@extension/ui/lib/theme/types';

/**
 * Gate script - runs BEFORE React to decide: redirect or show.
 * This script either:
 * 1. Redirects to chrome://newtab if disabled (before anything renders)
 * 2. Applies the focus hack if enabled (bypasses omnibox stealing focus)
 * 3. Applies a critical first-frame theme before React mounts
 */

const THEME_STARTUP_HINT_KEY = 'cmdos_theme_id_startup_hint';
const THEME_STARTUP_SNAPSHOT_KEY = 'cmdos_theme_startup_snapshot';
const CRITICAL_THEME_TOKEN_KEYS = [
  'appBg',
  'rootBg',
  'sidebarBg',
  'panelBg',
  'cardBg',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'borderDefault',
  'backgroundGradient',
] as const;

const applyGateDecision = ({
  omniboxOverrideEnabled,
  hasFocusParam,
}: {
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
  if (id && isValidThemeId(id)) return id;
  if (id) {
    const migrated = migrateThemeId(id);
    if (isValidThemeId(migrated)) return migrated;
  }
  return DEFAULT_THEME_ID;
}

function readThemeStartupHint(): string | undefined {
  try {
    return window.localStorage?.getItem(THEME_STARTUP_HINT_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function writeThemeStartupHint(id: string): void {
  try {
    window.localStorage?.setItem(THEME_STARTUP_HINT_KEY, id);
  } catch {
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

    window.localStorage?.setItem(
      THEME_STARTUP_SNAPSHOT_KEY,
      JSON.stringify({
        themeId: theme.id,
        isDark: Boolean(theme.isDark),
        glassBlur: theme.glassBlur || '12px',
        tokens,
      }),
    );
  } catch {
    // The snapshot is only a first-paint optimization.
  }
}

function applyCriticalTheme(theme: ThemeProfile | undefined): void {
  if (!theme) return;

  const root = document.documentElement;
  root.classList.toggle('dark', Boolean(theme.isDark));
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
applyCriticalTheme(getTheme(resolveThemeId(readThemeStartupHint())));

(async () => {
  try {
    // Check if chrome.storage.local is available
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      showBody();
      return;
    }

    const url = new URL(window.location.href);
    const hasFocusParam =
      url.searchParams.get('focus') === 'true' || url.searchParams.get('focus_sheet_ui_first_column') === 'true';

    let decided = false;
    // Optimistic fast-path: if storage doesn't respond in 40ms, assume defaults to avoid blank screen
    const optimisticTimer = window.setTimeout(() => {
      if (decided) return;
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
      'new_tab_is_dark_mode',
      'new_tab_dark_mode',
      'omnibox_override_enabled',
    ]);

    let canonicalId: string | undefined = result['theme-id-storage-key'];
    const obsoleteAppearanceThemeId: unknown = result['appearance-theme'];
    const legacyId: string | undefined = result['theme'];

    // Legacy migration only. Do not use as a current theme source.
    if (!canonicalId && typeof obsoleteAppearanceThemeId === 'string' && obsoleteAppearanceThemeId.trim() !== '') {
      canonicalId = obsoleteAppearanceThemeId;
      try {
        await chrome.storage.local.set({ 'theme-id-storage-key': obsoleteAppearanceThemeId });
      } catch (err) {
        console.warn('[gate.ts] Failed to migrate appearance-theme to theme-id-storage-key:', err);
      }
    }

    if (result['appearance-theme'] !== undefined) {
      try {
        const checkLocal = await chrome.storage.local.get(['theme-id-storage-key']);
        if (checkLocal['theme-id-storage-key']) {
          await chrome.storage.local.remove('appearance-theme');
        }
      } catch (err) {
        console.warn('[gate.ts] Failed to remove obsolete appearance-theme key:', err);
      }
    }

    const resolvedThemeId = resolveThemeId(canonicalId || legacyId);
    const resolvedTheme = getTheme(resolvedThemeId);
    applyCriticalTheme(resolvedTheme);
    writeThemeStartupHint(resolvedThemeId);
    writeCriticalThemeStartupSnapshot(resolvedTheme);

    if (result.new_tab_is_dark_mode === false && resolvedTheme?.isDark) {
      document.documentElement.classList.remove('dark');
    }

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
  } catch (error) {
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

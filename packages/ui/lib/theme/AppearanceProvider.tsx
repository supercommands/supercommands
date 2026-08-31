import type React from 'react';
import { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { appearanceThemeStorage, appearanceWallpaperStorage, appearanceBrightnessStorage, appearanceWarmTintStorage, appearanceWarmTintStrengthStorage } from '@extension/storage';
import type { ThemeProfile } from './types';
import { getTheme, getRandomValidThemeId, isValidThemeId, assertThemeInvariants, migrateThemeId, DEFAULT_THEME_ID } from './registry';
import { normalizeBrightness, DEFAULT_APPEARANCE_BRIGHTNESS, brightnessLevelToFactor } from './brightness';
import { normalizeWarmTintStrength, DEFAULT_WARM_TINT_STRENGTH } from './warmTint';

interface AppearanceContextType {
  theme: ThemeProfile;
  themeId: string;
  setTheme: (id: string) => Promise<void>;
  wallpaperId: string;
  setWallpaper: (id: string) => Promise<void>;
  brightness: number;
  setBrightness: (val: number) => Promise<void>;
  resetBrightness: () => Promise<void>;
  warmTintEnabled: boolean;
  setWarmTintEnabled: (enabled: boolean) => Promise<void>;
  warmTintStrength: number;
  setWarmTintStrength: (strength: number) => Promise<void>;
  resetWarmTintStrength: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

function applyOpacity(color: string, opacity: number) {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  } else if (color.startsWith('hsl(')) {
    return color.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
  } else if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  return color;
}

const getCurrentExtensionVersion = (): string => {
  try {
    const chromeAny = (window as any).chrome;
    return chromeAny?.runtime?.getManifest?.()?.version || '0.0.1';
  } catch {
    return '0.0.1';
  }
};
const LAST_KNOWN_VERSION_KEY = 'extension_last_known_version';
const THEME_STARTUP_HINT_KEY = 'cmdos_theme_id_startup_hint';
const THEME_STARTUP_SNAPSHOT_KEY = 'cmdos_theme_startup_snapshot';
const WARM_TINT_STARTUP_HINT_KEY = 'cmdos_warm_tint_startup_hint';
const WARM_TINT_STRENGTH_STARTUP_HINT_KEY = 'cmdos_warm_tint_strength_startup_hint';
const CRITICAL_THEME_TOKEN_KEYS = [
  'appBg',
  'rootBg',
  'sidebarBg',
  'appSidebarBg',
  'panelBg',
  'cardBg',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'borderDefault',
  'noteLibraryIcon',
  'backgroundGradient',
] as const;

const resolveAndMigrateThemeId = (id: string | null | undefined): { resolvedId: string; needsMigration: boolean } => {
  if (!id) {
    return { resolvedId: DEFAULT_THEME_ID, needsMigration: true };
  }
  if (isValidThemeId(id)) {
    return { resolvedId: id, needsMigration: false };
  }
  // Attempt legacy migration
  const migrated = migrateThemeId(id);
  if (isValidThemeId(migrated)) {
    return { resolvedId: migrated, needsMigration: true };
  }
  // Unknown ID — fall back to default
  return { resolvedId: DEFAULT_THEME_ID, needsMigration: true };
};

const readThemeStartupHint = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  const gateThemeId = document.documentElement?.dataset?.appearanceThemeId;
  if (gateThemeId) return gateThemeId;

  try {
    return window.localStorage?.getItem(THEME_STARTUP_HINT_KEY) || undefined;
  } catch {
    return undefined;
  }
};

const writeThemeStartupHint = (id: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(THEME_STARTUP_HINT_KEY, id);
  } catch {
    // localStorage only improves startup; chrome.storage remains canonical.
  }
};

const writeWarmTintStartupHint = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(WARM_TINT_STARTUP_HINT_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage only improves startup; chrome.storage remains canonical.
  }
};

const writeWarmTintStrengthStartupHint = (strength: number): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(WARM_TINT_STRENGTH_STARTUP_HINT_KEY, String(strength));
  } catch {
    // localStorage only improves startup; chrome.storage remains canonical.
  }
};

const writeCriticalThemeStartupSnapshot = (theme: ThemeProfile): void => {
  if (typeof window === 'undefined') return;

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
        warmTint: theme.warmTint ? { color: theme.warmTint.color, opacity: theme.warmTint.opacity } : undefined,
        tokens,
      }),
    );
  } catch {
    // The snapshot only prevents a first-frame fallback flash.
  }
};

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<string>(() => resolveAndMigrateThemeId(readThemeStartupHint()).resolvedId);

  useEffect(() => {
    assertThemeInvariants();
  }, []);

  const [wallpaperId, setWallpaperId] = useState<string>('none');
  const [customWallpaperBase64, setCustomWallpaperBase64] = useState<string>('');
  const [brightness, setBrightnessState] = useState<number>(DEFAULT_APPEARANCE_BRIGHTNESS);
  const [warmTintEnabled, setWarmTintEnabledState] = useState<boolean>(false);
  const [warmTintStrength, setWarmTintStrengthState] = useState<number>(DEFAULT_WARM_TINT_STRENGTH);

  const debounceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTintStrengthSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state with chrome extension storage reactively without suspending
  useEffect(() => {
    // Initial fetch from chrome storage to sync up with version-gated migration
    const chromeLocal = typeof chrome !== 'undefined' && chrome.storage?.local;
    const currentVersion = getCurrentExtensionVersion();

    const applyAndSaveTheme = (id: string | null | undefined) => {
      const { resolvedId, needsMigration } = resolveAndMigrateThemeId(id);
      setThemeId(resolvedId);
      writeThemeStartupHint(resolvedId);
      writeCriticalThemeStartupSnapshot(getTheme(resolvedId));
      if (needsMigration || id !== resolvedId) {
        appearanceThemeStorage.set(resolvedId);
      }
    };

    const applyAndMigrateBrightness = (rawValue: unknown) => {
      if (chromeLocal) {
        chromeLocal.get(['appearance-brightness-v2-migrated'], result => {
          if (result?.['appearance-brightness-v2-migrated']) {
            const normalized = normalizeBrightness(rawValue);
            setBrightnessState(normalized);
            if (rawValue !== normalized) {
              appearanceBrightnessStorage.set(normalized);
            }
          } else {
            const normalized = normalizeBrightness(rawValue);
            setBrightnessState(normalized);
            appearanceBrightnessStorage.set(normalized);
            chromeLocal.set({ 'appearance-brightness-v2-migrated': true });
          }
        });
      } else {
        const normalized = normalizeBrightness(rawValue);
        setBrightnessState(normalized);
      }
    };

    if (chromeLocal) {
      chromeLocal.get([LAST_KNOWN_VERSION_KEY], result => {
        const lastKnownVersion = result?.[LAST_KNOWN_VERSION_KEY];

        appearanceThemeStorage.get().then(id => {
          if (!lastKnownVersion) {
            chromeLocal.set({ [LAST_KNOWN_VERSION_KEY]: currentVersion });
            applyAndSaveTheme(id);
          } else if (lastKnownVersion !== currentVersion) {
            chromeLocal.set({ [LAST_KNOWN_VERSION_KEY]: currentVersion });
            applyAndSaveTheme(id);
          } else {
            applyAndSaveTheme(id);
          }
        });
      });
    } else {
      appearanceThemeStorage.get().then(id => {
        applyAndSaveTheme(id);
      });
    }

    appearanceWallpaperStorage.get().then(id => {
      const newId = id || 'none';
      if (newId) {
        setWallpaperId(newId);
      }
    });

    appearanceBrightnessStorage.get().then(rawVal => {
      applyAndMigrateBrightness(rawVal);
    });

    appearanceWarmTintStorage.get().then(rawVal => {
      const enabled = typeof rawVal === 'boolean' ? rawVal : false;
      setWarmTintEnabledState(enabled);
      writeWarmTintStartupHint(enabled);
    });

    appearanceWarmTintStrengthStorage.get().then(rawVal => {
      const strength = normalizeWarmTintStrength(rawVal);
      setWarmTintStrengthState(strength);
      writeWarmTintStrengthStartupHint(strength);
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['custom-wallpaper-base64'], result => {
        if (result['custom-wallpaper-base64']) {
          setCustomWallpaperBase64(result['custom-wallpaper-base64']);
        }
      });
    }

    // Listen for storage changes from other tabs
    const unsubscribeTheme = appearanceThemeStorage.subscribe(() => {
      appearanceThemeStorage.get().then(id => {
        applyAndSaveTheme(id);
      });
    });

    const unsubscribeWallpaper = appearanceWallpaperStorage.subscribe(() => {
      appearanceWallpaperStorage.get().then(id => {
        const newId = id || 'none';
        if (newId) {
          setWallpaperId(newId);
        }
      });
    });

    const unsubscribeBrightness = appearanceBrightnessStorage.subscribe(() => {
      appearanceBrightnessStorage.get().then(rawVal => {
        applyAndMigrateBrightness(rawVal);
      });
    });

    const unsubscribeWarmTint = appearanceWarmTintStorage.subscribe(() => {
      appearanceWarmTintStorage.get().then(rawVal => {
        const enabled = typeof rawVal === 'boolean' ? rawVal : false;
        setWarmTintEnabledState(enabled);
        writeWarmTintStartupHint(enabled);
      });
    });

    const unsubscribeWarmTintStrength = appearanceWarmTintStrengthStorage.subscribe(() => {
      appearanceWarmTintStrengthStorage.get().then(rawVal => {
        const strength = normalizeWarmTintStrength(rawVal);
        setWarmTintStrengthState(strength);
        writeWarmTintStrengthStartupHint(strength);
      });
    });

    const chromeListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['custom-wallpaper-base64']) {
        const newVal = changes['custom-wallpaper-base64'].newValue || '';
        setCustomWallpaperBase64(newVal);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(chromeListener);
    }

    return () => {
      unsubscribeTheme();
      unsubscribeWallpaper();
      unsubscribeBrightness();
      unsubscribeWarmTint();
      unsubscribeWarmTintStrength();
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(chromeListener);
      }
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }
      if (debounceTintStrengthSaveTimerRef.current) {
        clearTimeout(debounceTintStrengthSaveTimerRef.current);
      }
    };
  }, []);

  let baseTheme = getTheme(themeId);
  if (!baseTheme) {
    console.warn(`[AppearanceProvider] Theme "${themeId}" not found in registry. Falling back to default.`);
    baseTheme = getTheme(DEFAULT_THEME_ID);
  }

  const theme = useMemo(() => {
    return {
      ...baseTheme,
      wallpaper:
        wallpaperId === 'none'
          ? undefined
          : {
              src:
                wallpaperId === 'custom'
                  ? customWallpaperBase64
                  : `AltS_search_newtab/images/wallappear/${wallpaperId}`,
              opacity: 1.0,
            },
    };
  }, [baseTheme, wallpaperId, customWallpaperBase64]);

  useEffect(() => {
    const isContentScript =
      typeof chrome !== 'undefined' && chrome.runtime && !location.protocol.startsWith('chrome-extension:');
    const root =
      (window as any).__ALTS_PORTAL_HOST__ ||
      (window as any).__ALTQ_PORTAL_HOST__ ||
      (!isContentScript ? document.documentElement : null);
    if (!root) return;

    // Brightness is a viewport-level appearance control rescaled based on the active theme's registered maximum source level.
    const maxSourceLevel = theme.brightness?.maximumSourceLevel ?? (theme.isDark ? 85 : 65);
    const factor = brightnessLevelToFactor(brightness, maxSourceLevel);
    root.style.setProperty('filter', `brightness(${factor})`);

    // Toggle dark class on document element and portal root element so Tailwind dark:* variants accurately reflect theme light/dark state
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', Boolean(theme.isDark));
    }
    if (root && root.classList) {
      root.classList.toggle('dark', Boolean(theme.isDark));
    }
    const glassPanels = [
      'appBg',
      'sidebarBg',
      'panelBg',
      'modalBg',
      'cardBg',
      'inputBg',
      'editorBg',
      'containerBg',
      'sheetBg',
      'tutorialCardBg',
      'popupBg',
      'contextMenuBg',
      'widgetBg',
      'widgetToolbarBg',
    ];
    const textTokens = ['textPrimary', 'textSecondary', 'textMuted', 'textPlaceholder', 'textDisabled', 'iconDefault'];
    const wallpaperTextOverrides: Record<string, string> = {
      textPrimary: '#FFFFFF',
      textSecondary: '#E5E7EB',
      textMuted: '#A3A3A3',
      textPlaceholder: '#A3A3A3',
      textDisabled: 'rgba(255, 255, 255, 0.35)',
      iconDefault: '#E5E7EB',
    };

    Object.entries(theme.tokens).forEach(([key, value]) => {
      if (value === undefined) return;
      // STRICT RULE: If wallpaper is applied, do not trigger appBg (keep it transparent)
      if (theme.wallpaper && key === 'appBg') {
        root.style.setProperty(`--color-${key}`, 'transparent');
      } else if (theme.wallpaper && theme.isDark && textTokens.includes(key)) {
        root.style.setProperty(`--color-${key}`, wallpaperTextOverrides[key]);
      } else if (key === 'backgroundGradient') {
        root.style.setProperty(`--color-${key}`, value);
      } else if (theme.glassOpacity !== undefined && glassPanels.includes(key)) {
        root.style.setProperty(`--color-${key}`, applyOpacity(value, theme.glassOpacity));
      } else {
        root.style.setProperty(`--color-${key}`, value);
      }
    });

    // Apply glass blur from theme configuration
    const blurAmount = theme.glassBlur || '12px';
    root.style.setProperty('--glass-blur', `blur(${blurAmount}) saturate(1.2)`);
    root.style.setProperty('--color-backdrop', `blur(${blurAmount}) saturate(1.2)`);
  }, [theme, brightness]);

  const setTheme = async (id: string) => {
    setThemeId(id);
    writeThemeStartupHint(id);
    writeCriticalThemeStartupSnapshot(getTheme(id));
    await appearanceThemeStorage.set(id);
  };

  const setWallpaper = async (id: string) => {
    setWallpaperId(id);
    await appearanceWallpaperStorage.set(id);
  };

  const setBrightness = useCallback(async (val: number) => {
    const normalized = normalizeBrightness(val);
    setBrightnessState(normalized);

    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
    }

    debounceSaveTimerRef.current = setTimeout(() => {
      appearanceBrightnessStorage.set(normalized);
    }, 150);
  }, []);

  const resetBrightness = useCallback(async () => {
    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
    }
    setBrightnessState(DEFAULT_APPEARANCE_BRIGHTNESS);
    await appearanceBrightnessStorage.set(DEFAULT_APPEARANCE_BRIGHTNESS);
  }, []);

  const setWarmTintEnabled = useCallback(async (enabled: boolean) => {
    const val = Boolean(enabled);
    setWarmTintEnabledState(val);
    writeWarmTintStartupHint(val);
    await appearanceWarmTintStorage.set(val);
  }, []);

  const setWarmTintStrength = useCallback(async (strength: number) => {
    const normalized = normalizeWarmTintStrength(strength);
    setWarmTintStrengthState(normalized);
    writeWarmTintStrengthStartupHint(normalized);

    if (debounceTintStrengthSaveTimerRef.current) {
      clearTimeout(debounceTintStrengthSaveTimerRef.current);
    }

    debounceTintStrengthSaveTimerRef.current = setTimeout(() => {
      appearanceWarmTintStrengthStorage.set(normalized);
    }, 150);
  }, []);

  const resetWarmTintStrength = useCallback(async () => {
    if (debounceTintStrengthSaveTimerRef.current) {
      clearTimeout(debounceTintStrengthSaveTimerRef.current);
    }
    setWarmTintStrengthState(DEFAULT_WARM_TINT_STRENGTH);
    writeWarmTintStrengthStartupHint(DEFAULT_WARM_TINT_STRENGTH);
    await appearanceWarmTintStrengthStorage.set(DEFAULT_WARM_TINT_STRENGTH);
  }, []);

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        themeId,
        setTheme,
        wallpaperId,
        setWallpaper,
        brightness,
        setBrightness,
        resetBrightness,
        warmTintEnabled,
        setWarmTintEnabled,
        warmTintStrength,
        setWarmTintStrength,
        resetWarmTintStrength,
      }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};

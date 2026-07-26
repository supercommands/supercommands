import type React from 'react';
import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { appearanceThemeStorage, appearanceWallpaperStorage } from '@extension/storage';
import type { ThemeProfile } from './types';
import { getTheme } from './registry';

interface AppearanceContextType {
  theme: ThemeProfile;
  themeId: string;
  setTheme: (id: string) => Promise<void>;
  wallpaperId: string;
  setWallpaper: (id: string) => Promise<void>;
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

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<string>('ocean-blue');

  const [wallpaperId, setWallpaperId] = useState<string>('car-race.png');

  const [customWallpaperBase64, setCustomWallpaperBase64] = useState<string>('');

  // Sync state with chrome extension storage reactively without suspending
  useEffect(() => {
    // Initial fetch from chrome storage to sync up
    appearanceThemeStorage.get().then(id => {
      if (id) {
        setThemeId(id);
      }
    });

    appearanceWallpaperStorage.get().then(id => {
      const newId = id || 'car-race.png';
      if (newId) {
        setWallpaperId(newId);
      }
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
        if (id) {
          setThemeId(id);
        }
      });
    });

    const unsubscribeWallpaper = appearanceWallpaperStorage.subscribe(() => {
      appearanceWallpaperStorage.get().then(id => {
        const newId = id || 'car-race.png';
        if (newId) {
          setWallpaperId(newId);
        }
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
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(chromeListener);
      }
    };
  }, []);

  let baseTheme = getTheme(themeId);
  if (!baseTheme) {
    console.warn(`[AppearanceProvider] Theme "${themeId}" not found in registry. Falling back to ocean-blue.`);
    baseTheme = getTheme('ocean-blue');
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
    const isContentScript = typeof chrome !== 'undefined' && chrome.runtime && !location.protocol.startsWith('chrome-extension:');
    const root = (window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__ || (!isContentScript ? document.documentElement : null);
    if (!root) return;
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
      // STRICT RULE: If wallpaper is applied, do not trigger appBg (keep it transparent)
      if (theme.wallpaper && key === 'appBg') {
        root.style.setProperty(`--color-${key}`, 'transparent');
      } else if (theme.wallpaper && textTokens.includes(key)) {
        root.style.setProperty(`--color-${key}`, wallpaperTextOverrides[key]);
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
  }, [theme]);

  const setTheme = async (id: string) => {
    setThemeId(id);
    await appearanceThemeStorage.set(id);
  };

  const setWallpaper = async (id: string) => {
    setWallpaperId(id);
    await appearanceWallpaperStorage.set(id);
  };

  return (
    <AppearanceContext.Provider value={{ theme, themeId, setTheme, wallpaperId, setWallpaper }}>
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

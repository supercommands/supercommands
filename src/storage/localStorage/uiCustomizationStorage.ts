export type ThemeId = 'ocean-blue' | 'midnight-stars' | string;

// --- Theme Storage ---
export const getStoredThemeId = async (): Promise<ThemeId> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['appearance-theme'], resolve));
      const stored = result['appearance-theme'];
      if (!stored || stored === 'dark' || stored === 'default-dark') {
        await new Promise<void>(resolve => chromeAny.storage.local.set({ 'appearance-theme': 'midnight-stars' }, resolve));
        return 'midnight-stars';
      }
      return stored;
    }
  } catch (e) {
    console.error('Failed to get stored theme ID:', e);
  }
  return 'midnight-stars';
};

export const setStoredThemeId = async (themeId: ThemeId): Promise<void> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ 'appearance-theme': themeId }, resolve));
    }
  } catch (e) {
    console.error('Failed to store theme ID:', e);
  }
};

// --- Wallpaper Storage ---
export const getStoredWallpaperId = async (): Promise<string> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['appearance-wallpaper'], resolve));
      return result['appearance-wallpaper'] || 'car-race.png';
    }
  } catch (e) {
    console.error('Failed to get stored wallpaper ID:', e);
  }
  return 'car-race.png';
};

export const setStoredWallpaperId = async (wallpaperId: string): Promise<void> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ 'appearance-wallpaper': wallpaperId }, resolve));
    }
  } catch (e) {
    console.error('Failed to store wallpaper ID:', e);
  }
};

// --- Custom Wallpaper Base64 Storage ---
export const getCustomWallpaperBase64 = async (): Promise<string> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['custom-wallpaper-base64'], resolve));
      return result['custom-wallpaper-base64'] || '';
    }
  } catch (e) {
    console.error('Failed to get custom wallpaper base64:', e);
  }
  return '';
};

export const setCustomWallpaperBase64 = async (base64: string): Promise<void> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ 'custom-wallpaper-base64': base64 }, resolve));
    }
  } catch (e) {
    console.error('Failed to store custom wallpaper base64:', e);
  }
};

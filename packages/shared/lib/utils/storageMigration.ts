export const migrateLocalStorageToChromeStorage = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const chromeAny = (window as any).chrome;
  if (!chromeAny?.storage?.local) {
    return;
  }

  const keysToMigrate = [
    'sidebarViewMode',
    'selectedAIs',
    'ai_model_preferences',
    'recently_used_emojis',
    'recent_commands',
    'alts_commands',
    'history_auto_suggest',
    'app_tutorial_progress',
    'tutorial_watched',
    'tutorail_watched',
    'sidebar_tutorial_finished',
    'search_tutorial_finished',
    'favorites_tutorial_seen',
    'agent_tutorial_finished',
    'counters_daily_v1_fallback',
    'tasklabs_gate_cache',
    'user_automations',
    'theme-settings',
    'theme',
    'new_tab_is_dark_mode',
    'new_tab_dark_mode',
    'accessToken',
    'user_name',
    'widget-dashboard-layout-v1',
  ];

  const themeKeys = ['theme', 'new_tab_is_dark_mode', 'new_tab_dark_mode'];

  const dataToSave: Record<string, any> = {};
  const keysToRemove: string[] = [];

  // Iterate over localStorage and grab existing values
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (keysToMigrate.includes(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try {
          dataToSave[key] = JSON.parse(value);
        } catch (e) {
          dataToSave[key] = value;
        }

        keysToRemove.push(key);
      }
    }
  }

  if (Object.keys(dataToSave).length > 0) {
    try {
      await new Promise<void>((resolve, reject) => {
        chromeAny.storage.local.set(dataToSave, () => {
          if (chromeAny.runtime.lastError) {
            reject(chromeAny.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Cleanup on success
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('[StorageMigration] Failed to migrate storage:', e);
    }
  }
};

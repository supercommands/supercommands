const LEFT_SIDEBAR_COLLAPSED_KEY = 'new_tab_is_sidebar_collapsed';

export const getLeftSidebarCollapsed = async (): Promise<boolean> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return false;

    const result = await new Promise<Record<string, any>>(resolve => {
      chromeAny.storage.local.get([LEFT_SIDEBAR_COLLAPSED_KEY], resolve);
    });

    return result[LEFT_SIDEBAR_COLLAPSED_KEY] === true;
  } catch (error) {
    console.error('[LeftSidebarCollapseStorage] Failed to read collapsed state:', error);
    return false;
  }
};

export const setLeftSidebarCollapsed = async (collapsed: boolean): Promise<void> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    await new Promise<void>(resolve => {
      chromeAny.storage.local.set({ [LEFT_SIDEBAR_COLLAPSED_KEY]: collapsed }, resolve);
    });
  } catch (error) {
    console.error('[LeftSidebarCollapseStorage] Failed to write collapsed state:', error);
  }
};

export const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = LEFT_SIDEBAR_COLLAPSED_KEY;

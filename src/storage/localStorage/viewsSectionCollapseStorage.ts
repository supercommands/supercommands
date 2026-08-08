const VIEWS_SECTION_COLLAPSED_KEY = 'sidebar_views_section_collapsed';

export const getViewsSectionCollapsed = async (): Promise<boolean> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return false;

    const result = await new Promise<Record<string, any>>(resolve => {
      chromeAny.storage.local.get([VIEWS_SECTION_COLLAPSED_KEY], resolve);
    });

    return result[VIEWS_SECTION_COLLAPSED_KEY] === true;
  } catch (error) {
    console.error('[ViewsSectionCollapseStorage] Failed to read collapsed state:', error);
    return false;
  }
};

export const setViewsSectionCollapsed = async (collapsed: boolean): Promise<void> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    await new Promise<void>(resolve => {
      chromeAny.storage.local.set({ [VIEWS_SECTION_COLLAPSED_KEY]: collapsed }, resolve);
    });
  } catch (error) {
    console.error('[ViewsSectionCollapseStorage] Failed to write collapsed state:', error);
  }
};

export const VIEWS_SECTION_COLLAPSED_STORAGE_KEY = VIEWS_SECTION_COLLAPSED_KEY;

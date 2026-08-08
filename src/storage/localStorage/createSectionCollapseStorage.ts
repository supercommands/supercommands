const CREATE_SECTION_COLLAPSED_KEY = 'sidebar_create_section_collapsed';

export const getCreateSectionCollapsed = async (): Promise<boolean> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return false;

    const result = await new Promise<Record<string, any>>(resolve => {
      chromeAny.storage.local.get([CREATE_SECTION_COLLAPSED_KEY], resolve);
    });

    return result[CREATE_SECTION_COLLAPSED_KEY] === true;
  } catch (error) {
    console.error('[CreateSectionCollapseStorage] Failed to read collapsed state:', error);
    return false;
  }
};

export const setCreateSectionCollapsed = async (collapsed: boolean): Promise<void> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    await new Promise<void>(resolve => {
      chromeAny.storage.local.set({ [CREATE_SECTION_COLLAPSED_KEY]: collapsed }, resolve);
    });
  } catch (error) {
    console.error('[CreateSectionCollapseStorage] Failed to write collapsed state:', error);
  }
};

export const CREATE_SECTION_COLLAPSED_STORAGE_KEY = CREATE_SECTION_COLLAPSED_KEY;

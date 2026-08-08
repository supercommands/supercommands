const MY_LIBRARY_SECTION_COLLAPSED_KEY = 'sidebar_my_library_section_collapsed';

export const getMyLibrarySectionCollapsed = async (): Promise<boolean> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return false;

    const result = await new Promise<Record<string, any>>(resolve => {
      chromeAny.storage.local.get([MY_LIBRARY_SECTION_COLLAPSED_KEY], resolve);
    });

    return result[MY_LIBRARY_SECTION_COLLAPSED_KEY] === true;
  } catch (error) {
    console.error('[MyLibrarySectionCollapseStorage] Failed to read collapsed state:', error);
    return false;
  }
};

export const setMyLibrarySectionCollapsed = async (collapsed: boolean): Promise<void> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    await new Promise<void>(resolve => {
      chromeAny.storage.local.set({ [MY_LIBRARY_SECTION_COLLAPSED_KEY]: collapsed }, resolve);
    });
  } catch (error) {
    console.error('[MyLibrarySectionCollapseStorage] Failed to write collapsed state:', error);
  }
};

export const MY_LIBRARY_SECTION_COLLAPSED_STORAGE_KEY = MY_LIBRARY_SECTION_COLLAPSED_KEY;

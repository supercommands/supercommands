// --- Sidebar State Storage ---

export const getSidebarStorageData = async (keys: string[]): Promise<any> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      return await new Promise<any>(resolve => chromeAny.storage.local.get(keys, resolve));
    }
  } catch (e) {
    console.error('Failed to get stored sidebar state:', e);
  }
  return {};
};

export const setSidebarStorageData = async (data: Record<string, any>): Promise<void> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set(data, resolve));
    }
  } catch (e) {
    console.error('Failed to store sidebar state:', e);
  }
};

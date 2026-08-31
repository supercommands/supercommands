export type TodoDisplayMode = 'collapse' | 'data-blur' | 'pin';

// --- Todo Display Mode Handle Storage ---
export const getStoredTodoDisplayMode = async (): Promise<TodoDisplayMode> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['todo_display_mode'], resolve));
      return result.todo_display_mode || 'collapse';
    }
  } catch (e) {
    console.error('Failed to get stored todo display mode:', e);
  }
  return 'collapse';
};

export const setStoredTodoDisplayMode = async (mode: TodoDisplayMode): Promise<void> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ todo_display_mode: mode }, resolve));
    }
  } catch (e) {
    console.error('Failed to store todo display mode:', e);
  }
};

// --- Search Handle Focus Preferences Storage ---
export const getStoredSearchFocusPreference = async (): Promise<boolean> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['rtq_focus_on'], resolve));
      return result.rtq_focus_on !== false; // Default to true
    }
  } catch (e) {
    console.error('Failed to get search focus preference:', e);
  }
  return true;
};

export const setStoredSearchFocusPreference = async (focusOn: boolean): Promise<void> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ rtq_focus_on: focusOn }, resolve));
    }
  } catch (e) {
    console.error('Failed to store search focus preference:', e);
  }
};

export type LayoutViewMode = 'board' | 'sheet';

export const getStoredLayoutViewMode = async (): Promise<LayoutViewMode> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['new_tab_view_mode_temp'], resolve));
      return result.new_tab_view_mode_temp || 'board';
    }
  } catch (e) {
    console.error('Failed to get stored layout view mode:', e);
  }
  return 'board';
};

export const setStoredLayoutViewMode = async (mode: LayoutViewMode): Promise<void> => {
  try {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve => chromeAny.storage.local.set({ new_tab_view_mode_temp: mode }, resolve));
    }
  } catch (e) {
    console.error('Failed to store layout view mode:', e);
  }
};


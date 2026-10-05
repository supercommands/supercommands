/**
 * A centralized storage manager for the extension.
 * This wraps chrome.storage.local.
 * Using this ensures data is reliably saved and retrieved across the extension ecosystem.
 */
export const StorageManager = {
    /**
     * Set an item in storage.
     */
    setItem: async (key: string, value: any): Promise<void> => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ [key]: value });
            }
        }
        catch (e) {
            console.error(`[StorageManager] Failed to set item ${key}:`, e);
        }
    },
    /**
     * Get an item (or multiple items) from storage.
     */
    getItem: async (key: string | string[]): Promise<any> => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const data = await chrome.storage.local.get(key);
                if (typeof key === 'string') {
                    return data[key] !== undefined ? data[key] : null;
                }
                return data; // Return object with all requested keys
            }
            return typeof key === 'string' ? null : {};
        }
        catch (e) {
            console.error(`[StorageManager] Failed to get item ${key}:`, e);
            return typeof key === 'string' ? null : {};
        }
    },
    /**
     * Remove an item from storage.
     */
    removeItem: async (key: string | string[]): Promise<void> => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.remove(key);
            }
        }
        catch (e) {
            console.error(`[StorageManager] Failed to remove item ${key}:`, e);
        }
    }
};

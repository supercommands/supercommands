import { StorageManager } from './storageManager';
import { getAllUserShortcuts, deleteUserShortcut } from '../../shared-components/shortcuts/core/shortcutDbData';

export interface CustomOmniboxPrefixes {
  note: string;
  link: string;
  command: string;
  system_command?: string;
  session?: string;
  automation?: string;
  agent?: string;
  snippet?: string;
  todo?: string;
  bookmark?: string;
  prompt?: string;
  // "This Section" action prefixes — user-customizable
  capture_screenshot?: string;
  capture_clip_screenshot?: string;
  capture_full_screenshot?: string;
  downloadallimages?: string;
  downloadalltables?: string;
  save_link?: string;
  save_session?: string;
  save_chat?: string;
  add_to_existing?: string;
  add_to_existing_session?: string;
  summarize_page?: string;
}

const STORAGE_KEY = 'custom_search_prefixes_for_omnibox';

/** Default values for all omnibox prefixes. */
export const DEFAULT_OMNIBOX_PREFIXES: Required<CustomOmniboxPrefixes> = {
  note: 'n',
  link: 'l',
  command: 'c',
  system_command: 'sc',
  session: 's',
  automation: 'au',
  agent: 'g',
  snippet: 'sn',
  todo: 't',
  bookmark: 'bm',
  prompt: 'p',
  // action prefixes
  capture_screenshot: 'cs',
  capture_clip_screenshot: 'ccs',
  capture_full_screenshot: 'cfp',
  downloadallimages: 'dai',
  downloadalltables: 'dat',
  save_link: 'clc',
  save_session: 'tss',
  save_chat: 'stc',
  add_to_existing: 'elc',
  add_to_existing_session: 'es',
  summarize_page: 'smm',
};

export const CustomSearchPrefixesForOmniboxStorage = {
  /**
   * Gets the custom search prefixes for the omnibox from chrome.storage.local.
   * Any keys missing from storage are filled in with defaults.
   */
  getPrefixes: async (): Promise<Required<CustomOmniboxPrefixes>> => {
    const data = (await StorageManager.getItem(STORAGE_KEY)) as CustomOmniboxPrefixes | null;
    const merged: Required<CustomOmniboxPrefixes> = { ...DEFAULT_OMNIBOX_PREFIXES, ...(data || {}) };

    let updated = false;
    if (merged.save_link === 'stl') { merged.save_link = 'clc'; updated = true; }
    if (merged.add_to_existing === 'ate' || merged.add_to_existing === 'celc') { merged.add_to_existing = 'elc'; updated = true; }
    if (merged.add_to_existing_session === 'aes' || merged.add_to_existing_session === 'ces') { merged.add_to_existing_session = 'es'; updated = true; }
    if (merged.summarize_page === 'stp') { merged.summarize_page = 'smm'; updated = true; }
    if (merged.capture_full_screenshot === 'cfs') { merged.capture_full_screenshot = 'cfp'; updated = true; }

    if (updated || !data) {
      await StorageManager.setItem(STORAGE_KEY, merged);
    }
    return merged;
  },

  /**
   * Saves the custom search prefixes for the omnibox to chrome.storage.local.
   * Throws an error if there are duplicate prefixes.
   */
  setPrefixes: async (prefixes: CustomOmniboxPrefixes): Promise<void> => {
    const merged: Required<CustomOmniboxPrefixes> = { ...DEFAULT_OMNIBOX_PREFIXES, ...prefixes };
    const values = (Object.values(merged) as string[])
      .filter(Boolean)
      .map(p => p.trim().toLowerCase());
    const uniqueValues = new Set(values);

    if (uniqueValues.size !== values.length) {
      throw new Error('Duplicate prefixes are not allowed. Each prefix must be unique.');
    }

    try {
      const allShortcuts = await getAllUserShortcuts();
      for (const shortcut of allShortcuts) {
        if (uniqueValues.has(shortcut.trigger)) {
          await deleteUserShortcut(shortcut.id);
        }
      }
    } catch (e) {
      console.error('Failed to cleanup conflicting shortcuts on prefix update:', e);
    }

    await StorageManager.setItem(STORAGE_KEY, merged);
  },
};

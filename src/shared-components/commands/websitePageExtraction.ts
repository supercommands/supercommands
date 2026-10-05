/**
 * Shared identity registry for the website popup's Page Extraction section.
 *
 * The registry preserves the legacy seven-row order. Individual action labels,
 * prefixes, and enabled state come from prefix settings when a setting category
 * exists; the combined screenshot-tools menu retains its shared command text.
 */
import type { PrefixSettingAction } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export type WebsitePageExtractionId = 'capture_screenshot_tools' | 'downloadallimages' | 'downloadalltables' | 'merge_windows' | 'close_duplicate_tabs' | 'mute_all_tabs' | 'unmute_all_tabs';
export type WebsitePageExtractionIcon = 'capture' | 'images' | 'tables' | 'merge' | 'duplicates' | 'mute' | 'unmute';
export type WebsitePageExtractionTone = 'capture' | 'summarize' | 'action' | 'extract';
export type WebsitePageExtractionDefinition = {
    id: WebsitePageExtractionId;
    fallbackLabel: string;
    fallbackPrefix: string;
    prefixSettingCategory: PrefixSettingAction | null;
    icon: WebsitePageExtractionIcon;
    tone: WebsitePageExtractionTone;
};
export const WEBSITE_PAGE_EXTRACTION_DEFINITIONS: readonly WebsitePageExtractionDefinition[] = [
    {
        id: 'capture_screenshot_tools',
        fallbackLabel: 'Capture Screenshot / Full Page',
        fallbackPrefix: 'screenshot',
        prefixSettingCategory: null,
        icon: 'capture',
        tone: 'capture',
    },
    {
        id: 'downloadallimages',
        fallbackLabel: 'Download All Images',
        fallbackPrefix: 'dp',
        prefixSettingCategory: 'downloadallimages',
        icon: 'images',
        tone: 'summarize',
    },
    {
        id: 'downloadalltables',
        fallbackLabel: 'Download All Tables',
        fallbackPrefix: 'tables',
        prefixSettingCategory: 'downloadalltables',
        icon: 'tables',
        tone: 'summarize',
    },
    {
        id: 'merge_windows',
        fallbackLabel: 'Merge All Windows',
        fallbackPrefix: 'merge',
        prefixSettingCategory: 'merge_windows',
        icon: 'merge',
        tone: 'action',
    },
    {
        id: 'close_duplicate_tabs',
        fallbackLabel: 'Close Duplicate Tabs',
        fallbackPrefix: 'duplicate',
        prefixSettingCategory: 'close_duplicate_tabs',
        icon: 'duplicates',
        tone: 'action',
    },
    {
        id: 'mute_all_tabs',
        fallbackLabel: 'Mute All Tabs',
        fallbackPrefix: 'mute',
        prefixSettingCategory: 'mute_all_tabs',
        icon: 'mute',
        tone: 'extract',
    },
    {
        id: 'unmute_all_tabs',
        fallbackLabel: 'Unmute All Tabs',
        fallbackPrefix: 'unmute',
        prefixSettingCategory: 'unmute_all_tabs',
        icon: 'unmute',
        tone: 'extract',
    }
];

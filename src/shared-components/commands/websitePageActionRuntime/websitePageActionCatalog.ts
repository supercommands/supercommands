/** Shared page-action metadata; importing this module does not load screenshot menu UI. */
import type { PageActionCommand } from './types';
import { ScreenshotCommand } from './ScreenshotCommand';
import { ClipOutScreenshotCommand } from './ClipOutScreenshotCommand';
import { FullPageScreenshotCommand } from './FullPageScreenshotCommand';
import { DownloadAllImagesCommand } from './DownloadAllImagesCommand';
import { DownloadAllTablesCommand } from './DownloadAllTablesCommand';
import { MergeWindowsCommand } from './MergeWindowsCommand';
import { CloseDuplicateTabsCommand } from './CloseDuplicateTabsCommand';
import { MuteAllTabsCommand } from './MuteAllTabsCommand';
import { UnmuteAllTabsCommand } from './UnmuteAllTabsCommand';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS } from '../websitePageExtraction';
export const SCREENSHOT_MENU_ACTION = 'OPEN_SCREENSHOT_CAPTURE_MENU';
const SCREENSHOT_MENU_COMMAND: PageActionCommand = {
    id: 'capture_screenshot_tools',
    label: 'Capture Screenshot / Full Page',
    prefix: 'screenshot',
    keywords: ['capture', 'screenshot', 'screen', 'clip', 'download', 'full', 'page', 'visible', 'png', 'jpg', 'pdf'],
    description: 'Choose visible screenshot, clip and download, or full-page capture',
    action: SCREENSHOT_MENU_ACTION,
    needsPopupClose: false,
};
/** All page-action commands in display order */
const PAGE_ACTION_COMMAND_BY_ID: Record<string, PageActionCommand> = {
    capture_screenshot_tools: SCREENSHOT_MENU_COMMAND,
    downloadallimages: DownloadAllImagesCommand,
    downloadalltables: DownloadAllTablesCommand,
    merge_windows: MergeWindowsCommand,
    close_duplicate_tabs: CloseDuplicateTabsCommand,
    mute_all_tabs: MuteAllTabsCommand,
    unmute_all_tabs: UnmuteAllTabsCommand,
};
export const PAGE_ACTION_COMMANDS: PageActionCommand[] = WEBSITE_PAGE_EXTRACTION_DEFINITIONS
    .map(definition => PAGE_ACTION_COMMAND_BY_ID[definition.id]);
/**
 * Shape expected by AltQ's filtered.commands / allCommands arrays.
 * `category: 'page_action'` stays as command metadata; website rendering uses
 * the Page Extraction section mapping from `websiteCommandSections.ts`.
 */
export interface AltQPageActionItem {
    id: string;
    label: string;
    name: string; // AltQ uses 'name' for display
    prefix: string;
    keywords: string[];
    description?: string;
    category: 'page_action';
    isGlobal: false;
    // Execution metadata — carried through so handleExecute doesn't need a lookup
    _action: string;
    _needsPopupClose: boolean;
}
/** Convert PageActionCommand → AltQ list item */
export function toAltQItem(cmd: PageActionCommand): AltQPageActionItem {
    return {
        id: cmd.id,
        label: cmd.label,
        name: cmd.label,
        prefix: cmd.prefix,
        keywords: cmd.keywords,
        description: cmd.description,
        category: 'page_action',
        isGlobal: false,
        _action: cmd.action,
        _needsPopupClose: cmd.needsPopupClose,
    };
}
/** Ready-to-use AltQ list items for all page-action commands */
export const PAGE_ACTION_ITEMS: AltQPageActionItem[] = PAGE_ACTION_COMMANDS.map(toAltQItem);

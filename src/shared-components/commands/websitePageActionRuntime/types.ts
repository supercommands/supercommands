/**
 * Represents a command that executes directly on the current page
 * (e.g. screenshots, downloads) without navigating to AltS_search_newtab.
 */
export interface PageActionCommand {
    id: string;
    label: string;
    prefix: string;
    keywords: string[];
    description?: string;
    /** The chrome.runtime message action string, or a special key for custom logic */
    action: string;
    /** If true, the AltQ popup is closed and a 800ms grace period is given before firing,
     *  so the popup doesn't appear in the screenshot */
    needsPopupClose: boolean;
}

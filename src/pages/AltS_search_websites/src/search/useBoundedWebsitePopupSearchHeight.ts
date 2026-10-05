/** Normal search uses the shared off-screen textarea sizing owner. */
import { useWebsitePopupTextareaSize } from './useWebsitePopupTextareaSize';
export function useBoundedWebsitePopupSearchHeight(element: HTMLTextAreaElement | null, value: string, _mode: 'normal') {
    useWebsitePopupTextareaSize(element, value, { maximumRowsToken: '--website-popup-normal-search-max-rows' });
}

/**
 * Thin Zustand visibility adapter for WebsitePopupSearchHint.
 *
 * The default policy shows the hint only for an exactly empty query. Callers
 * may provide another centralized rule later without changing presentation.
 */
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import { WebsitePopupSearchHint, type WebsitePopupSearchHintProps, } from './WebsitePopupSearchHint';
import { showWebsitePopupSearchHintWhenQueryEmpty, type WebsitePopupSearchHintVisibilityRule, } from './websitePopupSearchHintRules';
export type ConnectedWebsitePopupSearchHintProps = WebsitePopupSearchHintProps & {
    store: WebsitePopupInteractionStoreApi;
    visibilityRule?: WebsitePopupSearchHintVisibilityRule;
};
export function ConnectedWebsitePopupSearchHint({ store, visibilityRule = showWebsitePopupSearchHintWhenQueryEmpty, ...hintProps }: ConnectedWebsitePopupSearchHintProps) {
    const isVisible = useStore(store, current => visibilityRule(current.state));
    return isVisible ? <WebsitePopupSearchHint {...hintProps}/> : null;
}

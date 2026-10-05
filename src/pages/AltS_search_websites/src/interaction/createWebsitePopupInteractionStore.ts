/**
 * Per-popup vanilla-Zustand store for the lightweight interaction model.
 *
 * This factory intentionally returns a new store for each popup mount. It does
 * not expose a global singleton; React integration stays in the search adapter.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createInitialWebsitePopupInteractionState, reduceWebsitePopupInteraction, } from './websitePopupInteractionReducer';
import type { WebsitePopupInteractionEvent, WebsitePopupInteractionState, WebsitePopupInteractionStore, } from './websitePopupInteractionTypes';
export type WebsitePopupInteractionStoreApi = StoreApi<WebsitePopupInteractionStore>;
export function createWebsitePopupInteractionStore(initialState: WebsitePopupInteractionState = createInitialWebsitePopupInteractionState()): WebsitePopupInteractionStoreApi {
    return createStore<WebsitePopupInteractionStore>(set => ({
        state: initialState,
        dispatch: (event: WebsitePopupInteractionEvent) => {
            set(current => ({
                state: reduceWebsitePopupInteraction(current.state, event),
            }));
        },
    }));
}

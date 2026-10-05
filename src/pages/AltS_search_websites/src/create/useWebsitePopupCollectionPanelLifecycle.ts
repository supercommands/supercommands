/** Standalone Collection close policy; capture cancellation remains with the capture controllers. */
import { useCallback } from 'react';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';

export function useWebsitePopupCollectionPanelLifecycle(store: WebsitePopupInteractionStoreApi, onRequestClose: () => void) {
    const cancel = useCallback(() => onRequestClose(), [onRequestClose]);
    const escape = useCallback(() => {
        const state = store.getState().state;
        if (state.route.kind === 'submode' && state.route.submode.id === 'collection-destination'
            && state.collectionSession?.pickerOpen) {
            store.getState().dispatch({ type: 'COLLECTION_PICKER_CLOSED' });
            return;
        }
        cancel();
    }, [store, cancel]);
    return { cancel, escape };
}

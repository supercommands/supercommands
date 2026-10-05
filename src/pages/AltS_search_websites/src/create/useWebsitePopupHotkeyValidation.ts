/** Debounced Hotkey validation through the popup background bridge. */
import { useEffect } from 'react';
import { validateWebsitePopupHotkey } from '../bridge/websitePopupHotkeyBridge';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
export function useWebsitePopupHotkeyValidation(store: WebsitePopupInteractionStoreApi, enabled: boolean, value: string, currentEntityId?: string) {
    useEffect(() => {
        if (!enabled || !value.trim())
            return;
        let active = true;
        const timer = window.setTimeout(() => {
            void validateWebsitePopupHotkey(value, currentEntityId).then(check => {
                if (active)
                    store.getState().dispatch({ type: 'CREATE_HOTKEY_VALIDATION_CHANGED', check });
            }).catch(error => {
                if (!active)
                    return;
                store.getState().dispatch({
                    type: 'CREATE_HOTKEY_VALIDATION_CHANGED',
                    check: {
                        status: 'error',
                        value: value.trim(),
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            });
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [currentEntityId, enabled, store, value]);
}

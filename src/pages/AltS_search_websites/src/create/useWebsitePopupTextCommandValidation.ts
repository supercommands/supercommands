/** Debounced, race-safe Create text-command validation against background-owned data. */
import { useEffect } from 'react';
import { validateWebsitePopupTextCommand } from '../bridge/websitePopupTextCommandBridge';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
export function useWebsitePopupTextCommandValidation(store: WebsitePopupInteractionStoreApi, enabled: boolean, value: string) {
    useEffect(() => {
        if (!enabled || !value.trim())
            return;
        let active = true;
        const timer = window.setTimeout(() => {
            void validateWebsitePopupTextCommand(value).then(check => {
                if (active)
                    store.getState().dispatch({ type: 'CREATE_TEXT_COMMAND_VALIDATION_CHANGED', check });
            }).catch(error => {
                if (!active)
                    return;
                store.getState().dispatch({
                    type: 'CREATE_TEXT_COMMAND_VALIDATION_CHANGED',
                    check: {
                        status: 'error',
                        value: value.trim().toLowerCase(),
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            });
        }, 300);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [enabled, store, value]);
}

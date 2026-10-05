import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import { getWebsitePopupCompletedTextCommand } from '../catalog/websitePopupCompletedTextCommand';
import { buildWebsitePopupSearchSections } from '../catalog/websitePopupSearchCatalog';
import { WebsitePopupActivationController } from '../execution/WebsitePopupActivationController';
import { WebsitePopupTextCommandActivationController } from '../execution/WebsitePopupTextCommandActivationController';
export function useWebsitePopupTextCommandAction(store: WebsitePopupInteractionStoreApi, snapshot: WebsitePopupSearchSnapshot, settings: readonly WebsitePopupPrefixSettingLike[], ready: boolean, onClose: () => void) {
    const route = useStore(store, current => current.state.route);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<{
        signature: string;
        message: string;
    } | null>(null);
    const rows = useMemo(() => ready && route.kind === 'suggestions' && getWebsitePopupCompletedTextCommand(route.query, snapshot, settings)
        ? buildWebsitePopupSearchSections(route.query, snapshot, settings).flatMap(section => section.rows)
        : [], [route, snapshot, settings, ready]);
    const bulk = useRef(new WebsitePopupTextCommandActivationController());
    const controller = useRef(new WebsitePopupActivationController({
        dispatch: event => store.getState().dispatch(event),
        capturePageContext: () => ({ url: window.location.href, title: document.title, text: '' }),
    }));
    const latestRows = useRef(rows);
    latestRows.current = rows;
    const signature = `${route.kind}:${route.query}:${rows.map(row => row.id).join('|')}`;
    const latestSignature = useRef(signature);
    latestSignature.current = signature;
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const activate = useCallback(async () => {
        if (!latestRows.current.length || bulk.current.pending)
            return;
        const selectedRows = latestRows.current;
        const selectedSignature = latestSignature.current;
        setPending(true);
        setError(null);
        try {
            const result = await bulk.current.activate(selectedRows, request => controller.current.activate(request));
            if (!result || !mounted.current || latestSignature.current !== selectedSignature)
                return;
            if (result.failures.length)
                setError({ signature: selectedSignature, message: result.failures.join(' ') });
            else
                onClose();
        }
        finally {
            if (mounted.current)
                setPending(false);
        }
    }, [onClose]);
    return {
        count: rows.length,
        pending,
        error: rows.length && error?.signature === signature ? error.message : null,
        activate,
    };
}

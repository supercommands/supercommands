import { useCallback, useEffect, useRef, useState } from 'react';
import { createCollectionItem, deleteCollectionItem, listCollectionItems, updateCollectionItem } from '../../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CreateCollectionItemWireInput, UpdateCollectionItemWireInput } from '../../../../../../allObjectFolder/src/createObject/collections/collectionBridgeTypes';
import type { CollectionItemRecord } from '../../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

type LoadState = { key: string | null; records: CollectionItemRecord[]; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null };

export const useCollectionItems = (organisationId: string | null, collectionId: string | null) => {
    const key = organisationId && collectionId ? `${organisationId}:${collectionId}` : null;
    const [state, setState] = useState<LoadState>({ key: null, records: [], status: 'idle', error: null });
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const requestId = useRef(0);

    const refresh = useCallback(async (showLoading = false) => {
        const currentRequest = ++requestId.current;
        if (!organisationId || !collectionId || !key) {
            setState({ key: null, records: [], status: 'idle', error: null });
            return;
        }
        if (showLoading) setState({ key, records: [], status: 'loading', error: null });
        try {
            const records = await listCollectionItems(organisationId, collectionId);
            if (currentRequest === requestId.current) setState({ key, records, status: 'ready', error: null });
        } catch (error) {
            if (currentRequest === requestId.current) setState(previous => ({ key, records: previous.key === key ? previous.records : [], status: 'error', error: error instanceof Error ? error.message : 'Could not load collection items.' }));
        }
    }, [organisationId, collectionId, key]);

    useEffect(() => {
        void refresh(true);
        return () => { requestId.current += 1; };
    }, [refresh]);

    useEffect(() => {
        if (!key) return;
        const onMessage = (message: unknown) => {
            if (message && typeof message === 'object' && 'action' in message && 'table' in message
                && message.action === 'db_changed' && ['collectionItems', 'tags', 'workspaces'].includes(String(message.table))) void refresh();
        };
        const onFocus = () => { void refresh(); };
        chrome.runtime.onMessage.addListener(onMessage);
        window.addEventListener('focus', onFocus);
        return () => { chrome.runtime.onMessage.removeListener(onMessage); window.removeEventListener('focus', onFocus); };
    }, [key, refresh]);

    const create = useCallback(async (input: CreateCollectionItemWireInput) => {
        if (!organisationId || !collectionId || input.organisationId !== organisationId || input.collectionId !== collectionId) throw new Error('Collection scope changed. Reopen the editor.');
        setPendingAction('create');
        try { const record = await createCollectionItem(input); await refresh(); return record; }
        finally { setPendingAction(null); }
    }, [organisationId, collectionId, refresh]);

    const update = useCallback(async (item: CollectionItemRecord, input: UpdateCollectionItemWireInput) => {
        if (!organisationId || !collectionId || item.organisationId !== organisationId || item.collectionId !== collectionId) throw new Error('Collection scope changed. Reopen the item.');
        setPendingAction(item.id);
        try { const record = await updateCollectionItem(organisationId, item.id, { ...input, expectedUpdatedAt: item.updatedAt }); await refresh(); return record; }
        finally { setPendingAction(null); }
    }, [organisationId, collectionId, refresh]);

    const remove = useCallback(async (item: CollectionItemRecord) => {
        if (!organisationId || !collectionId || item.organisationId !== organisationId || item.collectionId !== collectionId) throw new Error('Collection scope changed. Reopen the item.');
        setPendingAction(item.id);
        try { await deleteCollectionItem(organisationId, item.id); await refresh(); }
        finally { setPendingAction(null); }
    }, [organisationId, collectionId, refresh]);

    const current = state.key === key ? state : { key, records: [], status: key ? 'loading' as const : 'idle' as const, error: null };
    return { items: current.records, status: current.status, error: current.error, pendingAction, refresh, create, update, remove };
};

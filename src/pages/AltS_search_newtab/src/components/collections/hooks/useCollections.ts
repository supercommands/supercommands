import { useCallback, useEffect, useRef, useState } from 'react';
import { createCollection, deleteCollection, listCollectionItems, listCollections, updateCollection } from '../../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionRecord } from '../../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

type CollectionLoadState = {
    organisationId: string | null;
    records: CollectionRecord[];
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
};

export const useCollections = (organisationId: string | null) => {
    const [loadState, setLoadState] = useState<CollectionLoadState>({ organisationId: null, records: [], status: 'idle', error: null });
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const requestId = useRef(0);

    const refresh = useCallback(async (showLoading = false) => {
        const currentRequest = ++requestId.current;
        if (!organisationId) {
            setLoadState({ organisationId: null, records: [], status: 'idle', error: null });
            return;
        }
        if (showLoading) {
            setLoadState({ organisationId, records: [], status: 'loading', error: null });
        }
        try {
            const records = await listCollections(organisationId);
            if (currentRequest === requestId.current) {
                setLoadState({ organisationId, records, status: 'ready', error: null });
            }
        }
        catch (error) {
            if (currentRequest === requestId.current) {
                setLoadState(previous => ({ organisationId, records: previous.organisationId === organisationId ? previous.records : [], status: 'error', error: error instanceof Error ? error.message : 'Could not load collections.' }));
            }
        }
    }, [organisationId]);

    useEffect(() => {
        void refresh(true);
        return () => { requestId.current += 1; };
    }, [refresh]);

    useEffect(() => {
        if (!organisationId) return;
        const handleMessage = (message: unknown) => {
            if (message && typeof message === 'object' && 'action' in message && 'table' in message &&
                message.action === 'db_changed' && (message.table === 'collections' || message.table === 'collectionItems')) {
                void refresh();
            }
        };
        const handleFocus = () => { void refresh(); };
        chrome.runtime.onMessage.addListener(handleMessage);
        window.addEventListener('focus', handleFocus);
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
            window.removeEventListener('focus', handleFocus);
        };
    }, [organisationId, refresh]);

    const create = useCallback(async (name: string) => {
        if (!organisationId) throw new Error('Select an Organisation first.');
        setPendingAction('create');
        try {
            const record = await createCollection({ organisationId, name });
            await refresh();
            return record;
        }
        finally { setPendingAction(null); }
    }, [organisationId, refresh]);

    const rename = useCallback(async (record: CollectionRecord, name: string) => {
        if (!organisationId) throw new Error('Select an Organisation first.');
        setPendingAction(record.id);
        try {
            const updated = await updateCollection(organisationId, record.id, { name, expectedUpdatedAt: record.updatedAt });
            await refresh();
            return updated;
        }
        finally { setPendingAction(null); }
    }, [organisationId, refresh]);

    const remove = useCallback(async (record: CollectionRecord) => {
        if (!organisationId) throw new Error('Select an Organisation first.');
        setPendingAction(record.id);
        try {
            await deleteCollection(organisationId, record.id);
            await refresh();
        }
        finally { setPendingAction(null); }
    }, [organisationId, refresh]);

    const getItemCount = useCallback(async (collectionId: string) => {
        if (!organisationId) throw new Error('Select an Organisation first.');
        return (await listCollectionItems(organisationId, collectionId)).length;
    }, [organisationId]);

    const current = loadState.organisationId === organisationId ? loadState : { organisationId, records: [], status: organisationId ? 'loading' as const : 'idle' as const, error: null };
    return { collections: current.records, status: current.status, error: current.error, pendingAction, refresh, create, rename, remove, getItemCount };
};

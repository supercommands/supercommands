import { useCallback, useEffect, useState } from 'react';
import { collectionAssetKey, idleCollectionAsset, retryCollectionAsset, subscribeCollectionAsset, type CollectionAssetState } from './collectionAssetResources';

export const useCollectionAsset = (organisationId: string | null, itemId: string | null, assetId: string | null, enabled: boolean) => {
    const key = enabled && organisationId && itemId && assetId ? collectionAssetKey(organisationId, itemId, assetId) : null;
    const [snapshot, setSnapshot] = useState<{ key: string; state: CollectionAssetState } | null>(null);
    const retry = useCallback(() => { if (enabled && organisationId && itemId && assetId) retryCollectionAsset(organisationId, itemId, assetId); }, [enabled, organisationId, itemId, assetId]);

    useEffect(() => {
        if (!key || !organisationId || !itemId || !assetId) return;
        return subscribeCollectionAsset(organisationId, itemId, assetId, state => setSnapshot({ key, state }));
    }, [organisationId, itemId, assetId, key]);

    return { ...(snapshot?.key === key ? snapshot.state : idleCollectionAsset), retry };
};

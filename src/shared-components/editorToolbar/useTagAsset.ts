import {useEffect, useState} from 'react';
import {idleTagAsset, subscribeTagAsset, tagAssetKey, type TagAssetState} from './tagAssetResources';

export function useTagAsset(tagId: string, assetId: string): TagAssetState {
    const key = tagAssetKey(tagId, assetId);
    const [snapshot, setSnapshot] = useState<{key: string; state: TagAssetState} | null>(null);
    useEffect(() => subscribeTagAsset(tagId, assetId, state => setSnapshot({key, state})), [tagId, assetId, key]);
    // Never show the previous tag's URL while the new effect is starting.
    return snapshot?.key === key ? snapshot.state : idleTagAsset;
}

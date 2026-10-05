import { readTagImageBlob } from '../../allObjectFolder/src/createObject/tags/tagImageClient';

export type TagAssetState = {status: 'idle' | 'loading' | 'ready' | 'error'; url: string | null; error: string | null};
export const idleTagAsset: TagAssetState = {status: 'idle', url: null, error: null};
type Resource = {state: TagAssetState; listeners: Set<(state: TagAssetState) => void>; abort: AbortController};
const resources = new Map<string, Resource>();
const jobs: (() => Promise<void>)[] = [];
let running = 0;
export const tagAssetKey = (tagId: string, assetId: string) => JSON.stringify([tagId, assetId]);
function drain() {
    while (running < 3 && jobs.length) {
        const job = jobs.shift()!; running++;
        void job().finally(() => { running--; drain(); });
    }
}
function publish(resource: Resource, state: TagAssetState) {
    resource.state = state;
    for (const listener of resource.listeners) listener(state);
}
function start(resource: Resource, tagId: string, assetId: string) {
    const abort = resource.abort;
    publish(resource, {status: 'loading', url: null, error: null});
    jobs.push(async () => {
        if (abort.signal.aborted) return;
        try {
            const blob = await readTagImageBlob(tagId, assetId, abort.signal);
            if (abort.signal.aborted || resource.abort !== abort) return;
            publish(resource, {status: 'ready', url: URL.createObjectURL(blob), error: null});
        } catch (error) {
            if (!abort.signal.aborted && resource.abort === abort)
                publish(resource, {status: 'error', url: null, error: error instanceof Error ? error.message : 'Could not load the tag image.'});
        }
    });
    drain();
}

/** Same ownership/ref-count pattern as Collection assets; at most three active reads. */
export function subscribeTagAsset(tagId: string, assetId: string, listener: (state: TagAssetState) => void) {
    const key = tagAssetKey(tagId, assetId);
    let resource = resources.get(key);
    if (!resource) {
        resource = {state: idleTagAsset, listeners: new Set(), abort: new AbortController()};
        resources.set(key, resource);
    }
    const current = resource;
    current.listeners.add(listener); listener(current.state);
    if (current.state.status === 'idle') start(current, tagId, assetId);
    let subscribed = true;
    return () => {
        if (!subscribed) return;
        subscribed = false;
        current.listeners.delete(listener);
        if (current.listeners.size) return;
        current.abort.abort();
        if (current.state.url) URL.revokeObjectURL(current.state.url);
        if (resources.get(key) === current) resources.delete(key);
    };
}
export function retryTagAsset(tagId: string, assetId: string) {
    const resource = resources.get(tagAssetKey(tagId, assetId));
    if (!resource || resource.state.status === 'loading') return;
    resource.abort.abort();
    if (resource.state.url) URL.revokeObjectURL(resource.state.url);
    resource.abort = new AbortController();
    start(resource, tagId, assetId);
}

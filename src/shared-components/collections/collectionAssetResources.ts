import { readCollectionImage } from '../../allObjectFolder/src/createObject/collections/collectionClient';

export type CollectionAssetState = { status: 'idle' | 'loading' | 'ready' | 'error'; url: string | null; fileName?: string; mimeType?: string; error: string | null };
export const idleCollectionAsset: CollectionAssetState = { status: 'idle', url: null, error: null };
type Resource = { state: CollectionAssetState; listeners: Set<(state: CollectionAssetState) => void>; abort: AbortController };
const resources = new Map<string, Resource>();
const jobs: (() => Promise<void>)[] = [];
let running = 0;
function drain() {
  while (running < 3 && jobs.length) {
    const job = jobs.shift()!; running++;
    void job().finally(() => { running--; drain(); });
  }
}
export const collectionAssetKey = (organisationId: string, itemId: string, assetId: string) => JSON.stringify([organisationId, itemId, assetId]);
const publish = (resource: Resource, state: CollectionAssetState) => {
  resource.state = state;
  for (const listener of resource.listeners) listener(state);
};
function start(resource: Resource, organisationId: string, itemId: string, assetId: string) {
  const abort = resource.abort;
  publish(resource, { status: 'loading', url: null, error: null });
  jobs.push(async () => {
    if (abort.signal.aborted) return;
    try {
      const { blob, fileName } = await readCollectionImage(organisationId, itemId, abort.signal, assetId);
      if (abort.signal.aborted || resource.abort !== abort) return;
      publish(resource, { status: 'ready', url: URL.createObjectURL(blob), fileName, mimeType: blob.type, error: null });
    } catch (error) {
      if (!abort.signal.aborted && resource.abort === abort) publish(resource, { status: 'error', url: null, error: error instanceof Error ? error.message : 'Could not load image.' });
    }
  });
  drain();
}

/** Scoped, reference-counted URLs. Repeated placements share bytes; reads are bounded. */
export function subscribeCollectionAsset(organisationId: string, itemId: string, assetId: string, listener: (state: CollectionAssetState) => void) {
  const key = collectionAssetKey(organisationId, itemId, assetId);
  let resource = resources.get(key);
  if (!resource) {
    resource = { state: idleCollectionAsset, listeners: new Set(), abort: new AbortController() };
    resources.set(key, resource);
  }
  const current = resource;
  current.listeners.add(listener);
  listener(current.state);
  if (current.state.status === 'idle') start(current, organisationId, itemId, assetId);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size) return;
    current.abort.abort();
    if (current.state.url) URL.revokeObjectURL(current.state.url);
    resources.delete(key);
  };
}

export function retryCollectionAsset(organisationId: string, itemId: string, assetId: string) {
  const resource = resources.get(collectionAssetKey(organisationId, itemId, assetId));
  if (!resource || resource.state.status === 'loading') return;
  resource.abort.abort();
  if (resource.state.url) URL.revokeObjectURL(resource.state.url);
  resource.abort = new AbortController();
  start(resource, organisationId, itemId, assetId);
}

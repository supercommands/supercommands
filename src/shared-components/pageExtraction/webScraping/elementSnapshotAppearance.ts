import type { CollectionItemRecord } from '../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { ElementSnapshotRecord } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotTypes';
import { assertElementSnapshotMatchesItem } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { getCollectionElementSnapshot } from '../../../allObjectFolder/src/createObject/collections/collectionClient';
import { subscribeCollectionAsset } from '../../collections/collectionAssetResources';
import { buildElementSnapshotDocument } from './elementSnapshotDocument';

export type ElementSnapshotAppearance = { status: 'loading' } | { status: 'ready'; snapshot: ElementSnapshotRecord; document: string } | { status: 'error' };
type Item = Extract<CollectionItemRecord, { type: 'web-scraping' }>;
export const elementSnapshotAppearanceKey = (item: Item) => JSON.stringify([item.organisationId, item.collectionId, item.id, item.url, item.data.snapshotId]);

function readDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => { reader.abort(); reject(new DOMException('Appearance read cancelled.', 'AbortError')); };
    const clean = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    reader.onload = () => { clean(); resolve(String(reader.result)); };
    reader.onerror = () => { clean(); reject(reader.error || new Error('Could not read saved image.')); };
    reader.onabort = clean;
    if (signal.aborted) { abort(); clean(); } else reader.readAsDataURL(blob);
  });
}
async function localImageData(url: string, signal: AbortSignal): Promise<string> {
  const source = new URL(url.slice(5));
  if (!url.startsWith('blob:') || source.protocol !== location.protocol || source.host !== location.host) throw new Error('Invalid local image resource.');
  const response = await fetch(url, { signal }); const blob = await response.blob();
  const image = new Image();
  try { image.src = url; await image.decode(); if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError'); return await readDataUrl(blob, signal); }
  finally { image.src = ''; }
}
/** Scope-owned resource subscription; stale reads never publish or retain URLs after disposal. */
export function subscribeElementSnapshotAppearance(item: Item, publish: (state: ElementSnapshotAppearance) => void): () => void {
  let active = true, failed = false, ready = false, running = 0;
  const controller = new AbortController(), releases: (() => void)[] = [], jobs: (() => Promise<void>)[] = [];
  const imageData = new Map<string, string>(), scheduled = new Set<string>();
  const dispose = () => { active = false; controller.abort(); jobs.length = 0; releases.splice(0).forEach(release => release()); imageData.clear(); };
  const fail = () => { if (!active || failed) return; failed = true; publish({ status: 'error' }); queueMicrotask(dispose); };
  const pump = () => {
    while (active && !failed && running < 3 && jobs.length) {
      const job = jobs.shift()!; running++;
      void job().catch(fail).finally(() => { running--; pump(); });
    }
  };
  publish({ status: 'loading' });
  void (async () => {
    const snapshot = await getCollectionElementSnapshot(item.organisationId, item.id);
    if (!active) return;
    if (!snapshot) throw new Error('Saved appearance is missing.');
    assertElementSnapshotMatchesItem(snapshot, item);
    const assets = [...new Set(snapshot.resources.map(resource => resource.assetId))];
    const complete = () => {
      if (!active || failed || ready || imageData.size !== assets.length) return;
      const data = new Map(snapshot.resources.map(resource => [resource.id, imageData.get(resource.assetId)!]));
      const document = buildElementSnapshotDocument(snapshot, data);
      ready = true; publish({ status: 'ready', snapshot, document });
    };
    if (!assets.length) { complete(); return; }
    for (const assetId of assets) {
      if (!active || failed) break;
      releases.push(subscribeCollectionAsset(item.organisationId, item.id, assetId, state => {
        if (!active || failed) return;
        if (state.status === 'error') { fail(); return; }
        if (state.status !== 'ready' || !state.url || scheduled.has(assetId)) return;
        scheduled.add(assetId);
        jobs.push(async () => { const data = await localImageData(state.url!, controller.signal); if (!active || failed) return; imageData.set(assetId, data); complete(); });
        pump();
      }));
    }
  })().catch(fail);
  return dispose;
}

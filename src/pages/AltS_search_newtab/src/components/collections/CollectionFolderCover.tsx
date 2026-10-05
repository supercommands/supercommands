import { useEffect, useState } from 'react';
import { listCollectionItems } from '../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import { useCollectionAsset } from './hooks/useCollectionAsset';
import CollectionFolderIcon from './CollectionFolderIcon';
import { collectionFolderPreviews, type CollectionFolderPreview } from './collectionFolderPreviewImages';
import CollectionWebScrapingThumbnail from './CollectionWebScrapingThumbnail';

interface Props {
  organisationId: string;
  collectionId: string;
  visible: boolean;
  compact?: boolean;
}

const placements = [
  'z-30 -rotate-3 group-hover:-translate-y-6 group-hover:-rotate-6',
  'z-20 -translate-x-6 -rotate-6 group-hover:-translate-x-12 group-hover:translate-y-2 group-hover:-rotate-12',
  'z-10 translate-x-6 rotate-6 group-hover:translate-x-12 group-hover:translate-y-2 group-hover:rotate-12',
  'z-0 translate-y-3 -rotate-3 group-hover:translate-y-6 group-hover:rotate-3',
] as const;
const compactPlacements = [
  'z-30 -rotate-3 group-hover:-translate-y-1 group-hover:-rotate-6',
  'z-20 -translate-x-2 -rotate-6 group-hover:-translate-x-3 group-hover:translate-y-0.5 group-hover:-rotate-12',
  'z-10 translate-x-2 rotate-6 group-hover:translate-x-3 group-hover:translate-y-0.5 group-hover:rotate-12',
  'z-0 translate-y-1 -rotate-3 group-hover:translate-y-2 group-hover:rotate-3',
] as const;
type ReadyPreview = Extract<CollectionFolderPreview, { kind: 'capture' }> | { kind: 'image'; url: string };

const CollectionFolderCover = ({ organisationId, collectionId, visible, compact = false }: Props) => {
  const scope = `${organisationId}:${collectionId}`;
  const [loaded, setLoaded] = useState<{ scope: string; previews: CollectionFolderPreview[] }>({
    scope: '',
    previews: [],
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void listCollectionItems(organisationId, collectionId)
      .then(items => {
        if (active) setLoaded({ scope, previews: collectionFolderPreviews(items) });
      })
      .catch(() => {
        if (active) setLoaded({ scope, previews: [] });
      });
    return () => {
      active = false;
    };
  }, [collectionId, organisationId, revision, scope, visible]);

  useEffect(() => {
    if (!visible) return;
    const refreshOnItemChange = (message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        'action' in message &&
        'table' in message &&
        message.action === 'db_changed' &&
        message.table === 'collectionItems'
      )
        setRevision(value => value + 1);
    };
    const refreshOnFocus = () => setRevision(value => value + 1);
    chrome.runtime.onMessage.addListener(refreshOnItemChange);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      chrome.runtime.onMessage.removeListener(refreshOnItemChange);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [visible]);

  const hasLoaded = loaded.scope === scope;
  const candidates = hasLoaded ? loaded.previews : [];
  const imageAt = (index: number) => (candidates[index]?.kind === 'image' ? candidates[index] : null);
  const firstImage = imageAt(0);
  const secondImage = imageAt(1);
  const thirdImage = imageAt(2);
  const fourthImage = imageAt(3);
  const first = useCollectionAsset(organisationId, firstImage?.itemId ?? null, firstImage?.assetId ?? null, visible);
  const second = useCollectionAsset(organisationId, secondImage?.itemId ?? null, secondImage?.assetId ?? null, visible);
  const third = useCollectionAsset(organisationId, thirdImage?.itemId ?? null, thirdImage?.assetId ?? null, visible);
  const fourth = useCollectionAsset(organisationId, fourthImage?.itemId ?? null, fourthImage?.assetId ?? null, visible);
  const assets = [first, second, third, fourth];
  const settled = candidates.every(
    (candidate, index) =>
      candidate.kind === 'capture' || assets[index]?.status === 'ready' || assets[index]?.status === 'error',
  );
  const ready: ReadyPreview[] = [];
  if (settled) {
    candidates.forEach((candidate, index) => {
      if (candidate.kind === 'capture') ready.push(candidate);
      else {
        const url = assets[index]?.url;
        if (url) ready.push({ kind: 'image', url });
      }
    });
  }
  const showFolderIcon = hasLoaded && settled && ready.length === 0;
  const loading = !hasLoaded || (candidates.length > 0 && !settled);

  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden="true">
      {loading && (
        <span className={`absolute animate-pulse rounded-md bg-[var(--color-inputBg)] motion-reduce:animate-none ${compact ? 'inset-1' : 'inset-x-2 inset-y-2'}`} />
      )}
      {showFolderIcon ? (
        <span className={`absolute inset-x-0 flex justify-center ${compact ? 'bottom-1' : 'bottom-3'}`}>
          <CollectionFolderIcon className={compact ? 'h-8 w-8' : 'h-16 w-16'} />
        </span>
      ) : (
        ready.map((preview, index) => (
          <div
            key={preview.kind === 'capture' ? preview.item.id : preview.url}
            className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`relative aspect-video transform-gpu overflow-hidden rounded-md bg-[var(--color-cardBg)] shadow-lg transition-transform duration-500 ease-in-out motion-reduce:transition-none ${ready.length === 1 ? `w-4/5 ${compact ? 'group-hover:-translate-y-0.5' : 'group-hover:-translate-y-1'}` : `w-3/5 ${compact ? compactPlacements[index] : placements[index]}`}`}>
              {preview.kind === 'capture' ? (
                <CollectionWebScrapingThumbnail item={preview.item} compact />
              ) : (
                <img src={preview.url} alt="" className="h-full w-full object-cover object-center" />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default CollectionFolderCover;

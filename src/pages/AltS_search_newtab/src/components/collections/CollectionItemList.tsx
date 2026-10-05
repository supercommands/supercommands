import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Trash2, Type } from 'lucide-react';
import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { useCollectionAsset } from './hooks/useCollectionAsset';
import CollectionWebScrapingCollage from './CollectionWebScrapingCollage';
import CollectionWebScrapingThumbnail from './CollectionWebScrapingThumbnail';
import CollectionWebsitePreview from './CollectionWebsitePreview';
import { getWebScrapingCardPreview } from './collectionCardPreview';
import { collectionItemUrl } from './collectionItemRoute';

interface Props {
  organisationId: string;
  items: CollectionItemRecord[];
  onOpen: (item: CollectionItemRecord) => void;
  onDelete: (item: CollectionItemRecord) => void;
  deletingItemId: string | null;
}

const labelFor = (type: CollectionItemRecord['type']) =>
  type === 'web-scraping' ? 'Web Scraping' : type === 'screenshot' ? 'Image' : type[0].toUpperCase() + type.slice(1);
const withoutRepeatedTitle = (text: string, title: string) => {
  const excerpt = text.trim();
  const name = title.trim();
  return name && excerpt.toLocaleLowerCase().startsWith(name.toLocaleLowerCase())
    ? excerpt.slice(name.length).trim()
    : excerpt;
};

const CollectionItemCard = ({
  organisationId,
  item,
  onOpen,
  onDelete,
  deletingItemId,
}: {
  organisationId: string;
  item: CollectionItemRecord;
  onOpen: (item: CollectionItemRecord) => void;
  onDelete: (item: CollectionItemRecord) => void;
  deletingItemId: string | null;
}) => {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !cardRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);
  const scraping = useMemo(() => (item.type === 'web-scraping' ? getWebScrapingCardPreview(item.data) : null), [item]);
  const scrapingImageCount = scraping?.assetIds.length ?? 0;
  const assetId =
    item.type === 'screenshot' ? item.data.assetId : scrapingImageCount === 1 ? (scraping?.assetIds[0] ?? null) : null;
  const preview = useCollectionAsset(organisationId, assetId ? item.id : null, assetId, visible && Boolean(assetId));
  return (
    <div className="group relative min-w-0 focus-within:z-20">
    <a
      ref={cardRef}
      href={collectionItemUrl({ organisationId, collectionId: item.collectionId, itemId: item.id })}
      onClick={event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen(item);
      }}
      onKeyDown={event => {
        if (event.key !== ' ') return;
        event.preventDefault();
        onOpen(item);
      }}
      aria-label={`Open ${item.title}`}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
      <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-cardBg)] text-[var(--color-textSecondary)]">
        {item.type === 'link' ? (
          <CollectionWebsitePreview url={item.url} savedFaviconUrl={item.data.faviconUrl} excerpt={item.note?.trim()} />
        ) : item.type === 'article' ? (
          <CollectionWebsitePreview
            url={item.url}
            excerpt={withoutRepeatedTitle(item.data.text, item.title) || 'Article text unavailable'}
          />
        ) : item.type === 'web-scraping' ? (
          scrapingImageCount > 1 ? (
            <CollectionWebScrapingCollage
              organisationId={organisationId}
              itemId={item.id}
              assetIds={scraping?.assetIds ?? []}
              visible={visible}
            />
          ) : scrapingImageCount === 1 ? (
            preview.url ? (
              <img src={preview.url} alt="" className="h-full w-full object-contain object-bottom" />
            ) : (
              <Camera size={32} strokeWidth={1.5} aria-hidden="true" />
            )
          ) : (
            <CollectionWebScrapingThumbnail item={item} />
          )
        ) : item.type === 'screenshot' ? (
          preview.url ? (
            <img src={preview.url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2">
              <Camera size={32} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm">
                {preview.status === 'error'
                  ? 'Preview unavailable'
                  : preview.status === 'loading'
                    ? 'Loading image…'
                    : 'Image'}
              </span>
            </span>
          )
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden px-4 py-3 text-center">
            <Type size={32} strokeWidth={1.5} aria-hidden="true" />
            <span className="line-clamp-3 overflow-hidden text-sm">
              {withoutRepeatedTitle(item.data.text, item.title)}
            </span>
          </span>
        )}
      </div>
      <span className="flex min-h-14 shrink-0 flex-col gap-1 px-1 py-2">
        <span
          className="shrink-0 truncate text-sm font-medium text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]"
          title={item.title}>
          {item.title}
        </span>
        <span className="shrink-0 text-xs text-[var(--color-textMuted)]">{labelFor(item.type)}</span>
      </span>
    </a>
    <button type="button" onClick={() => onDelete(item)} disabled={deletingItemId !== null}
      aria-label={`Delete ${item.title}`} title={`Delete ${item.title}`}
      className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-cardBg)] text-[var(--color-iconDefault)] opacity-0 transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:cursor-wait disabled:opacity-50 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
      <Trash2 size={15} aria-hidden="true" />
    </button>
    </div>
  );
};

const CollectionItemList = ({ organisationId, items, onOpen, onDelete, deletingItemId }: Props) => (
  <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 280px))' }}>
    {items.map(item => (
      <CollectionItemCard key={item.id} organisationId={organisationId} item={item} onOpen={onOpen} onDelete={onDelete} deletingItemId={deletingItemId} />
    ))}
  </div>
);

export default CollectionItemList;

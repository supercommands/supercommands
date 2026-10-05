import { ArrowLeft, Camera, ExternalLink, FileText, Pencil, Trash2, Type } from 'lucide-react';
import type { CollectionItemRecord, CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import CollectionItemPropertiesPanel from './CollectionItemPropertiesPanel';
import { useCollectionItemProperties } from './hooks/useCollectionItemProperties';
import { getImageFileExtension } from '../../../../../storage/assets/assetPolicy';
import { CollectionElementClipContent } from './CollectionElementClipContent';
import { getWebsitePopupClipLabel } from '../../../../../shared-components/websitePopup/websitePopupLabels';
import CollectionSourceFavicon from './CollectionSourceFavicon';
import CollectionItemTags from './CollectionItemTags';
import { useCollectionAsset } from './hooks/useCollectionAsset';
import { isCollectionNewTabUrl, collectionSourceLabel } from '../../../../../shared-components/collections/collectionCaptureSource';

interface CollectionItemViewProps {
  organisationId: string;
  item: CollectionItemRecord;
  onBack: () => void;
  onEdit: (item: CollectionItemRecord) => void;
  onDelete: (item: CollectionItemRecord) => void;
  definitions: CollectionPropertyDefinition[];
  metadataEditing: boolean;
  propertyDefinitionPending: boolean;
  onAddProperty: () => void;
}

const getDomain = (url: string): string => {
  if (isCollectionNewTabUrl(url)) return collectionSourceLabel(url);
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const CollectionItemView = ({ organisationId, item, onBack, onEdit, onDelete, definitions, metadataEditing, propertyDefinitionPending, onAddProperty }: CollectionItemViewProps) => {
  const properties = useCollectionItemProperties(item);
  const runAfterSave = async (action: (record: CollectionItemRecord) => void) => {
    if (metadataEditing || !await properties.flushBeforeLeave()) return;
    const record = properties.getCurrentRecord();
    if (record) action(record);
  };
  const Icon =
    item.type === 'article' || item.type === 'web-scraping' ? FileText : item.type === 'text' ? Type : Camera;
  const image = useCollectionAsset(
    organisationId,
    item.id,
    item.type === 'screenshot' ? item.data.assetId : null,
    item.type === 'screenshot',
  );

  const downloadImage = () => {
    if (!image.url || item.type !== 'screenshot') return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.fileName || `${item.title || 'image'}.${getImageFileExtension(image.mimeType || '')}`;
    link.click();
  };

  return (
    <div className="relative grid min-h-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="absolute right-0 top-0 z-10 flex items-center justify-end gap-2">
        {item.type === 'screenshot' && image.url && (
          <button
            type="button"
            onClick={downloadImage}
            className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-1.5 text-sm text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]">
            Download
          </button>
        )}
        <button
          type="button"
          onClick={() => { void runAfterSave(onEdit); }}
          disabled={metadataEditing || properties.pending}
          aria-label={`Edit ${item.title}`}
          title="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => { void runAfterSave(onDelete); }}
          disabled={metadataEditing || properties.pending}
          aria-label={`Delete ${item.title}`}
          title="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      <article className="col-span-1 mx-auto min-w-0 w-full max-w-3xl pt-14 xl:col-span-8">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => { void runAfterSave(() => onBack()); }}
            disabled={metadataEditing}
            aria-label="Back to items"
            title="Back to items"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 space-y-5">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-[var(--color-textSecondary)]">
                {item.type === 'web-scraping'
                  ? getWebsitePopupClipLabel('web-scraping')
                  : item.type === 'screenshot'
                    ? 'Image'
                    : item.type[0].toUpperCase() + item.type.slice(1)}
              </p>
              <h2 className="break-words text-xl font-semibold text-[var(--color-textPrimary)]">{item.title}</h2>
            </div>

            <CollectionItemTags item={item}/>
            {item.note && (
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-textSecondary)]">{item.note}</p>
            )}

            {item.type === 'link' ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${item.title} in a new tab`}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4 text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-inputBg)]">
                  <CollectionSourceFavicon url={item.url} savedUrl={item.data.faviconUrl} size={28} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium" title={getDomain(item.url)}>
                    {getDomain(item.url)}
                  </span>
                  <span className="truncate text-xs text-[var(--color-textMuted)]" title={item.url}>
                    {item.url}
                  </span>
                </span>
                <ExternalLink size={16} className="shrink-0 text-[var(--color-textSecondary)]" aria-hidden="true" />
              </a>
            ) : item.type === 'web-scraping' ? (
              <CollectionElementClipContent item={item} />
            ) : item.type === 'screenshot' ? (
              image.url ? (
                <img src={image.url} alt={item.title} className="block h-auto max-h-[70vh] max-w-full object-contain" />
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-lg bg-[var(--color-cardBg)] text-[var(--color-textSecondary)]">
                  <Icon size={36} aria-hidden="true" />
                </div>
              )
            ) : (
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-textPrimary)]">
                {item.data.text}
              </div>
            )}

            {item.type === 'article' && item.data.author && (
              <p className="text-sm text-[var(--color-textSecondary)]">By {item.data.author}</p>
            )}
            {item.type !== 'link' && item.url && (
              <p className="break-all text-xs text-[var(--color-textSecondary)]">
                Source:{' '}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[var(--color-textPrimary)]">
                  {item.url}
                </a>
              </p>
            )}
          </div>
        </div>
      </article>
      <div className="col-span-1 min-w-0 w-full border-t border-[var(--color-borderDefault)] pt-5 xl:col-span-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-14">
        <div className="xl:sticky xl:top-0">
          <CollectionItemPropertiesPanel item={item} definitions={definitions} controller={properties}
            disabled={metadataEditing || propertyDefinitionPending} onAddProperty={onAddProperty}/>
        </div>
      </div>
    </div>
  );
};

export default CollectionItemView;

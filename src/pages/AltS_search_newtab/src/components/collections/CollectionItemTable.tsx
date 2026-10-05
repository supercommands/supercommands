import { useEffect, useRef, useState } from 'react';
import { Camera, Plus, Trash2, Type } from 'lucide-react';
import type { CollectionItemRecord, CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import CollectionPropertyValueInput from './CollectionPropertyValueInput';
import CollectionPropertySaveStatus from './CollectionPropertySaveStatus';
import { useCollectionItemProperties } from './hooks/useCollectionItemProperties';
import { collectionTableColumns } from './collectionTableColumns';
import { useCollectionAsset } from './hooks/useCollectionAsset';
import CollectionSourceFavicon from './CollectionSourceFavicon';
import CollectionItemTags from './CollectionItemTags';
import { collectionItemUrl } from './collectionItemRoute';

interface Props {
  organisationId: string;
  items: CollectionItemRecord[];
  onOpen: (item: CollectionItemRecord) => void;
  onDelete: (item: CollectionItemRecord) => void;
  deletingItemId: string | null;
  definitions: CollectionPropertyDefinition[];
  onAddProperty: () => void;
  onRenameProperty: (property: CollectionPropertyDefinition) => void;
  propertyPending: boolean;
  focusPropertyId: string | null;
}

const typeLabel = (type: CollectionItemRecord['type']) =>
  type === 'web-scraping' ? 'Web Scraping' : type === 'screenshot' ? 'Image' : type[0].toUpperCase() + type.slice(1);

const sourceLabel = (item: CollectionItemRecord) => {
  if (!item.url) return item.type === 'screenshot' ? 'Local image' : '—';
  try {
    return new URL(item.url).hostname;
  } catch {
    return item.url;
  }
};

const modifiedLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const CollectionItemRow = ({
  organisationId,
  item,
  onOpen,
  onDelete,
  deletingItemId,
  definitions,
  template,
  focusPropertyId,
}: {
  organisationId: string;
  item: CollectionItemRecord;
  onOpen: Props['onOpen'];
  onDelete: Props['onDelete'];
  deletingItemId: string | null;
  definitions: CollectionPropertyDefinition[];
  template: string;
  focusPropertyId: string | null;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const properties = useCollectionItemProperties(item);
  const focusInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusPropertyId) { focusInput.current?.focus(); focusInput.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }, [focusPropertyId]);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !rowRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const assetId = item.type === 'screenshot' ? item.data.assetId : null;
  const preview = useCollectionAsset(organisationId, assetId ? item.id : null, assetId, visible && Boolean(assetId));
  const source = sourceLabel(item);
  const modified = modifiedLabel(item.updatedAt);

  return (
    <div
      ref={rowRef}
      className="grid min-h-14 w-full items-center border-b border-[var(--color-borderDefault)] text-left text-sm text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]"
      style={{ gridTemplateColumns: template }}>
      <a href={collectionItemUrl({ organisationId, collectionId: item.collectionId, itemId: item.id })}
        aria-label={`Open ${item.title}`}
        onClick={event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          void properties.flushBeforeLeave().then(saved => { if (saved) onOpen(item); });
        }}
        onKeyDown={event => {
          if (event.key !== ' ') return;
          event.preventDefault();
          void properties.flushBeforeLeave().then(saved => { if (saved) onOpen(item); });
        }}
        className="flex min-w-0 items-center gap-3 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-[var(--color-iconDefault)]">
          {preview.url ? (
            <img src={preview.url} alt="" className="h-full w-full object-cover" />
          ) : item.type === 'link' ? (
            <CollectionSourceFavicon url={item.url} savedUrl={item.data.faviconUrl} size={20} />
          ) : item.type === 'article' || item.type === 'web-scraping' ? (
            <CollectionSourceFavicon url={item.url} size={20} />
          ) : item.type === 'screenshot' ? (
            <Camera size={20} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Type size={20} strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-[var(--color-textPrimary)]" title={item.title}>
            {item.title}
          </span>
          <CollectionItemTags item={item} />
        </span>
      </a>
      <span className="truncate px-3" title={typeLabel(item.type)}>
        {typeLabel(item.type)}
      </span>
      <span className="truncate px-3 text-[var(--color-textMuted)]" title={source}>
        {source}
      </span>
      <time
        className="truncate px-3 text-[var(--color-textMuted)]"
        dateTime={new Date(item.updatedAt).toISOString()}
        title={new Date(item.updatedAt).toLocaleString()}>
        {modified}
      </time>
      {definitions.map(definition => <div key={definition.id} className="min-w-0 px-3 py-2">
        <CollectionPropertyValueInput inputRef={focusPropertyId === definition.id ? focusInput : undefined}
          definition={definition} itemTitle={item.title} value={properties.values[definition.id] ?? ''}
          onChange={value => properties.change(definition.id, value)} onFlush={properties.flush} />
      </div>)}
      <div className="min-w-0 px-3 py-2 text-xs text-[var(--color-textMuted)]">
        <CollectionPropertySaveStatus controller={properties} itemId={item.id} />
      </div>
      <div className="px-3 py-2">
        <button type="button" aria-label={`Delete ${item.title}`} title={`Delete ${item.title}`}
          disabled={deletingItemId !== null}
          onClick={() => { void properties.flushBeforeLeave().then(saved => { if (saved) onDelete(item); }); }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:cursor-wait disabled:opacity-50">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const CollectionItemTable = ({ organisationId, items, onOpen, onDelete, deletingItemId, definitions, onAddProperty, onRenameProperty, propertyPending, focusPropertyId }: Props) => {
  const columns = collectionTableColumns(definitions);
  const template = columns.map(column => column.size).join(' ');
  return (
  <div className="w-full overflow-x-auto custom-scrollbar">
    <div className="min-w-[690px]" style={{ minWidth: columns.reduce((width, column) => width + Number(column.size.match(/\d+/)?.[0] ?? 0), 0) }}>
      <div
        className="grid border-b border-[var(--color-borderDefault)] text-xs font-medium text-[var(--color-textMuted)]"
        style={{ gridTemplateColumns: template }}>
        {columns.map(column => column.property
          ? <button key={column.id} type="button" disabled={propertyPending} title={`Rename ${column.label}`} aria-label={`Rename property ${column.label}`}
              onClick={() => onRenameProperty(column.property!)} className="min-w-0 truncate px-3 py-2 text-left hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50">{column.label}</button>
          : column.id === 'add-property'
            ? <button key={column.id} type="button" disabled={propertyPending} onClick={onAddProperty} aria-label="Add new column" title="Add new column"
                className="flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50"><Plus size={16} aria-hidden="true"/>Property</button>
            : <span key={column.id} className="px-3 py-2">{column.label}</span>)}
      </div>
      {items.map((item, index) => (
        <CollectionItemRow key={`${item.collectionId}:${item.id}`} organisationId={organisationId} item={item} onOpen={onOpen} onDelete={onDelete} deletingItemId={deletingItemId}
          definitions={definitions} template={template} focusPropertyId={index === 0 ? focusPropertyId : null} />
      ))}
    </div>
  </div>
);
};

export default CollectionItemTable;

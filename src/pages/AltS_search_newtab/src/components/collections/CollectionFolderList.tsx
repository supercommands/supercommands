import { useEffect, useRef, useState } from 'react';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import CollectionActionsMenu from './CollectionActionsMenu';
import CollectionFolderCover from './CollectionFolderCover';

interface CollectionFolderListProps {
  organisationId: string;
  collections: CollectionRecord[];
  onOpen: (collection: CollectionRecord) => void;
  onRename: (collection: CollectionRecord) => void;
  onDelete: (collection: CollectionRecord) => void;
}

const CollectionFolderRow = ({ organisationId, collection, onOpen, onRename, onDelete }: Omit<CollectionFolderListProps, 'collections'> & { collection: CollectionRecord }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !rowRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const modified = new Date(collection.updatedAt);
  return <div ref={rowRef} className="group relative grid grid-cols-[minmax(0,1fr)_2.5rem] items-center border-b border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] focus-within:z-20 lg:grid-cols-[minmax(0,1fr)_9rem_2.5rem]">
    <button type="button" onClick={() => onOpen(collection)} aria-label={`Open ${collection.name}`} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]">
      <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md"><CollectionFolderCover organisationId={organisationId} collectionId={collection.id} visible={visible} compact/></span>
      <span className="min-w-0 truncate text-sm font-medium text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]" title={collection.name}>{collection.name}</span>
    </button>
    <time dateTime={modified.toISOString()} title={modified.toLocaleString()} className="hidden truncate px-2 text-xs text-[var(--color-textMuted)] lg:block">
      {modified.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
    </time>
    <div className="pointer-events-none justify-self-end opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
      <CollectionActionsMenu name={collection.name} onRename={() => onRename(collection)} onDelete={() => onDelete(collection)} compact/>
    </div>
  </div>;
};

const CollectionFolderList = ({ organisationId, collections, onOpen, onRename, onDelete }: CollectionFolderListProps) => <div className="w-full">
  <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] border-b border-[var(--color-borderDefault)] text-xs font-medium text-[var(--color-textMuted)] lg:grid-cols-[minmax(0,1fr)_9rem_2.5rem]">
    <span className="px-2 py-2">Name</span>
    <span className="hidden px-2 py-2 lg:block">Modified</span>
    <span aria-hidden="true"/>
  </div>
  {collections.map(collection => <CollectionFolderRow key={collection.id} organisationId={organisationId} collection={collection} onOpen={onOpen} onRename={onRename} onDelete={onDelete}/>)}
</div>;

export default CollectionFolderList;

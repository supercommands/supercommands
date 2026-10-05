import { useEffect, useRef, useState } from 'react';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import CollectionActionsMenu from './CollectionActionsMenu';
import CollectionFolderCover from './CollectionFolderCover';

interface CollectionFolderGridProps {
  organisationId: string;
  collections: CollectionRecord[];
  onOpen: (collection: CollectionRecord) => void;
  onRename: (collection: CollectionRecord) => void;
  onDelete: (collection: CollectionRecord) => void;
}

const CollectionFolderCard = ({
  organisationId,
  collection,
  onOpen,
  onRename,
  onDelete,
}: Omit<CollectionFolderGridProps, 'collections'> & { collection: CollectionRecord }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !cardRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cardRef} className="group relative min-w-0 focus-within:z-20">
      <button
        type="button"
        onClick={() => onOpen(collection)}
        className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
        aria-label={`Open ${collection.name}`}>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <CollectionFolderCover organisationId={organisationId} collectionId={collection.id} visible={visible} />
        </div>
      </button>
      <div className="relative z-40 mt-2 flex h-8 min-w-0 items-center justify-center gap-1">
        <span aria-hidden="true" className="h-8 w-8 shrink-0" />
        <button
          type="button"
          onClick={() => onOpen(collection)}
          className="min-w-0 truncate rounded-md text-center text-sm font-medium text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
          title={collection.name}>
          {collection.name}
        </button>
        <div className="pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
          <CollectionActionsMenu
            name={collection.name}
            onRename={() => onRename(collection)}
            onDelete={() => onDelete(collection)}
            compact
          />
        </div>
      </div>
    </div>
  );
};

const CollectionFolderGrid = ({
  organisationId,
  collections,
  onOpen,
  onRename,
  onDelete,
}: CollectionFolderGridProps) => {
  return (
    <div
      className="grid gap-[18px]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), min(100%, 270px)))' }}>
      {collections.map(collection => (
        <CollectionFolderCard
          key={collection.id}
          organisationId={organisationId}
          collection={collection}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default CollectionFolderGrid;

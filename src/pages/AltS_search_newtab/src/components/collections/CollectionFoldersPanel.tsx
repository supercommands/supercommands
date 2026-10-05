import { Search } from 'lucide-react';
import WebCollectionIcon from '../../../../../shared-components/icons/webCollectionIcon';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

interface CollectionFoldersPanelProps {
    collections: CollectionRecord[];
    activeCollectionId: string | null;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onOpen: (collection: CollectionRecord) => void;
}

const CollectionFoldersPanel = ({ collections, activeCollectionId, searchQuery, onSearchChange, onOpen }: CollectionFoldersPanelProps) => (
    <aside aria-label="Webclip folders" className="flex h-full min-h-0 w-[240px] shrink-0 flex-col border-r border-[var(--color-borderDefault)] bg-transparent">
      <div className="shrink-0 px-2 pb-1.5 pt-2">
        <label className="relative block">
          <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]"/>
          <input type="search" value={searchQuery} onChange={event => onSearchChange(event.target.value)} aria-label="Search webclips and items" placeholder="Search folders and items..." className="h-9 w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent pl-7 pr-2 text-xs text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)] focus:border-[var(--color-focusRing)] focus:ring-1 focus:ring-[var(--color-focusRing)]"/>
        </label>
      </div>
      <nav aria-label="Webclips" className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 custom-scrollbar">
        {collections.map(collection => <button key={collection.id} type="button" onClick={() => onOpen(collection)} aria-current={activeCollectionId === collection.id ? 'page' : undefined} title={collection.name} className={`group flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)] ${activeCollectionId === collection.id ? 'bg-[var(--color-hoverBg)]' : 'hover:bg-[var(--color-hoverBg)]'}`}>
          <WebCollectionIcon size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
          <span className={`min-w-0 truncate transition-opacity ${activeCollectionId === collection.id ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-textSecondary)] opacity-75 group-hover:opacity-95'}`}>{collection.name}</span>
        </button>)}
        {searchQuery.trim() && collections.length === 0 && <p role="status" className="px-2.5 py-2 text-xs text-[var(--color-textMuted)]">No matching webclips.</p>}
      </nav>
    </aside>
);

export default CollectionFoldersPanel;

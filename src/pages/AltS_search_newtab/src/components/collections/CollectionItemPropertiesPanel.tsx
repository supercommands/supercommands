import { Plus } from 'lucide-react';
import type { CollectionItemRecord, CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { useCollectionItemProperties } from './hooks/useCollectionItemProperties';
import CollectionItemPropertyFields from './CollectionItemPropertyFields';

/** Permanent transparent detail column; the item view retains its single autosave owner. */
export default function CollectionItemPropertiesPanel({ item, definitions, controller, disabled, onAddProperty }: {
  item: CollectionItemRecord;
  definitions: CollectionPropertyDefinition[];
  controller: ReturnType<typeof useCollectionItemProperties>;
  disabled: boolean;
  onAddProperty: () => void;
}) {
  return <aside aria-label="Item properties" className="min-w-0 space-y-5">
    <h3 className="text-sm font-medium text-[var(--color-textPrimary)]">Properties</h3>
    {definitions.length
      ? <CollectionItemPropertyFields item={item} definitions={definitions} controller={controller} disabled={disabled}/>
      : <p className="text-xs text-[var(--color-textSecondary)]">No custom properties yet.</p>}
    <div className="flex justify-center">
      <button type="button" disabled={disabled} onClick={onAddProperty}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50">
        <Plus size={16} aria-hidden="true"/> Add property
      </button>
    </div>
  </aside>;
}

import type { CollectionItemRecord, CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { useCollectionItemProperties } from './hooks/useCollectionItemProperties';
import CollectionPropertyValueInput from './CollectionPropertyValueInput';
import CollectionPropertySaveStatus from './CollectionPropertySaveStatus';

interface Props {
  item: CollectionItemRecord;
  definitions: CollectionPropertyDefinition[];
  controller: ReturnType<typeof useCollectionItemProperties>;
  disabled: boolean;
}

/** Pure renderer: the item view owns the same controller used by table rows. */
export default function CollectionItemPropertyFields({ item, definitions, controller, disabled }: Props) {
  if (!definitions.length) return null;
  return <section aria-label="Custom properties" className="space-y-4">
    {definitions.map(definition => <div key={definition.id}>
      <CollectionPropertyValueInput definition={definition} itemTitle={item.title} showLabel multiline disabled={disabled}
        value={controller.values[definition.id] ?? ''} onChange={value => controller.change(definition.id, value)} onFlush={controller.flush} />
    </div>)}
    <CollectionPropertySaveStatus controller={controller} itemId={item.id} />
  </section>;
}

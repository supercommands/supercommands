import type { CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

export interface CollectionTableColumn {
  id: string;
  label: string;
  size: string;
  property?: CollectionPropertyDefinition;
}

/** Reuse the existing table widths for both fixed and custom columns. */
export function collectionTableColumns(definitions: readonly CollectionPropertyDefinition[]): CollectionTableColumn[] {
  return [
    { id: 'name', label: 'Name', size: 'minmax(240px, 2fr)' },
    { id: 'type', label: 'Type', size: 'minmax(120px, .75fr)' },
    { id: 'source', label: 'Source', size: 'minmax(180px, 1fr)' },
    { id: 'modified', label: 'Modified', size: 'minmax(150px, .75fr)' },
    ...definitions.map(property => ({ id: property.id, label: property.label, size: 'minmax(180px, 1fr)', property })),
    { id: 'add-property', label: 'Add new column', size: 'minmax(120px, .75fr)' },
    { id: 'delete', label: 'Delete', size: 'minmax(120px, .75fr)' },
  ];
}

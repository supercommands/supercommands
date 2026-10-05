import { db } from '../../../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import { ownedCollection, ownedItem, checkRevision } from '../collectionOwnership';
import { CollectionStorageError } from '../collectionErrors';
import { fields, invalid, object, requiredText } from '../collectionValidation';
import type { CollectionRecord, CollectionItemRecord } from '../collectionTypes';
import type { AddCollectionPropertyInput, RenameCollectionPropertyInput, SetCollectionItemPropertyValueInput } from './collectionPropertyInputs';
import { collectionPropertyLabel, collectionPropertyRevision, collectionPropertyTextValue } from './collectionPropertyValidation';

function findProperty(collection: CollectionRecord, propertyId: string) {
  const definition = collection.propertyDefinitions.find(property => property.id === propertyId);
  if (!definition) throw new CollectionStorageError('NOT_FOUND', 'Property not found in this Collection.');
  return definition;
}

export async function addCollectionProperty(organisationId: string, collectionId: string, input: AddCollectionPropertyInput): Promise<CollectionRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID');
  collectionId = requiredText(collectionId, 'Collection ID');
  const value = object(input, 'Property input');
  fields(value, ['label', 'type', 'expectedUpdatedAt']);
  if (value.type !== undefined && value.type !== 'text') invalid('Only Text properties are supported.');
  const label = collectionPropertyLabel(value.label, true);
  const expected = collectionPropertyRevision(value.expectedUpdatedAt);
  return db.transaction('rw', [db.organisations, db.collections], async () => {
    const current = await ownedCollection(organisationId, collectionId);
    checkRevision(current, expected);
    const record: CollectionRecord = { ...current,
      propertyDefinitions: [...current.propertyDefinitions, { id: generateEntityId('collectionProperty'), label, type: 'text' }],
      updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.collections.put(record);
    return record;
  });
}

export async function renameCollectionProperty(organisationId: string, collectionId: string, input: RenameCollectionPropertyInput): Promise<CollectionRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID');
  collectionId = requiredText(collectionId, 'Collection ID');
  const value = object(input, 'Property rename');
  fields(value, ['propertyId', 'label', 'expectedUpdatedAt']);
  const propertyId = requiredText(value.propertyId, 'Property ID');
  const label = collectionPropertyLabel(value.label);
  const expected = collectionPropertyRevision(value.expectedUpdatedAt);
  return db.transaction('rw', [db.organisations, db.collections], async () => {
    const current = await ownedCollection(organisationId, collectionId);
    checkRevision(current, expected);
    const definition = findProperty(current, propertyId);
    if (definition.label === label) return current;
    const record: CollectionRecord = { ...current,
      propertyDefinitions: current.propertyDefinitions.map(property => property.id === propertyId ? { ...property, label } : property),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.collections.put(record);
    return record;
  });
}

export async function setCollectionItemPropertyValue(organisationId: string, itemId: string, input: SetCollectionItemPropertyValueInput): Promise<CollectionItemRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID');
  itemId = requiredText(itemId, 'Item ID');
  const value = object(input, 'Property value input');
  fields(value, ['propertyId', 'value', 'expectedUpdatedAt']);
  const propertyId = requiredText(value.propertyId, 'Property ID');
  const text = collectionPropertyTextValue(value.value);
  const expected = collectionPropertyRevision(value.expectedUpdatedAt);
  return db.transaction('rw', [db.organisations, db.collections, db.collectionItems], async () => {
    const current = await ownedItem(organisationId, itemId);
    checkRevision(current, expected);
    const collection = await ownedCollection(organisationId, current.collectionId);
    const definition = findProperty(collection, propertyId);
    if (definition.type !== 'text') invalid('Only Text properties are supported.');
    const propertyValues = { ...current.propertyValues };
    const hasValue = Object.prototype.hasOwnProperty.call(propertyValues, propertyId);
    if (text === null) {
      if (!hasValue) return current;
      delete propertyValues[propertyId];
    } else {
      if (hasValue && propertyValues[propertyId] === text) return current;
      // Define an own data property even for a historical non-generated key.
      Object.defineProperty(propertyValues, propertyId, { value: text, enumerable: true, configurable: true, writable: true });
    }
    const record = { ...current, propertyValues, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.collectionItems.put(record);
    return record;
  });
}

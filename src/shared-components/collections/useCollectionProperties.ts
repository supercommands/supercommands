import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { addCollectionProperty, renameCollectionProperty, CollectionClientError, getCollection } from '../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionRecord } from '../../allObjectFolder/src/createObject/collections/collectionTypes';

/** One definition owner shared by the selected Collection's table and property editor. */
export function useCollectionProperties(collection: CollectionRecord | null) {
  const session = useMemo(() => ({ record: collection, active: false, pending: false,
    error: null as string | null, unknownOutcome: false, notify: () => {} }), [collection?.organisationId, collection?.id]);
  const [version, render] = useReducer(value => value + 1, 0);
  useEffect(() => {
    session.active = true; session.notify = render;
    return () => { session.active = false; session.notify = () => {}; };
  }, [session]);
  useEffect(() => {
    if (collection && !session.pending && (!session.record || collection.updatedAt > session.record.updatedAt)) {
      session.record = collection; session.notify();
    }
  }, [collection, session, version]);

  const mutate = useCallback(async (action: 'add' | 'rename', label: string, propertyId?: string) => {
    const current = session.record;
    if (!session.active || !current) throw new Error('Collection scope changed. Reopen the Collection.');
    if (session.pending) throw new Error('A property change is already saving.');
    if (session.unknownOutcome) throw new Error('Reload the Collection to review the previous change before adding or renaming a property.');
    session.pending = true; session.error = null; session.notify();
    try {
      const record = action === 'add'
        ? await addCollectionProperty(current.organisationId, current.id, { label, type: 'text', expectedUpdatedAt: current.updatedAt })
        : await renameCollectionProperty(current.organisationId, current.id, { label, propertyId: propertyId!, expectedUpdatedAt: current.updatedAt });
      if (session.active) { session.record = record; return record; }
      return null;
    } catch (failure) {
      if (session.active) {
        session.error = failure instanceof Error ? failure.message : 'Could not save the property.';
        session.unknownOutcome = failure instanceof CollectionClientError && failure.code === 'TRANSPORT_ERROR';
      }
      throw failure;
    } finally {
      session.pending = false; if (session.active) session.notify();
    }
  }, [session]);

  const reload = useCallback(async () => {
    const current = session.record;
    if (!session.active || !current || session.pending) return null;
    session.pending = true; session.notify();
    try {
      const record = await getCollection(current.organisationId, current.id);
      if (!session.active) return null;
      session.record = record; session.unknownOutcome = false; session.error = null;
      return record;
    } catch (failure) {
      if (session.active) session.error = failure instanceof Error ? failure.message : 'Could not reload the Collection.';
      throw failure;
    } finally { session.pending = false; if (session.active) session.notify(); }
  }, [session]);

  const add = useCallback((label = '') => mutate('add', label), [mutate]);
  const rename = useCallback((propertyId: string, label: string) => mutate('rename', label, propertyId), [mutate]);
  return { collection: session.record, definitions: session.record?.propertyDefinitions ?? [], pending: session.pending,
    error: session.error, unknownOutcome: session.unknownOutcome, add, rename, reload };
}


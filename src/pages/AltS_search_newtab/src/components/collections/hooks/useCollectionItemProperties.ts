import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { CollectionClientError, getCollectionItem, setCollectionItemPropertyValue } from '../../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionItemRecord, CollectionPropertyValues } from '../../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { AutoSaveIndicatorProps } from '../../../../../../shared-components/autoSaveEngine/autoSave';

type Session = {
  record: CollectionItemRecord | null;
  values: CollectionPropertyValues;
  dirty: Map<string, string>;
  active: boolean;
  leaving: boolean;
  saving: boolean;
  reloading: boolean;
  blocked: boolean;
  status: AutoSaveIndicatorProps['saveStatus'];
  error: string | null;
  lastSavedAt: Date | null;
  timer: ReturnType<typeof setTimeout> | null;
  task: Promise<void> | null;
  notify: () => void;
};

/** Mount once per item, sharing this owner across every property field in that item. */
export function useCollectionItemProperties(item: CollectionItemRecord | null) {
  const session = useMemo<Session>(() => ({ record: item, values: { ...item?.propertyValues }, dirty: new Map(),
    active: false, leaving: false, saving: false, reloading: false, blocked: false, status: 'idle', error: null, lastSavedAt: null,
    timer: null, task: null, notify: () => {} }), [item?.organisationId, item?.collectionId, item?.id]);
  const [version, render] = useReducer(value => value + 1, 0);
  useEffect(() => {
    if (!item || session.saving || session.reloading || !session.record || item.updatedAt <= session.record.updatedAt) return;
    if (session.dirty.size) {
      if (!session.blocked) {
        session.blocked = true; session.status = 'conflict';
        session.error = 'This item changed elsewhere. Your edits are retained. Reload before retrying.'; session.notify();
      }
      return;
    }
    session.record = item; session.values = { ...item.propertyValues }; session.notify();
  }, [item, session, version]);

  const flush = useCallback((): Promise<void> => {
    if (session.timer !== null) clearTimeout(session.timer);
    session.timer = null;
    if (session.task) return session.task;
    if (!session.active || !session.record || session.reloading || session.blocked || !session.dirty.size) return Promise.resolve();
    session.saving = true; session.status = 'saving'; session.error = null; session.notify();
    session.task = (async () => {
      try {
        while ((session.active || session.leaving) && session.record && !session.blocked && session.dirty.size) {
          const [propertyId, text] = session.dirty.entries().next().value!;
          const current = session.record;
          const record = await setCollectionItemPropertyValue(current.organisationId, current.id,
            { propertyId, value: text === '' ? null : text, expectedUpdatedAt: current.updatedAt });
          session.record = record;
          if (session.dirty.get(propertyId) === text) session.dirty.delete(propertyId);
          // Preserve newer edits while accepting all other committed values.
          session.values = { ...record.propertyValues, ...Object.fromEntries(session.dirty) };
          session.lastSavedAt = new Date(record.updatedAt);
          if (session.active) session.notify();
        }
        if (session.active) session.status = session.dirty.size ? 'idle' : 'saved';
      } catch (failure) {
        session.blocked = true;
        session.status = failure instanceof CollectionClientError && failure.code === 'CONFLICT' ? 'conflict' : 'error';
        session.error = failure instanceof Error ? failure.message : 'Could not save the property value.';
      } finally {
        session.saving = false; session.task = null; session.leaving = false;
        if (session.active) session.notify();
      }
    })();
    return session.task;
  }, [session]);

  useEffect(() => {
    session.active = true; session.leaving = false; session.notify = render;
    return () => {
      // Finish already-entered drafts in their original scope when filtering/navigation removes a row.
      session.leaving = true;
      session.notify = () => {};
      void flush();
      session.active = false;
    };
  }, [session, flush]);

  const change = useCallback((propertyId: string, text: string) => {
    if (!session.active || !session.record) return;
    session.values = { ...session.values, [propertyId]: text };
    session.dirty.set(propertyId, text);
    if (!session.blocked && !session.saving) session.status = 'idle';
    session.notify();
    if (session.timer !== null) clearTimeout(session.timer);
    if (!session.blocked) session.timer = setTimeout(() => { void flush(); }, 400);
  }, [session, flush]);

  /** Explicit retry reloads the revision first; transport failures may already have committed. */
  const retry = useCallback(async () => {
    const current = session.record;
    if (!session.active || !current || session.saving || session.reloading) return;
    session.reloading = true; session.notify();
    try {
      const record = await getCollectionItem(current.organisationId, current.id);
      if (!session.active) return;
      if (record.collectionId !== current.collectionId) throw new Error('This item moved to another Collection. Reopen it before editing properties.');
      session.record = record;
      session.values = { ...record.propertyValues, ...Object.fromEntries(session.dirty) };
      session.blocked = false; session.error = null; session.status = 'idle';
    } catch (failure) {
      session.blocked = true; session.status = 'error';
      session.error = failure instanceof Error ? failure.message : 'Could not reload the item.';
    } finally { session.reloading = false; if (session.active) session.notify(); }
    if (session.active && !session.blocked) await flush();
  }, [session, flush]);

  const flushBeforeLeave = useCallback(async () => {
    await flush();
    return session.active && !session.blocked && !session.dirty.size;
  }, [session, flush]);
  const getCurrentRecord = useCallback(() => session.record, [session]);

  return { record: session.record, values: session.values, isDirty: session.dirty.size > 0,
    status: session.status, error: session.error, lastSavedAt: session.lastSavedAt,
    pending: session.saving || session.reloading, change, flush, flushBeforeLeave, getCurrentRecord, retry };
}

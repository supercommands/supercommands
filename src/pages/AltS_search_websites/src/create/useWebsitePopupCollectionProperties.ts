/** Optional field selection; definitions use the same controller as the New Tab table. */
import { useEffect, useMemo, useReducer, useRef, type KeyboardEvent } from 'react';
import { getCollection } from '../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { useCollectionProperties } from '../../../../shared-components/collections/useCollectionProperties';

export const COLLECTION_PROPERTY_PICKER_FIELD = 'collection-properties';
const normalizeLabel = (label: string) => label.trim().toLocaleLowerCase();

export function useWebsitePopupCollectionProperties({ organisationId, collectionId, scopeKey, active, values, onClear, flush, onNavigateBack }: {
  organisationId: string | null; collectionId: string | null; scopeKey: string; active: boolean;
  values: Record<string, string>; onClear: (id: string, value: string) => void; flush: () => void; onNavigateBack: () => void;
}) {
  const [, render] = useReducer(value => value + 1, 0);
  const session = useMemo(() => ({ active: false, collection: null as CollectionRecord | null,
    error: null as string | null, loading: false, request: 0, query: '', open: false,
    selected: [] as string[], index: -1, entryVisible: true }), [scopeKey, active]);
  const input = useRef<HTMLInputElement | null>(null);
  const fields = useRef(new Map<string, HTMLInputElement>());
  const restoringFocus = useRef(false);
  const focusEntry = useRef<{ session: typeof session } | null>(null);
  const owner = useCollectionProperties(session.collection);
  const refresh = async () => {
    if (!session.active || !organisationId || !collectionId) return;
    const request = ++session.request;
    session.loading = true; session.error = null; render();
    try {
      const record = await getCollection(organisationId, collectionId);
      if (session.active && request === session.request) session.collection = record;
    } catch (failure) {
      if (session.active && request === session.request) session.error = failure instanceof Error ? failure.message : 'Could not load properties.';
    } finally {
      if (session.active && request === session.request) { session.loading = false; render(); }
    }
  };
  useEffect(() => {
    session.active = active;
    if (!active) return;
    const changed = (message: unknown) => {
      if (message && typeof message === 'object' && 'action' in message && 'table' in message
          && message.action === 'db_changed' && message.table === 'collections') void refresh();
    };
    void refresh(); chrome.runtime.onMessage.addListener(changed);
    return () => { session.active = false; ++session.request; chrome.runtime.onMessage.removeListener(changed); };
  }, [session, organisationId, collectionId]);
  useEffect(() => {
    let changed = false;
    for (const definition of owner.definitions) {
      if (values[definition.id] && !session.selected.includes(definition.id)) { session.selected.push(definition.id); changed = true; }
    }
    if (changed) { if (!session.open) session.entryVisible = false; render(); }
  }, [owner.definitions, values, session]);
  const query = normalizeLabel(session.query);
  const matches = owner.definitions.filter(definition => !session.selected.includes(definition.id)
    && normalizeLabel(definition.label).includes(query));
  const exact = owner.definitions.some(definition => normalizeLabel(definition.label) === query);
  const rows = matches.map(definition => ({ id: definition.id, label: definition.label, create: false,
    selected: session.selected.includes(definition.id),
    disabled: session.selected.includes(definition.id) || owner.pending || session.loading || owner.unknownOutcome }));
  if (query && !exact && owner.collection) rows.push({ id: 'create-property', label: session.query.trim(), create: true,
    selected: false,
    disabled: owner.pending || session.loading || owner.unknownOutcome });
  // Enter on a freshly typed missing label creates it; arrows can choose a partial match instead.
  const preferredIndex = query ? rows.findIndex(row => row.create || normalizeLabel(row.label) === query) : -1;
  const selectedIndex = rows[session.index] && !rows[session.index].disabled ? session.index
    : preferredIndex >= 0 && !rows[preferredIndex].disabled ? preferredIndex : rows.findIndex(row => !row.disabled);
  const focusPicker = () => {
    if (!session.entryVisible) {
      session.entryVisible = true; focusEntry.current = { session }; render(); return;
    }
    restoringFocus.current = true; input.current?.focus({ preventScroll: true }); restoringFocus.current = false;
  };
  const close = () => { session.open = false; render(); };
  const activate = async (index: number) => {
    const row = rows[index];
    if (!row || row.disabled || !session.active) return;
    try {
      let id = row.id;
      if (row.create) {
        const previousIds = new Set(owner.definitions.map(definition => definition.id));
        const record = await owner.add(row.label);
        if (!session.active || !record) return;
        session.collection = record;
        const definition = record.propertyDefinitions.find(candidate => !previousIds.has(candidate.id));
        if (!definition) return;
        id = definition.id;
      }
      if (!session.selected.includes(id)) session.selected.push(id);
      session.query = ''; session.open = false; session.error = null; session.index = -1; session.entryVisible = false;
      // The selected field mounts in the next commit; the effect below transfers focus.
      focusTarget.current = { session, id };
      render();
    } catch (failure) {
      if (session.active) { session.error = failure instanceof Error ? failure.message : 'Could not add property.'; render(); }
    }
  };
  const focusTarget = useRef<{ session: typeof session; id: string } | null>(null);
  useEffect(() => {
    if (focusEntry.current?.session !== session) focusEntry.current = null;
    if (focusEntry.current && input.current) {
      focusEntry.current = null;
      focusPicker();
    }
    const target = focusTarget.current;
    if (target && target.session !== session) focusTarget.current = null;
    const field = target?.session === session ? fields.current.get(target.id) : null;
    if (field && !field.disabled) { field.focus({ preventScroll: true }); focusTarget.current = null; }
  });
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && session.open) {
      event.preventDefault(); event.stopPropagation(); close(); focusPicker(); return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      let index = session.open ? selectedIndex : step === 1 ? -1 : 0;
      for (let visited = 0; visited < rows.length; visited++) {
        index = (index + step + rows.length) % rows.length;
        if (!rows[index].disabled) { session.index = index; break; }
      }
      session.open = true; render();
    } else if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (!session.open) { session.open = true; render(); }
      else void activate(selectedIndex);
    } else if (event.key === 'Backspace' && !session.query) {
      event.preventDefault(); event.stopPropagation(); close(); flush(); onNavigateBack();
    } else if (event.key === 'Tab') { close(); flush(); }
  };
  return { query: session.query, entryVisible: session.entryVisible, pickerOpen: active && session.open, rows, selectedIndex,
    selected: owner.definitions.filter(definition => session.selected.includes(definition.id)),
    pending: session.loading || owner.pending, error: session.error || owner.error,
    reload: async () => {
      try { if (owner.collection) await owner.reload(); else await refresh(); if (session.active) { session.error = null; render(); } }
      catch { /* Definition controller exposes the reload error. */ }
    },
    activate, closePicker: close, focusPicker, handleKeyDown,
    addAnother: () => {
      focusTarget.current = null;
      session.query = ''; session.index = -1; session.entryVisible = true; session.open = true;
      focusEntry.current = { session }; render();
    },
    selectIndex: (index: number) => { session.index = index; render(); },
    openPicker: () => { if (!restoringFocus.current) { session.open = true; render(); } },
    changeQuery: (value: string) => { session.query = value; session.index = -1; session.open = true; render(); },
    setInput: (element: HTMLInputElement | null) => { input.current = element; },
    setValueInput: (id: string, element: HTMLInputElement | null) => { if (element) fields.current.set(id, element); else fields.current.delete(id); },
    remove: (id: string) => { session.selected = session.selected.filter(value => value !== id); onClear(id, ''); flush(); render(); focusPicker(); },
  };
}

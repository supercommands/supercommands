import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom';
import type { CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

interface Props {
  definition?: CollectionPropertyDefinition;
  pending: boolean;
  unknownOutcome: boolean;
  onClose: () => void;
  onSave: (label: string) => Promise<void>;
  onReload: () => Promise<unknown>;
}

/** Same modal/input presentation as the existing Collection editor. */
export default function CollectionPropertyEditor({ definition, pending, unknownOutcome, onClose, onSave, onReload }: Props) {
  const [label, setLabel] = useState(definition?.label ?? 'Untitled');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.current?.focus(); input.current?.select();
    return () => { mounted.current = false; if (previous?.isConnected) previous.focus(); };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || unknownOutcome) return;
    setError(null);
    try { await onSave(label); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not save the property.'); }
  };
  const reload = async () => {
    try { await onReload(); if (mounted.current) setError('Collection reloaded. Review its columns before submitting again.'); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not reload the Collection.'); }
  };
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[var(--color-overlayBg)] p-4" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="collection-property-editor-title" onSubmit={event => { void submit(event); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!pending) onClose(); } }}
        className="w-full max-w-sm rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-5 text-[var(--color-textPrimary)] shadow-xl">
        <h2 id="collection-property-editor-title" className="text-base font-semibold">{definition ? 'Rename property' : 'Add new column'}</h2>
        <label htmlFor="collection-property-label" className="mt-4 block text-xs font-medium text-[var(--color-textSecondary)]">Label</label>
        <input ref={input} id="collection-property-label" value={label} disabled={pending} onChange={event => { setLabel(event.target.value); setError(null); }}
          className="mt-2 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50" />
        <label htmlFor="collection-property-type" className="mt-4 block text-xs font-medium text-[var(--color-textSecondary)]">Type</label>
        <select id="collection-property-type" value="text" disabled={pending || Boolean(definition)} onChange={() => {}}
          className="mt-2 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50">
          <option value="text">Text</option>
        </select>
        {error && <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
        {unknownOutcome && <p role="status" className="mt-2 text-xs text-[var(--color-textSecondary)]">The previous change may have saved. Reload and review the Collection before trying again.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Cancel</button>
          {(error || unknownOutcome) && <button type="button" disabled={pending} onClick={() => { void reload(); }} className="rounded-lg px-3 py-2 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Reload</button>}
          <button type="submit" disabled={pending || unknownOutcome} className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">{pending ? 'Saving…' : definition ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>, document.body);
}

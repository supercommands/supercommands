import { useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

interface CollectionEditorProps {
    collection?: CollectionRecord;
    onClose: () => void;
    onSave: (name: string) => Promise<void>;
}

const CollectionEditor = ({ collection, onClose, onSave }: CollectionEditorProps) => {
    const [name, setName] = useState(collection?.name ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const title = collection ? 'Rename webclip' : 'New webclip';

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const normalized = name.trim().replace(/\s+/g, ' ');
        if (!normalized) { setError('Enter a webclip name.'); return; }
        setSaving(true);
        setError(null);
        try { await onSave(normalized); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save webclip.'); }
        finally { setSaving(false); }
    };

    return ReactDOM.createPortal(<div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[var(--color-overlayBg)] p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="collection-editor-title" onSubmit={event => { void submit(event); }} onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.stopPropagation(); onClose(); } }} className="w-full max-w-sm rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-5 text-[var(--color-textPrimary)] shadow-xl">
        <h2 id="collection-editor-title" className="text-base font-semibold">{title}</h2>
        <label htmlFor="collection-name" className="mt-4 block text-xs font-medium text-[var(--color-textSecondary)]">Name</label>
        <input id="collection-name" autoFocus value={name} onChange={event => { setName(event.target.value); setError(null); }} className="mt-2 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"/>
        {error && <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-3 py-2 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !name.trim()} className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">{saving ? 'Saving…' : collection ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>, document.body);
};

export default CollectionEditor;

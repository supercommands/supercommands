import { useState } from 'react';
import ReactDOM from 'react-dom';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

interface CollectionDeleteDialogProps {
    collection: CollectionRecord;
    itemCount: number;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

const CollectionDeleteDialog = ({ collection, itemCount, onClose, onConfirm }: CollectionDeleteDialogProps) => {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const confirm = async () => {
        setDeleting(true);
        setError(null);
        try { await onConfirm(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete webclip.'); }
        finally { setDeleting(false); }
    };

    return ReactDOM.createPortal(<div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[var(--color-overlayBg)] p-4" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="collection-delete-title" aria-describedby="collection-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleting) { event.stopPropagation(); onClose(); } }} className="w-full max-w-sm rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-5 text-[var(--color-textPrimary)] shadow-xl">
        <h2 id="collection-delete-title" className="text-base font-semibold">Delete webclip?</h2>
        <p id="collection-delete-description" className="mt-3 text-sm text-[var(--color-textSecondary)]">“{collection.name}” and its {itemCount} {itemCount === 1 ? 'item' : 'items'} will be permanently deleted.</p>
        {error && <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={deleting} className="rounded-lg px-3 py-2 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => { void confirm(); }} disabled={deleting} className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </section>
    </div>, document.body);
};

export default CollectionDeleteDialog;

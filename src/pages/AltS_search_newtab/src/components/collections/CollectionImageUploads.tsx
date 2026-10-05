import type { ImageUploadEntry } from './hooks/useCollectionImageUpload';

interface Props { entries: ImageUploadEntry[]; onCancel: (id: string) => void; onRetry: (entry: ImageUploadEntry) => void; onDismiss: (id: string) => void }

const statusLabel = (entry: ImageUploadEntry) => entry.status === 'queued' ? 'Waiting'
    : entry.status === 'preparing' ? `Preparing ${entry.percent}%`
        : entry.status === 'saving' ? 'Saving image…'
            : entry.status === 'saved' ? 'Saved' : 'Failed';

const CollectionImageUploads = ({ entries, onCancel, onRetry, onDismiss }: Props) => {
    if (!entries.length) return null;
    return <section aria-label="Image uploads" className="mb-5 overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]">
      <h2 className="border-b border-[var(--color-borderDefault)] px-4 py-3 text-sm font-medium text-[var(--color-textPrimary)]">Image uploads</h2>
      <ul className="divide-y divide-[var(--color-borderDefault)]">{entries.map(entry => <li key={entry.id} className="flex min-w-0 items-center gap-3 px-4 py-3 text-xs">
        <div className="min-w-0 flex-1"><p className="truncate font-medium text-[var(--color-textPrimary)]" title={entry.file.name}>{entry.file.name}</p><p role={entry.status === 'failed' ? 'alert' : 'status'} className={`mt-1 ${entry.status === 'failed' ? 'text-[var(--color-danger)]' : 'text-[var(--color-textSecondary)]'}`}>{entry.error ?? statusLabel(entry)}</p>
          {entry.status === 'preparing' && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-borderDefault)]" aria-hidden="true"><div className="h-full bg-[var(--color-textSecondary)]" style={{ width: `${entry.percent}%` }}/></div>}
        </div>
        {(entry.status === 'queued' || entry.status === 'preparing') && <button type="button" onClick={() => onCancel(entry.id)} className="rounded-lg px-2 py-1 text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Cancel</button>}
        {entry.status === 'failed' && <button type="button" onClick={() => onRetry(entry)} className="rounded-lg px-2 py-1 text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Retry</button>}
        {(entry.status === 'saved' || entry.status === 'failed') && <button type="button" onClick={() => onDismiss(entry.id)} aria-label={`Dismiss ${entry.file.name}`} className="rounded-lg px-2 py-1 text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Dismiss</button>}
      </li>)}</ul>
    </section>;
};

export default CollectionImageUploads;

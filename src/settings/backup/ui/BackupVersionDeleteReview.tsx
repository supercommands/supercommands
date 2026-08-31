import React, { useState } from 'react';
import { FiCheck, FiTrash2, FiX } from 'react-icons/fi';
import type { DriveFolder } from '../logic/driveApi';

interface BackupVersionDeleteReviewProps {
  backups: DriveFolder[];
  isDeleting: boolean;
  initialSelectedIds?: string[];
  onDelete: (backups: DriveFolder[]) => void;
  onClose: () => void;
}

export const BackupVersionDeleteReview: React.FC<BackupVersionDeleteReviewProps> = ({ backups, isDeleting, initialSelectedIds = [], onDelete, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const toggle = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const selectedBackups = backups.filter(backup => selectedIds.includes(backup.id));

  return (
    <div className="fixed inset-0 z-[100] flex h-full w-full items-stretch justify-center bg-[var(--color-overlayBg)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-modalBg)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="min-w-0 text-left">
            <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Delete backup versions</h3>
            <p className="mt-1 text-[10px] text-[var(--color-textMuted)]">Select one or more complete Drive backup versions to delete. Local workspace data will not be changed.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isDeleting} title="Close delete backup versions" className="shrink-0 rounded-lg p-1.5 text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:opacity-50">
            <FiX size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {backups.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-textMuted)]">No completed Drive backup versions are available.</div>
          ) : (
            <div className="space-y-2">
              {backups.map(backup => {
                const selected = selectedIds.includes(backup.id);
                return (
                  <label key={backup.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${selected ? 'border-[var(--color-danger)] bg-[var(--color-dangerBg)]' : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 hover:bg-[var(--color-hoverBg)]'}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggle(backup.id)} disabled={isDeleting} className="sr-only" />
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white' : 'border-[var(--color-borderDefault)]'}`}>
                      {selected && <FiCheck size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--color-textPrimary)]">{backup.name}</span>
                      <span className="mt-1 block text-[10px] text-[var(--color-textMuted)]">{backup.storageKind === 'zip' ? 'Complete ZIP backup' : 'Legacy folder backup'} · {backup.manifest?.tableCounts ? `${Object.values(backup.manifest.tableCounts).reduce((sum, count) => sum + count, 0)} records` : 'Drive backup'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-borderDefault)] px-5 py-3">
          <span className="text-[10px] text-[var(--color-textMuted)]">{selectedBackups.length} version{selectedBackups.length === 1 ? '' : 's'} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={isDeleting} className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-2 text-xs font-semibold text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => onDelete(selectedBackups)} disabled={isDeleting || selectedBackups.length === 0} className="flex items-center gap-2 rounded-lg bg-[var(--color-danger)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <FiTrash2 size={13} />
              {isDeleting ? 'Deleting...' : 'Delete selected versions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupVersionDeleteReview;

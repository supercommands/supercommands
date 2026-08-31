import React, { useMemo } from 'react';
import { FiBarChart2, FiDatabase, FiHardDrive, FiRefreshCw, FiX } from 'react-icons/fi';
import type { DriveFolder } from '../logic/driveApi';
import { BACKUP_TABLE_NAMES } from '../logic/backupRegistry';
import { formatBackupPayloadSize, type BackupData } from '../logic/extractData';

interface BackupStatsReviewProps {
  backup: DriveFolder;
  backupData: BackupData | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
}

function tableLabel(tableName: string): string {
  return tableName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, value => value.toUpperCase());
}

function backupVersionLabel(backup: DriveFolder): string {
  const backupNumber = backup.backupNumber ?? backup.manifest?.backupNumber;
  if (typeof backupNumber === 'number' && Number.isFinite(backupNumber)) {
    return `v${Math.max(1, Math.trunc(backupNumber))}`;
  }
  return 'Version';
}

function backupUploadedSizeLabel(backup: DriveFolder): string {
  if (backup.storageKind === 'zip') {
    const fileSize = Number(backup.size);
    if (Number.isFinite(fileSize) && fileSize > 0) return `${formatBackupPayloadSize(fileSize)} ZIP`;
  }
  const sourceSize = backup.manifest?.estimatedPayloadBytes;
  return typeof sourceSize === 'number' && sourceSize > 0 ? formatBackupPayloadSize(sourceSize) : 'Unavailable';
}

export const BackupStatsReview: React.FC<BackupStatsReviewProps> = ({ backup, backupData, isLoading, error, onClose }) => {
  const tableCounts = useMemo(() => {
    const manifestCounts = backupData?.manifest?.tableCounts || backup.manifest?.tableCounts || {};
    return BACKUP_TABLE_NAMES.map(tableName => {
      const records = backupData?.tables?.[tableName];
      const count = Array.isArray(records) ? records.length : Number(manifestCounts[tableName] || 0);
      return { tableName, count: Number.isFinite(count) ? count : 0 };
    });
  }, [backup.manifest?.tableCounts, backupData]);

  const totalRecords = tableCounts.reduce((sum, item) => sum + item.count, 0);
  const createdAt = new Date(backupData?.manifest?.createdAt || backup.manifest?.createdAt || backup.createdTime);
  const sourceSize = backupData?.manifest?.estimatedPayloadBytes ?? backup.manifest?.estimatedPayloadBytes;
  const sourceSizeLabel = typeof sourceSize === 'number' && sourceSize > 0
    ? formatBackupPayloadSize(sourceSize)
    : 'Unavailable';
  const storageLabel = backup.storageKind === 'zip' ? 'ZIP backup' : 'Folder backup';

  return (
    <div className="fixed inset-0 z-[100] flex h-full w-full items-stretch justify-center bg-[var(--color-overlayBg)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-modalBg)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 text-[var(--color-textPrimary)]">
              <FiBarChart2 size={16} />
              <h3 className="text-sm font-bold">Backup stats</h3>
            </div>
            <p className="mt-1 truncate text-[10px] text-[var(--color-textMuted)]">{backup.name}</p>
          </div>
          <button type="button" onClick={onClose} title="Close backup stats" className="shrink-0 rounded-lg p-1.5 text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
            <FiX size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-[var(--color-textMuted)]">
              <FiRefreshCw className="animate-spin" size={18} />
              <div className="text-xs font-semibold">Loading backup stats...</div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-dangerBg)] px-3 py-3 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 border-b border-[var(--color-borderDefault)] pb-4 sm:grid-cols-5">
                <Summary label="Version" value={backupVersionLabel(backup)} />
                <Summary label="Total records" value={totalRecords} />
                <Summary label="Workspaces" value={tableCounts.find(item => item.tableName === 'workspaces')?.count || 0} />
                <Summary label="Source size" value={sourceSizeLabel} />
                <Summary label="Stored as" value={storageLabel} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tableCounts.map(item => (
                  <div key={item.tableName} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 px-3 py-2 text-left">
                    <span className="flex min-w-0 items-center gap-2">
                      <FiDatabase size={13} className="shrink-0 text-[var(--color-iconDefault)]" />
                      <span className="truncate text-[11px] font-semibold text-[var(--color-textPrimary)]">{tableLabel(item.tableName)}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[var(--color-textSecondary)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--color-borderDefault)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-[var(--color-textMuted)]">
            <FiHardDrive size={13} className="shrink-0" />
            <span className="truncate">
              {createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}, {createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - Uploaded size {backupUploadedSizeLabel(backup)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 px-2.5 py-2 text-center">
      <div className="text-[10px] font-semibold text-[var(--color-textMuted)]">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-[var(--color-textPrimary)]">{value}</div>
    </div>
  );
}

export default BackupStatsReview;

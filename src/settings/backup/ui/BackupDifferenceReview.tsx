import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronRight, FiEdit3, FiMinus, FiPlus, FiRefreshCw, FiX } from 'react-icons/fi';
import type { DriveFolder } from '../logic/driveApi';
import type { BackupComparisonResult, BackupDataLike, BackupMergeResult, BackupRecordDifference } from '../logic/backupComparisonTypes';
import BackupDifferenceDetail from './BackupDifferenceDetail';

export interface BackupComparisonSource {
  id: string;
  name: string;
  kind: 'local' | 'drive';
  driveFolder?: DriveFolder;
}

interface BackupDifferenceReviewProps {
  backup: BackupComparisonSource;
  leftBackup: BackupComparisonSource;
  rightBackup: BackupComparisonSource;
  backups: BackupComparisonSource[];
  isComparing: boolean;
  isLoadingSources: boolean;
  onCompareVersions: (leftBackup: BackupComparisonSource, rightBackup: BackupComparisonSource) => void;
  comparison: BackupComparisonResult | null;
  mergeResult?: BackupMergeResult | null;
  onResolvedSnapshot?: (snapshot: BackupDataLike) => void;
  onClose: () => void;
}

function DifferenceGroup({ title, icon, items, emptyLabel }: {
  title: string;
  icon: React.ReactNode;
  items: BackupRecordDifference[];
  emptyLabel: string;
}) {
  const [expanded, setExpanded] = useState(items.length > 0);
  const [selectedItem, setSelectedItem] = useState<BackupRecordDifference | null>(null);

  return (
    <div className="border-b border-[var(--color-borderDefault)] last:border-b-0 py-3">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className="w-full flex items-center justify-between gap-3 text-left text-xs text-[var(--color-textPrimary)]"
      >
        <span className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
          <span className="text-[10px] text-[var(--color-textMuted)]">{items.length}</span>
        </span>
        {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {items.length === 0 ? (
            <div className="text-[10px] text-[var(--color-textMuted)]">{emptyLabel}</div>
          ) : (
            items.slice(0, 50).map(item => (
              <button
                type="button"
                key={`${item.tableName}:${item.identity}`}
                onClick={() => setSelectedItem(item)}
                className="w-full rounded-lg bg-[var(--color-hoverBg)]/50 px-2.5 py-2 text-left hover:bg-[var(--color-hoverBg)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold text-[var(--color-textPrimary)]">{recordDisplayName(item)}</div>
                    <div className="truncate text-[9px] text-[var(--color-textMuted)]">{item.tableName}</div>
                  </div>
                  <span className="max-w-[55%] truncate text-[9px] font-mono text-[var(--color-textMuted)]">ID: {item.identity}</span>
                </div>
                {item.fields.length > 0 && (
                  <div className="mt-1 text-[9px] text-[var(--color-textMuted)] truncate">
                    {item.fields.slice(0, 4).map(field => field.path || '(record)').join(', ')}
                    {item.fields.length > 4 ? ` +${item.fields.length - 4} more` : ''}
                  </div>
                )}
                {item.kind === 'added' ? (
                  <div className="mt-2 grid grid-cols-2 items-start gap-2 text-left">
                    <div className="min-w-0"><div className="mb-1 text-[9px] font-semibold text-[var(--color-success)]">Added to target</div><SideRecordPreview item={item} side="left" /></div>
                    <div className="mt-5 flex min-h-16 items-center justify-center px-2 py-2 text-[9px] text-[var(--color-textMuted)]">Not in target</div>
                  </div>
                ) : item.kind === 'removed' ? (
                  <div className="mt-2 grid grid-cols-2 items-start gap-2 text-left">
                    <div className="min-w-0"><div className="mb-1 text-[9px] font-semibold text-[var(--color-danger)]">Removed from target</div><SideRecordPreview item={item} side="right" /></div>
                    <div className="mt-5 flex min-h-16 items-center justify-center px-2 py-2 text-[9px] text-[var(--color-textMuted)]">Not in source</div>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-left">
                    <div className="min-w-0"><div className="mb-1 text-[9px] font-semibold text-[var(--color-accent)]">Source version</div><SideRecordPreview item={item} side="left" /></div>
                    <div className="min-w-0"><div className="mb-1 text-[9px] font-semibold text-[var(--color-accent)]">Target version</div><SideRecordPreview item={item} side="right" /></div>
                  </div>
                )}
              </button>
            ))
          )}
          {items.length > 50 && (
            <div className="text-[9px] text-[var(--color-textMuted)]">Showing the first 50 records.</div>
          )}
        </div>
      )}
      {selectedItem && <BackupDifferenceDetail difference={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

function compactValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(item => compactValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function recordPreview(item: BackupRecordDifference): string[] {
  const record = item.localRecord || item.driveRecord;
  if (!record) return [];
  const fieldsByTable: Record<string, string[]> = {
    notes: ['title', 'description', 'body', 'content'],
    links: ['title', 'description', 'url', 'urls'],
    sessions: ['title', 'description', 'urls'],
    snippets: ['title', 'description', 'content', 'code'],
    todos: ['title', 'name', 'description'],
  };
  const fields = fieldsByTable[item.tableName] || ['title', 'name', 'label', 'description', 'content', 'url'];
  return fields.map(field => {
    const value = compactValue(record[field]);
    return value ? `${field}: ${value}` : '';
  }).filter(Boolean).slice(0, 3);
}

function recordDisplayName(item: BackupRecordDifference): string {
  const record = item.localRecord || item.driveRecord;
  if (!record) return 'Unnamed record';
  const value = record.title ?? record.name ?? record.label ?? record.shortcut;
  return compactValue(value) || 'Unnamed record';
}

function readPath(record: Record<string, unknown> | undefined, path: string): unknown {
  if (!record) return undefined;
  return path.split('.').reduce<unknown>((value, key) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  ), record);
}

function fieldLabel(tableName: string, path: string): string {
  if (tableName === 'notes' && path === 'body') return 'Description';
  if (tableName === 'snippets' && path === 'config') return 'Content';
  if (tableName === 'links' && path === 'urls') return 'URLs';
  return path;
}

function SideRecordPreview({ item, side }: { item: BackupRecordDifference; side: 'left' | 'right' }) {
  const record = side === 'left' ? item.localRecord : item.driveRecord;
  const paths = item.fields.map(field => field.path).filter(Boolean).slice(0, 6);
  if (!record) return <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--color-borderDefault)] px-2 py-2 text-[9px] text-[var(--color-textMuted)]">{item.kind === 'removed' ? <FiMinus size={12} /> : <FiPlus size={12} />} Not present in this version</div>;
  return <div className="min-w-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 px-2 py-2">
    {paths.length > 0 ? paths.map(path => <div key={path} className="mb-1 last:mb-0"><div className="text-[9px] font-semibold text-[var(--color-textMuted)]">{fieldLabel(item.tableName, path)}</div><div className="truncate text-[9px] text-[var(--color-textPrimary)]">{compactValue(readPath(record, path)) || 'Empty'}</div></div>) : recordPreview(item).map(preview => <div key={preview} className="truncate text-[9px] text-[var(--color-textPrimary)]">{preview}</div>)}
  </div>;
}

export const BackupDifferenceReview: React.FC<BackupDifferenceReviewProps> = ({ backup, leftBackup, rightBackup, backups, isComparing, isLoadingSources, onCompareVersions, comparison, mergeResult, onResolvedSnapshot, onClose }) => {
  const [showAllSettings, setShowAllSettings] = useState(false);
  const [selectedLeftId, setSelectedLeftId] = useState(leftBackup.id);
  const [selectedRightId, setSelectedRightId] = useState(rightBackup.id);
  useEffect(() => {
    setSelectedLeftId(leftBackup.id);
    setSelectedRightId(rightBackup.id);
  }, [leftBackup.id, rightBackup.id]);
  const displayComparison: BackupComparisonResult = comparison || {
    tables: {},
    settings: [],
    summary: { addedCount: 0, removedCount: 0, deletedCount: 0, changedCount: 0, unchangedCount: 0, settingsChangedCount: 0 },
  };
  const changedTables = useMemo(
    () => Object.entries(displayComparison.tables).filter(([, table]) =>
      table.added.length || table.removed.length || table.deleted.length || table.changed.length
    ),
    [displayComparison.tables]
  );

  return (
    <div className="fixed inset-0 z-[100] flex h-full w-full items-stretch justify-center bg-[var(--color-overlayBg)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-modalBg)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="min-w-0 text-left">
            <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Backup differences</h3>
            <div className="mt-2 grid max-w-3xl grid-cols-2 gap-2">
              <select disabled={isLoadingSources} value={selectedLeftId} onChange={event => setSelectedLeftId(event.target.value)} aria-label="Source comparison version" className="min-w-0 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] px-2 py-2 text-[10px] text-[var(--color-textPrimary)] outline-none disabled:opacity-50">
                {backups.map(item => <option key={item.id} value={item.id}>{item.kind === 'local' ? 'Local current data' : item.name}</option>)}
              </select>
              <select disabled={isLoadingSources} value={selectedRightId} onChange={event => setSelectedRightId(event.target.value)} aria-label="Target comparison version" className="min-w-0 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] px-2 py-2 text-[10px] text-[var(--color-textPrimary)] outline-none disabled:opacity-50">
                {backups.map(item => <option key={item.id} value={item.id}>{item.kind === 'local' ? 'Local current data' : item.name}</option>)}
              </select>
            </div>
            <button type="button" disabled={isLoadingSources || isComparing || !selectedLeftId || !selectedRightId || selectedLeftId === selectedRightId} onClick={() => {
              const nextLeft = backups.find(item => item.id === selectedLeftId);
              const nextRight = backups.find(item => item.id === selectedRightId);
              if (nextLeft && nextRight) onCompareVersions(nextLeft, nextRight);
            }} className="mt-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isLoadingSources ? 'Fetching Drive backups...' : isComparing ? 'Comparing...' : 'Compare selected versions'}
            </button>
            {isLoadingSources && <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-textMuted)]"><FiRefreshCw className="animate-spin text-[var(--color-accent)]" size={13} /> Fetching available backups from Drive...</div>}
            <p className="mt-1 text-[10px] text-[var(--color-textMuted)]">Source: <span className="font-mono">{backups.find(item => item.id === selectedLeftId)?.name || leftBackup.name}</span> · Target: <span className="font-mono">{backups.find(item => item.id === selectedRightId)?.name || rightBackup.name}</span></p>
            <p className="mt-1 text-[10px] text-[var(--color-textMuted)]">Source values are available to bring into the target. Read-only comparison; no data has been changed.</p>
          </div>
          <button type="button" onClick={onClose} title="Close difference review" className="shrink-0 rounded-lg p-1.5 text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
            <FiX size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-[var(--color-borderDefault)] p-4 sm:grid-cols-5">
          <Summary label="Added" value={displayComparison.summary.addedCount} color="text-[var(--color-success)]" />
          <Summary label="Removed" value={displayComparison.summary.removedCount} color="text-[var(--color-danger)]" />
          <Summary label="Deleted" value={displayComparison.summary.deletedCount} color="text-[var(--color-danger)]" />
          <Summary label="Changed" value={displayComparison.summary.changedCount} color="text-[var(--color-accent)]" />
          <Summary label="Settings" value={displayComparison.summary.settingsChangedCount} color="text-[var(--color-accent)]" />
        </div>

        <div className="overflow-y-auto px-5">
          {isComparing && !comparison ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FiRefreshCw className="animate-spin text-[var(--color-accent)]" size={22} />
              <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Comparing selected versions...</div>
              <div className="text-[10px] text-[var(--color-textMuted)]">Reading both Drive snapshots and preparing the difference view.</div>
            </div>
          ) : changedTables.length === 0 && displayComparison.settings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FiCheck className="text-[var(--color-success)]" size={22} />
              <div className="text-xs font-semibold text-[var(--color-textPrimary)]">No differences found</div>
              <div className="text-[10px] text-[var(--color-textMuted)]">The selected Drive backup matches the current supported local data.</div>
            </div>
          ) : (
            <>
              <div className="py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-textMuted)]">Data changes</div>
              {changedTables.map(([tableName, table]) => (
                <div key={tableName} className="border-b border-[var(--color-borderDefault)] py-2">
                  <div className="mb-1 text-xs font-bold text-[var(--color-textPrimary)]">{tableName}</div>
                  {table.added.length > 0 && <DifferenceGroup title="Added" icon={<FiPlus className="text-[var(--color-success)]" />} items={table.added} emptyLabel="No added records" />}
                  {table.removed.length > 0 && <DifferenceGroup title="Removed" icon={<FiMinus className="text-[var(--color-danger)]" />} items={table.removed} emptyLabel="No removed records" />}
                  {table.deleted.length > 0 && <DifferenceGroup title="Deleted" icon={<FiAlertCircle className="text-[var(--color-danger)]" />} items={table.deleted} emptyLabel="No deleted records" />}
                  {table.changed.length > 0 && <DifferenceGroup title="Changed" icon={<FiEdit3 className="text-[var(--color-accent)]" />} items={table.changed} emptyLabel="No changed records" />}
                </div>
              ))}

              {displayComparison.settings.length > 0 && (
                <div className="py-3">
                  <button type="button" onClick={() => setShowAllSettings(value => !value)} className="flex items-center gap-2 text-xs font-bold text-[var(--color-textPrimary)]">
                    {showAllSettings ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    Settings ({displayComparison.settings.length})
                  </button>
                  {showAllSettings && (
                    <div className="mt-2 space-y-1.5">
                      {displayComparison.settings.map(setting => (
                        <div key={setting.key} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-hoverBg)]/50 px-2.5 py-2 text-[10px]">
                          <span className="font-mono text-[var(--color-textMuted)] truncate">{setting.key}</span>
                          <span className="shrink-0 font-medium text-[var(--color-accent)]">{setting.kind}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 px-2.5 py-2 text-center">
    <div className={`text-base font-bold ${color}`}>{value}</div>
    <div className="text-[9px] text-[var(--color-textMuted)]">{label}</div>
  </div>
);

export default BackupDifferenceReview;

import React, { useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import type { BackupConflictResolution, BackupDataLike, BackupMergeConflict, BackupMergeResult } from '../logic/backupComparisonTypes';
import { applyConflictResolutions, conflictKey } from '../logic/applyConflictResolutions';

interface BackupConflictPanelProps {
  mergeResult: BackupMergeResult;
  onResolvedSnapshot: (snapshot: BackupDataLike) => void;
}

function conflictLabel(conflict: BackupMergeConflict): string {
  if (conflict.reason === 'delete-versus-edit') return 'Delete versus edit';
  if (conflict.reason === 'duplicate-identity') return 'Duplicate identity';
  if (conflict.reason === 'invalid-record') return 'Invalid record';
  return 'Same field changed differently';
}

export const BackupConflictPanel: React.FC<BackupConflictPanelProps> = ({ mergeResult, onResolvedSnapshot }) => {
  const [expanded, setExpanded] = useState(true);
  const [resolutions, setResolutions] = useState<BackupConflictResolution[]>([]);
  const resolvedKeys = useMemo(() => new Set(resolutions.map(resolution => resolution.conflictKey)), [resolutions]);
  const unresolvedCount = mergeResult.conflicts.length - resolvedKeys.size;

  const choose = (conflict: BackupMergeConflict, choice: BackupConflictResolution['choice'], manualValue?: unknown) => {
    const next = [...resolutions.filter(resolution => resolution.conflictKey !== conflictKey(conflict)), { conflictKey: conflictKey(conflict), choice, manualValue }];
    setResolutions(next);
    try {
      onResolvedSnapshot(applyConflictResolutions(mergeResult, mergeResult.conflicts, next));
    } catch (error) {
      console.error('Failed to apply backup conflict resolution preview', error);
    }
  };

  if (mergeResult.conflicts.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-3 py-2 text-left text-[10px] text-[var(--color-success)]">
        <FiCheck className="text-[var(--color-success)]" size={14} /> No conflicts. All changes can be merged automatically.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-left">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-textPrimary)]">
        <span className="flex items-center gap-2"><FiAlertTriangle className="text-[var(--color-accent)]" size={14} /> Conflicts ({mergeResult.conflicts.length})</span>
        {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
      </button>
      {expanded && (
        <div className="border-t border-[var(--color-accent)]/20 px-3 py-2">
          <div className="mb-2 text-[10px] text-[var(--color-textMuted)]">
            {unresolvedCount === 0 ? 'All conflicts have a preview resolution.' : `${unresolvedCount} conflict${unresolvedCount === 1 ? '' : 's'} still need a choice.`}
          </div>
          <div className="space-y-2">
            {mergeResult.conflicts.map(conflict => {
              const key = conflictKey(conflict);
              const resolution = resolutions.find(item => item.conflictKey === key);
              const selected = resolution?.choice;
              const canEditText = typeof conflict.localValue === 'string' || typeof conflict.driveValue === 'string';
              return (
                <div key={key} className="rounded-lg bg-[var(--color-hoverBg)]/60 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-semibold text-[var(--color-textPrimary)]">{conflict.tableName || 'Settings'}{conflict.identity ? ` · ${conflict.identity}` : ''}</div>
                      <div className="truncate text-[9px] text-[var(--color-textMuted)]">{conflict.path || '(record)'} · {conflictLabel(conflict)}</div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-semibold ${selected ? 'text-[var(--color-success)]' : 'text-[var(--color-accent)]'}`}>{selected ? `Keep ${selected}` : 'Needs choice'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ChoiceButton label="Keep Local" active={selected === 'local'} onClick={() => choose(conflict, 'local')} />
                    <ChoiceButton label="Keep Drive" active={selected === 'drive'} onClick={() => choose(conflict, 'drive')} />
                    <ChoiceButton label="Delete" active={selected === 'delete'} onClick={() => choose(conflict, 'delete')} />
                    {canEditText && (
                      <ChoiceButton
                        label="Use edited text"
                        active={selected === 'manual'}
                        onClick={() => choose(conflict, 'manual', resolution?.manualValue ?? conflict.localValue ?? conflict.driveValue ?? '')}
                      />
                    )}
                  </div>
                  {canEditText && selected === 'manual' && (
                    <textarea
                      value={typeof resolution?.manualValue === 'string' ? resolution.manualValue : ''}
                      onChange={event => choose(conflict, 'manual', event.target.value)}
                      className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-2 font-mono text-[10px] text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-accent)]"
                      aria-label={`Resolved text for ${conflict.path || conflict.identity || 'conflict'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ChoiceButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick} className={`rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors ${active ? 'border-[var(--color-accent)] bg-[var(--color-accentBg)] text-[var(--color-accent)]' : 'border-[var(--color-borderDefault)] text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
    {label}
  </button>
);

export default BackupConflictPanel;

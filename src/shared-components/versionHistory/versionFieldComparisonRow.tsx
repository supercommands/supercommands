import React from 'react';

export interface VersionFieldComparisonRowProps {
  label: string;
  previousValue?: string | null;
  currentValue?: string | null;
  isChanged?: boolean;
  previousUnavailable?: boolean;
  multiline?: boolean;
  monospace?: boolean;
  icon?: React.ReactNode;
  className?: string;
  displayMode?: 'changes' | 'snapshot';
}

export const VersionFieldComparisonRow: React.FC<VersionFieldComparisonRowProps> = ({
  label,
  previousValue = '',
  currentValue = '',
  isChanged: explicitChanged,
  previousUnavailable = false,
  multiline = false,
  monospace = false,
  icon,
  className = '',
  displayMode = 'changes',
}) => {
  const prevStr = previousValue !== null && previousValue !== undefined ? String(previousValue).trim() : '';
  const currStr = currentValue !== null && currentValue !== undefined ? String(currentValue).trim() : '';

  const isChanged = explicitChanged !== undefined ? explicitChanged : (previousUnavailable || prevStr !== currStr);

  if (displayMode === 'changes' && !isChanged) {
    return null;
  }

  const fontStyle = monospace ? 'font-mono' : '';
  const isSnapshotMode = displayMode === 'snapshot' || !isChanged;

  return (
    <div className={`p-4 grid grid-cols-2 gap-4 items-start text-xs border-b border-[var(--color-borderDefault,rgba(255,255,255,0.06))] ${className}`}>
      {/* Previous Version Column */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5 select-none">
          <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5">
            {icon}
            <span>{label}</span>
          </span>
        </div>
        {previousUnavailable ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">
            Not recorded in this checkpoint
          </span>
        ) : !prevStr ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">Not set</span>
        ) : (
          <span
            className={`${fontStyle} ${multiline ? 'whitespace-pre-wrap break-words' : 'truncate'} ${
              isSnapshotMode
                ? 'text-[var(--color-textSecondary,#D4D4D4)] font-normal'
                : 'text-[var(--color-diffRemovedText,#F87171)] font-medium'
            }`}>
            {!isSnapshotMode && '− '}
            {prevStr}
          </span>
        )}
      </div>

      {/* Current Version Column */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5 select-none">
          <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5">
            {icon}
            <span>{label}</span>
          </span>
          {!isSnapshotMode && (
            <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider shrink-0">
              CHANGED
            </span>
          )}
        </div>
        {!currStr ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">
            {!prevStr ? 'Not set' : 'Removed'}
          </span>
        ) : (
          <span
            className={`${fontStyle} ${multiline ? 'whitespace-pre-wrap break-words' : 'truncate'} ${
              isSnapshotMode
                ? 'text-[var(--color-textSecondary,#D4D4D4)] font-normal'
                : 'text-[var(--color-diffAddedText,#34D399)] font-medium'
            }`}>
            {!isSnapshotMode && '+ '}
            {currStr}
          </span>
        )}
      </div>
    </div>
  );
};

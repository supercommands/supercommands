import React from 'react';

export interface VersionTextFieldComparisonProps {
  label: string;
  previousValue?: string | null;
  currentValue?: string | null;
  previousUnavailable?: boolean;
  multiline?: boolean;
  monospace?: boolean;
  className?: string;
}

export const VersionTextFieldComparison: React.FC<VersionTextFieldComparisonProps> = ({
  label,
  previousValue = '',
  currentValue = '',
  previousUnavailable = false,
  multiline = false,
  monospace = false,
  className = '',
}) => {
  const prevStr = previousValue !== null && previousValue !== undefined ? String(previousValue).trim() : '';
  const currStr = currentValue !== null && currentValue !== undefined ? String(currentValue).trim() : '';

  const isChanged = previousUnavailable || prevStr !== currStr;
  if (!isChanged) return null;

  const fontStyle = monospace ? 'font-mono' : '';

  return (
    <div className={`py-3 grid grid-cols-2 gap-4 items-start text-xs border-b border-[var(--color-borderDefault,rgba(255,255,255,0.06))] ${className}`}>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider block mb-0.5">
          PREVIOUS {label}
        </span>
        {previousUnavailable ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">
            Not recorded in this legacy checkpoint
          </span>
        ) : !prevStr ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">Not set</span>
        ) : (
          <span
            className={`${fontStyle} ${multiline ? 'whitespace-pre-wrap break-words' : 'truncate'} text-[var(--color-diffRemovedText,#F87171)] font-medium`}>
            {prevStr}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider block mb-0.5">
          CURRENT {label}
        </span>
        {!currStr ? (
          <span className="text-[var(--color-textMuted,#737373)] italic">Removed</span>
        ) : (
          <span
            className={`${fontStyle} ${multiline ? 'whitespace-pre-wrap break-words' : 'truncate'} text-[var(--color-diffAddedText,#34D399)] font-medium`}>
            {currStr}
          </span>
        )}
      </div>
    </div>
  );
};

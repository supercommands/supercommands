import * as React from 'react';
import type { TriggerDailyBreakdownRecord } from '../../triggers';

const looksLikeRawReferenceId = (value: string, referenceId: string) => {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized === referenceId) return true;
  return /^(workspace|folder|note|snippet|link|session|automation|module|todo|prompt|aiPrompt)_/i.test(normalized);
};

const getReadableReferenceFallback = (row: TriggerDailyBreakdownRecord) => {
  const typeLabel = String(row.referenceType || 'item')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

  return typeLabel || row.referenceId;
};

const getDisplayTargetLabel = (row: TriggerDailyBreakdownRecord) => {
  const snapshot = String(row.targetLabelSnapshot || '').trim();
  return looksLikeRawReferenceId(snapshot, row.referenceId) ? getReadableReferenceFallback(row) : snapshot;
};

export const TriggerUsageList: React.FC<{ rows: TriggerDailyBreakdownRecord[] }> = ({ rows }) => {
  if (!rows.length) {
    return <div className="text-xs text-[var(--color-textSecondary)]">No assigned trigger usage on this day.</div>;
  }

  return (
    <div className="space-y-1.5">
      {rows.slice(0, 12).map(row => {
        const count = row.successCount + row.failureCount;
        const targetLabel = getDisplayTargetLabel(row);
        return (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-[var(--color-textPrimary)]">{targetLabel}</div>
              <div className="truncate text-[10px] text-[var(--color-textMuted)]">
                {row.triggerKind === 'user_hotkey' ? 'Hotkey' : 'Shortcut'} - {row.triggerLabelSnapshot} - {row.triggerSource}
              </div>
            </div>
            <div className="text-xs font-bold text-[var(--color-textPrimary)] tabular-nums">{count}</div>
          </div>
        );
      })}
    </div>
  );
};

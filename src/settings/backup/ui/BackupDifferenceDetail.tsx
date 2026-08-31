import React from 'react';
import { FiArrowRight, FiPlus } from 'react-icons/fi';
import type { BackupFieldChange, BackupRecordDifference } from '../logic/backupComparisonTypes';

interface BackupDifferenceDetailProps {
  difference: BackupRecordDifference;
  onClose: () => void;
}

function displayValue(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() || 'Empty';
  const serialized = JSON.stringify(value, null, 2);
  return serialized === undefined ? 'Not present' : serialized;
}

function fallbackVisibleFields(difference: BackupRecordDifference): BackupFieldChange[] {
  const ignored = new Set(['id', 'createdAt', 'updatedAt', 'expectedUpdatedAt', 'versionHistory', '_kind']);
  const source = difference.localRecord || {};
  const target = difference.driveRecord || {};
  return [...new Set([...Object.keys(source), ...Object.keys(target)])]
    .filter(path => !ignored.has(path))
    .filter(path => JSON.stringify(source[path]) !== JSON.stringify(target[path]))
    .map(path => ({
      path,
      localValue: source[path],
      driveValue: target[path],
      kind: source[path] === undefined ? 'removed' as const : target[path] === undefined ? 'added' as const : 'changed' as const,
    }));
}

const FieldValue: React.FC<{ field: BackupFieldChange; side: 'local' | 'drive' }> = ({ field, side }) => {
  const value = side === 'local' ? field.localValue : field.driveValue;
  if (value === undefined) {
    return (
      <div className="flex min-h-16 items-center gap-2 rounded-md border border-dashed border-[var(--color-borderDefault)] px-2.5 py-2 text-[10px] text-[var(--color-textMuted)]">
        <FiPlus className="text-[var(--color-iconDefault)]" size={14} />
        <span>Not present in this version</span>
      </div>
    );
  }

  return (
    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/40 px-2.5 py-2 font-mono text-[10px] text-[var(--color-textPrimary)]">
      {displayValue(value)}
    </pre>
  );
};

const SideHeader: React.FC<{ title: string }> = ({ title }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-textPrimary)]">{title}</span>
);

const RecordValuePanel: React.FC<{ record?: Record<string, unknown>; fields: BackupFieldChange[] }> = ({ record, fields }) => {
  if (!record) {
    return <div className="flex min-h-24 items-center gap-2 rounded-md border border-dashed border-[var(--color-borderDefault)] px-3 py-2 text-[10px] text-[var(--color-textMuted)]"><FiPlus size={14} /> Not present in this version</div>;
  }

  return (
    <div className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/30 px-3 py-2">
      {fields.map(field => {
        const value = record[field.path];
        return (
          <div key={field.path} className="border-b border-[var(--color-borderDefault)]/60 py-2 last:border-b-0 last:pb-0 first:pt-0">
            <div className="text-[9px] font-semibold text-[var(--color-textMuted)]">{field.path}</div>
            <div className="mt-0.5 break-words text-[10px] text-[var(--color-textPrimary)]">{displayValue(value)}</div>
          </div>
        );
      })}
    </div>
  );
};

export const BackupDifferenceDetail: React.FC<BackupDifferenceDetailProps> = ({ difference, onClose }) => {
  const changedFields = difference.fields.filter(field => field.path || field.localValue !== undefined || field.driveValue !== undefined);
  const visibleFields = changedFields.length > 0 ? changedFields : fallbackVisibleFields(difference);

  return (
    <div className="fixed inset-0 z-[110] flex h-full w-full items-stretch justify-center bg-[var(--color-overlayBg)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-modalBg)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="min-w-0 text-left">
            <div className="text-sm font-bold text-[var(--color-textPrimary)]">{difference.tableName}</div>
            <div className="mt-1 truncate font-mono text-[10px] text-[var(--color-textMuted)]">{difference.identity}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]">
            Close
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 border-b border-[var(--color-borderDefault)] px-5 py-3 text-[10px] text-[var(--color-textMuted)]">
          <span>Source version</span>
          <FiArrowRight size={13} />
          <span>Target version</span>
          <span className="ml-2 rounded-full bg-[var(--color-hoverBg)] px-2 py-0.5 font-semibold">{difference.kind}</span>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          {visibleFields.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-textMuted)]">No visible fields changed.</div>
          ) : (difference.kind === 'added' || difference.kind === 'removed') ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 border-b border-[var(--color-borderDefault)] pb-3">
                <SideHeader title="Source version" />
                <SideHeader title="Target version" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <RecordValuePanel record={difference.localRecord} fields={visibleFields} />
                <RecordValuePanel record={difference.driveRecord} fields={visibleFields} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 border-b border-[var(--color-borderDefault)] pb-3">
                <SideHeader title="Source version" />
                <SideHeader title="Target version" />
              </div>
              {visibleFields.map(field => (
                <div key={field.path || '(record)'} className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-[var(--color-textMuted)]">{field.path || '(record)'}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldValue field={field} side="local" />
                    <FieldValue field={field} side="drive" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupDifferenceDetail;

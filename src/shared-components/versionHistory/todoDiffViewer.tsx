import React from 'react';
import { FiCheckCircle, FiClock, FiTag, FiPaperclip, FiKey } from 'react-icons/fi';
import { VersionFieldComparisonRow } from './versionFieldComparisonRow';
import { VersionComparisonShell } from './versionComparisonShell';

export interface TodoDiffViewerProps {
  previousSnapshot: any;
  currentSnapshot: any;
  displayMode?: 'changes' | 'snapshot';
}

export const TodoDiffViewer: React.FC<TodoDiffViewerProps> = ({
  previousSnapshot,
  currentSnapshot,
  displayMode = 'changes',
}) => {
  const prev = previousSnapshot || {};
  const curr = currentSnapshot || {};

  const isChangesMode = displayMode === 'changes';

  const formatSchedule = (time?: number, type?: string) => {
    if (!time) return 'Not set';
    const dateStr = new Date(time).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return type === 'recurring' ? `${dateStr} (Recurring)` : dateStr;
  };

  const fields = [
    {
      key: 'title',
      label: 'Title',
      prevRaw: (prev.name || prev.title || '').trim(),
      currRaw: (curr.name || curr.title || '').trim(),
    },
    {
      key: 'description',
      label: 'Description',
      prevRaw: (prev.description || '').trim(),
      currRaw: (curr.description || '').trim(),
      multiline: true,
    },
    {
      key: 'isDone',
      label: 'Status',
      prevRaw: prev.isDone ? 'Completed' : 'Pending',
      currRaw: curr.isDone ? 'Completed' : 'Pending',
      icon: <FiCheckCircle size={13} className="opacity-60" />,
    },
    {
      key: 'schedule',
      label: 'Schedule & Time',
      prevRaw: formatSchedule(prev.scheduleTime, prev.scheduleType),
      currRaw: formatSchedule(curr.scheduleTime, curr.scheduleType),
      icon: <FiClock size={13} className="opacity-60" />,
    },
    {
      key: 'recurringType',
      label: 'Recurrence',
      prevRaw: (prev.recurringType || prev.recurringCycle || '').trim(),
      currRaw: (curr.recurringType || curr.recurringCycle || '').trim(),
    },
    {
      key: 'shortcut',
      label: 'Text Command Shortcut',
      prevRaw: (prev.shortcut || '').trim(),
      currRaw: (curr.shortcut || '').trim(),
      monospace: true,
      icon: <FiKey size={13} className="opacity-60" />,
    },
  ];

  const prevRefs: any[] = prev.references || prev.selectedItems || [];
  const currRefs: any[] = curr.references || curr.selectedItems || [];
  const prevRefIds = new Set(prevRefs.map(r => String(r.id || r.name)));
  const currRefIds = new Set(currRefs.map(r => String(r.id || r.name)));

  const removedRefs = prevRefs.filter(r => !currRefIds.has(String(r.id || r.name)));
  const addedRefs = currRefs.filter(r => !prevRefIds.has(String(r.id || r.name)));
  const isRefsChanged = removedRefs.length > 0 || addedRefs.length > 0;

  const prevTags: string[] = prev.tagIds || [];
  const currTags: string[] = curr.tagIds || [];
  const prevTagSet = new Set(prevTags);
  const currTagSet = new Set(currTags);

  const removedTags = prevTags.filter(t => !currTagSet.has(t));
  const addedTags = currTags.filter(t => !prevTagSet.has(t));
  const isTagsChanged = removedTags.length > 0 || addedTags.length > 0;

  const visibleFields = fields.filter(f => {
    if (!isChangesMode) return true;
    return f.prevRaw !== f.currRaw;
  });

  const showRefs = isChangesMode ? isRefsChanged : (prevRefs.length > 0 || currRefs.length > 0);
  const showTags = isChangesMode ? isTagsChanged : (prevTags.length > 0 || currTags.length > 0);

  const hasAnyContent = visibleFields.length > 0 || showRefs || showTags;

  return (
    <VersionComparisonShell>
      <div className="flex-1 flex flex-col divide-y divide-[var(--color-borderDefault,rgba(255,255,255,0.06))]">
        {!hasAnyContent ? (
          <div className="py-8 text-center text-xs text-[var(--color-textMuted)]">
            No todo changes in this version
          </div>
        ) : (
          <>
            {visibleFields.map(field => (
              <VersionFieldComparisonRow
                key={field.key}
                label={field.label}
                previousValue={field.prevRaw}
                currentValue={field.currRaw}
                multiline={field.multiline}
                monospace={field.monospace}
                icon={field.icon}
                displayMode={displayMode}
              />
            ))}

            {showRefs && (
              <div className="p-4 grid grid-cols-2 gap-4 text-xs items-start border-b border-[var(--color-borderDefault,rgba(255,255,255,0.06))]">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <FiPaperclip size={13} className="opacity-60" />
                    <span>References ({isChangesMode ? removedRefs.length : prevRefs.length})</span>
                  </span>
                  {(isChangesMode ? removedRefs : prevRefs).length === 0 ? (
                    <span className="text-[var(--color-textMuted)] italic">
                      {isChangesMode ? 'None removed' : 'No references'}
                    </span>
                  ) : (
                    (isChangesMode ? removedRefs : prevRefs).map((r, idx) => (
                      <div
                        key={idx}
                        className={isChangesMode ? 'text-[var(--color-diffRemovedText,#F87171)] font-medium' : 'text-[var(--color-textSecondary)]'}>
                        {isChangesMode && '− '}
                        {r.name || r.title || 'Item'}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <FiPaperclip size={13} className="opacity-60" />
                    <span>References ({isChangesMode ? addedRefs.length : currRefs.length})</span>
                  </span>
                  {(isChangesMode ? addedRefs : currRefs).length === 0 ? (
                    <span className="text-[var(--color-textMuted)] italic">
                      {isChangesMode ? 'None added' : 'No references'}
                    </span>
                  ) : (
                    (isChangesMode ? addedRefs : currRefs).map((r, idx) => (
                      <div
                        key={idx}
                        className={isChangesMode ? 'text-[var(--color-diffAddedText,#34D399)] font-medium' : 'text-[var(--color-textSecondary)]'}>
                        {isChangesMode && '+ '}
                        {r.name || r.title || 'Item'}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showTags && (
              <div className="p-4 grid grid-cols-2 gap-4 text-xs items-start border-b border-[var(--color-borderDefault,rgba(255,255,255,0.06))]">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <FiTag size={13} className="opacity-60" />
                    <span>Tags ({isChangesMode ? removedTags.length : prevTags.length})</span>
                  </span>
                  {(isChangesMode ? removedTags : prevTags).length === 0 ? (
                    <span className="text-[var(--color-textMuted)] italic">
                      {isChangesMode ? 'None removed' : 'No tags'}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(isChangesMode ? removedTags : prevTags).map((tagId, idx) => (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                            isChangesMode
                              ? 'border-[var(--color-diffRemovedText,#F87171)] text-[var(--color-diffRemovedText,#F87171)]'
                              : 'border-[var(--color-borderDefault,rgba(255,255,255,0.1))] text-[var(--color-textSecondary)]'
                          }`}>
                          {isChangesMode && '− '}
                          {tagId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <FiTag size={13} className="opacity-60" />
                    <span>Tags ({isChangesMode ? addedTags.length : currTags.length})</span>
                  </span>
                  {(isChangesMode ? addedTags : currTags).length === 0 ? (
                    <span className="text-[var(--color-textMuted)] italic">
                      {isChangesMode ? 'None added' : 'No tags'}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(isChangesMode ? addedTags : currTags).map((tagId, idx) => (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                            isChangesMode
                              ? 'border-[var(--color-diffAddedText,#34D399)] text-[var(--color-diffAddedText,#34D399)]'
                              : 'border-[var(--color-borderDefault,rgba(255,255,255,0.1))] text-[var(--color-textSecondary)]'
                          }`}>
                          {isChangesMode && '+ '}
                          {tagId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </VersionComparisonShell>
  );
};

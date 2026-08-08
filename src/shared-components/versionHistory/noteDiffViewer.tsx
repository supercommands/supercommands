import React, { useMemo, useRef, useCallback } from 'react';
import { diffTextLines } from './versionComparisonHelpers';
import { VersionFieldComparisonRow } from './versionFieldComparisonRow';
import { VersionComparisonShell } from './versionComparisonShell';
import { getNoteBody } from './versionHistoryComparisonModal';

export interface NoteDiffViewerProps {
  previousSnapshot?: any;
  currentSnapshot?: any;
  previousText?: string;
  currentText?: string;
  displayMode?: 'changes' | 'snapshot';
}

export const NoteDiffViewer: React.FC<NoteDiffViewerProps> = ({
  previousSnapshot,
  currentSnapshot,
  previousText,
  currentText,
  displayMode = 'changes',
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const prevBody = useMemo(() => {
    if (previousSnapshot) return getNoteBody(previousSnapshot);
    return previousText || '';
  }, [previousSnapshot, previousText]);

  const currBody = useMemo(() => {
    if (currentSnapshot) return getNoteBody(currentSnapshot);
    return currentText || '';
  }, [currentSnapshot, currentText]);

  const isPrevLegacy = useMemo(() => {
    if (!previousSnapshot || typeof previousSnapshot !== 'object') return false;
    return previousSnapshot.entityType === 'note' && previousSnapshot.title === undefined;
  }, [previousSnapshot]);

  const prevTitle = typeof previousSnapshot === 'object' ? previousSnapshot?.title : undefined;
  const currTitle = typeof currentSnapshot === 'object' ? currentSnapshot?.title : undefined;

  const prevShortcut = typeof previousSnapshot === 'object' ? previousSnapshot?.shortcut : undefined;
  const currShortcut = typeof currentSnapshot === 'object' ? currentSnapshot?.shortcut : undefined;

  const lines = useMemo(() => {
    return diffTextLines(prevBody, currBody);
  }, [prevBody, currBody]);

  const handleScrollLeft = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, []);

  const handleScrollRight = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, []);

  const hasBodyContent = Boolean(prevBody.trim() || currBody.trim());

  return (
    <VersionComparisonShell>
      <div className="flex flex-col border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
        <VersionFieldComparisonRow
          label="NOTE TITLE"
          previousValue={prevTitle}
          currentValue={currTitle}
          previousUnavailable={isPrevLegacy}
          displayMode={displayMode}
        />
        <VersionFieldComparisonRow
          label="TEXT COMMAND"
          previousValue={prevShortcut}
          currentValue={currShortcut}
          previousUnavailable={isPrevLegacy}
          monospace
          displayMode={displayMode}
        />
      </div>

      <div className="px-4 py-2 border-b border-[var(--color-borderDefault,rgba(255,255,255,0.06))] grid grid-cols-2 gap-4 text-[10px] font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider select-none shrink-0">
        <div>NOTE DESCRIPTION</div>
        <div>NOTE DESCRIPTION</div>
      </div>

      {!hasBodyContent ? (
        <div className="p-4 grid grid-cols-2 gap-4 text-xs italic text-[var(--color-textMuted,#737373)]">
          <div>No description</div>
          <div>No description</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-row min-h-0">
          <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
            <div
              ref={leftScrollRef}
              onScroll={handleScrollLeft}
              className="flex-1 overflow-y-auto font-mono text-xs custom-scrollbar">
              {lines.map((line, idx) => {
                const isDelete = line.type === 'delete';
                const isModify = line.type === 'modify';
                const isInsert = line.type === 'insert';

                if (isInsert) {
                  return (
                    <div
                      key={idx}
                      className="flex items-start h-[24px] min-h-[24px] px-2 leading-6 border-b border-white/[0.02] bg-transparent opacity-0 select-none pointer-events-none">
                      <span className="w-10 text-right pr-3 shrink-0">&nbsp;</span>
                      <span className="w-4 shrink-0">&nbsp;</span>
                      <div className="flex-1">&nbsp;</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`flex items-start min-h-[24px] px-2 leading-6 border-b border-white/[0.02] bg-transparent ${
                      isDelete || isModify
                        ? 'text-[var(--color-diffRemovedText,#F87171)]'
                        : 'text-[var(--color-textSecondary,#D4D4D4)]'
                    }`}>
                    <span className="w-10 text-right pr-3 select-none text-[var(--color-diffLineNumberText,#6B7280)] shrink-0 opacity-60">
                      {line.lineNumberLeft ?? ''}
                    </span>
                    <span className="w-4 select-none shrink-0 font-bold">
                      {isDelete ? '-' : isModify ? '~' : ''}
                    </span>
                    <div className="flex-1 whitespace-pre-wrap break-words">{line.leftText ?? line.rightText ?? ''}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div
              ref={rightScrollRef}
              onScroll={handleScrollRight}
              className="flex-1 overflow-y-auto font-mono text-xs custom-scrollbar">
            {lines.map((line, idx) => {
              const isInsert = line.type === 'insert';
              const isModify = line.type === 'modify';
              const isDelete = line.type === 'delete';

              if (isDelete) {
                return (
                  <div
                    key={idx}
                    className="flex items-start h-[24px] min-h-[24px] px-2 leading-6 border-b border-white/[0.02] bg-transparent opacity-0 select-none pointer-events-none">
                    <span className="w-10 text-right pr-3 shrink-0">&nbsp;</span>
                    <span className="w-4 shrink-0">&nbsp;</span>
                    <div className="flex-1">&nbsp;</div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start min-h-[24px] px-2 leading-6 border-b border-white/[0.02] bg-transparent ${
                    isInsert || isModify
                      ? 'text-[var(--color-diffAddedText,#34D399)]'
                      : 'text-[var(--color-textSecondary,#D4D4D4)]'
                  }`}>
                  <span className="w-10 text-right pr-3 select-none text-[var(--color-diffLineNumberText,#6B7280)] shrink-0 opacity-60">
                    {line.lineNumberRight ?? ''}
                  </span>
                  <span className="w-4 select-none shrink-0 font-bold">
                    {isInsert ? '+' : isModify ? '~' : ''}
                  </span>
                  <div className="flex-1 whitespace-pre-wrap break-words">{line.rightText ?? line.leftText ?? ''}</div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </VersionComparisonShell>
  );
};

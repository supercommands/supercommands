import React, { useMemo } from 'react';
import { FiGlobe, FiPlus, FiMinus, FiArrowUpRight } from 'react-icons/fi';
import { alignStructuralArray, normalizeUrl } from './versionComparisonHelpers';
import { VersionFieldComparisonRow } from './versionFieldComparisonRow';
import { VersionComparisonShell } from './versionComparisonShell';
import { getSessionTabTitle } from '../../allObjectFolder/src/createObject/session/sessionHelpers';

export interface SessionTabItem {
  id?: string;
  url: string;
  title?: string;
  name?: string;
  originalData?: {
    title?: string;
    [key: string]: unknown;
  };
  favIconUrl?: string;
  faviconUrl?: string;
}

export interface SessionDiffViewerProps {
  previousSnapshot: any;
  currentSnapshot: any;
  displayMode?: 'changes' | 'snapshot';
}

export const SessionDiffViewer: React.FC<SessionDiffViewerProps> = ({
  previousSnapshot,
  currentSnapshot,
  displayMode = 'changes',
}) => {
  const prev = previousSnapshot || {};
  const curr = currentSnapshot || {};

  const isChangesMode = displayMode === 'changes';

  const prevTitle = (prev.title || '').trim();
  const currTitle = (curr.title || '').trim();

  const prevShortcut = (prev.shortcut || '').trim();
  const currShortcut = (curr.shortcut || '').trim();

  const prevTabs: SessionTabItem[] = prev.urls || prev.tabs || [];
  const currTabs: SessionTabItem[] = curr.urls || curr.tabs || [];

  const getItemKey = (item: SessionTabItem) => {
    if (item.id && !item.id.startsWith('temp-') && !item.id.startsWith('tab-')) return item.id;
    return normalizeUrl(item.url);
  };

  const areItemsModified = (pItem: SessionTabItem, cItem: SessionTabItem) => {
    const prevT = getSessionTabTitle(pItem);
    const currT = getSessionTabTitle(cItem);
    const prevU = normalizeUrl(pItem.url);
    const currU = normalizeUrl(cItem.url);

    const changedFields: string[] = [];
    if (prevT !== currT) changedFields.push('title');
    if (prevU !== currU) changedFields.push('url');

    return {
      isModified: changedFields.length > 0,
      changedFields,
    };
  };

  const { rows } = useMemo(() => {
    return alignStructuralArray(prevTabs, currTabs, getItemKey, areItemsModified);
  }, [prevTabs, currTabs]);

  const visibleRows = useMemo(() => {
    if (!isChangesMode) return rows;
    return rows.filter(row => row.type !== 'unchanged');
  }, [rows, isChangesMode]);

  return (
    <VersionComparisonShell>
      <div className="flex flex-col border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
        <VersionFieldComparisonRow
          label="SESSION TITLE"
          previousValue={prevTitle}
          currentValue={currTitle}
          displayMode={displayMode}
        />

        <VersionFieldComparisonRow
          label="TEXT COMMAND"
          previousValue={prevShortcut}
          currentValue={currShortcut}
          monospace
          displayMode={displayMode}
        />
      </div>

      <div className="p-4 flex flex-col divide-y divide-[var(--color-borderDefault,rgba(255,255,255,0.06))]">
        {visibleRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-textMuted)]">
            {isChangesMode ? 'No tab changes in this version' : 'No tabs in this session'}
          </div>
        ) : (
          visibleRows.map((row, idx) => {
            const isAdded = row.type === 'added';
            const isRemoved = row.type === 'removed';
            const isModified = row.type === 'modified';
            const isMoved = row.type === 'moved';

            const prevFav = row.prevItem?.favIconUrl || row.prevItem?.faviconUrl;
            const currFav = row.currentItem?.favIconUrl || row.currentItem?.faviconUrl;

            const prevDisplayTitle = row.prevItem ? getSessionTabTitle(row.prevItem) : '';
            const currDisplayTitle = row.currentItem ? getSessionTabTitle(row.currentItem) : '';

            return (
              <div key={idx} className="py-3 grid grid-cols-2 gap-4 items-start text-xs">
                <div className="flex flex-col gap-1 min-w-0">
                  {row.prevItem ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {prevFav ? (
                            <img
                              src={prevFav}
                              alt=""
                              className="w-4 h-4 rounded object-contain shrink-0 opacity-80"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <FiGlobe className="shrink-0 opacity-50" size={14} />
                          )}
                          <span
                            className={`font-medium truncate ${
                              !isChangesMode
                                ? 'text-[var(--color-textSecondary,#D4D4D4)]'
                                : isRemoved || isModified
                                ? 'text-[var(--color-diffRemovedText,#F87171)]'
                                : 'text-[var(--color-textSecondary,#D4D4D4)]'
                            }`}>
                            {isChangesMode && (isRemoved || isModified) && '− '}
                            {prevDisplayTitle}
                          </span>
                        </div>
                        {isChangesMode && isRemoved && (
                          <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-diffRemovedText,#F87171)] font-semibold shrink-0">
                            <FiMinus size={11} /> Removed
                          </span>
                        )}
                        {isMoved && (
                          <span className="text-[11px] text-[var(--color-textMuted,#737373)] shrink-0">
                            Tab #{row.prevIndex}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] truncate ${
                          !isChangesMode
                            ? 'text-[var(--color-textMuted,#737373)]'
                            : isRemoved || isModified
                            ? 'text-[var(--color-diffRemovedText,#F87171)] opacity-80'
                            : 'text-[var(--color-textMuted,#737373)]'
                        }`}
                        title={row.prevItem.url}>
                        {isChangesMode && (isRemoved || isModified) && '− '}
                        {row.prevItem.url}
                      </span>
                    </>
                  ) : (
                    <div className="text-[11px] italic text-[var(--color-textMuted,#737373)] select-none">
                      {isChangesMode ? 'Not present' : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  {row.currentItem ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {currFav ? (
                            <img
                              src={currFav}
                              alt=""
                              className="w-4 h-4 rounded object-contain shrink-0 opacity-80"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <FiGlobe className="shrink-0 opacity-50" size={14} />
                          )}
                          <span
                            className={`font-medium truncate ${
                              !isChangesMode
                                ? 'text-[var(--color-textSecondary,#D4D4D4)]'
                                : isAdded || isModified
                                ? 'text-[var(--color-diffAddedText,#34D399)]'
                                : 'text-[var(--color-textSecondary,#D4D4D4)]'
                            }`}>
                            {isChangesMode && (isAdded || isModified) && '+ '}
                            {currDisplayTitle}
                          </span>
                        </div>
                        {isChangesMode && isAdded && (
                          <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-diffAddedText,#34D399)] font-semibold shrink-0">
                            <FiPlus size={11} /> Added
                          </span>
                        )}
                        {isMoved && (
                          <span className="flex items-center gap-1 text-[11px] text-[var(--color-textMuted,#737373)] shrink-0">
                            <FiArrowUpRight size={11} /> Moved from #{row.prevIndex} to #{row.currentIndex}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] truncate ${
                          !isChangesMode
                            ? 'text-[var(--color-textMuted,#737373)]'
                            : isAdded || isModified
                            ? 'text-[var(--color-diffAddedText,#34D399)] opacity-80'
                            : 'text-[var(--color-textMuted,#737373)]'
                        }`}
                        title={row.currentItem.url}>
                        {isChangesMode && (isAdded || isModified) && '+ '}
                        {row.currentItem.url}
                      </span>
                    </>
                  ) : (
                    <div className="text-[11px] italic text-[var(--color-textMuted,#737373)] select-none">
                      {isChangesMode ? 'Removed from current version' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </VersionComparisonShell>
  );
};

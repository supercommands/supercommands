import React, { useMemo } from 'react';
import { FiGlobe, FiPlus, FiMinus, FiArrowUpRight } from 'react-icons/fi';
import type { LinkItem } from '../../allObjectFolder/src/createObject/links/linkTypes';
import { alignStructuralArray, normalizeUrl } from './versionComparisonHelpers';
import { VersionFieldComparisonRow } from './versionFieldComparisonRow';
import { VersionComparisonShell } from './versionComparisonShell';

export interface LinkDiffViewerProps {
  previousSnapshot?: any;
  currentSnapshot?: any;
  displayMode?: 'changes' | 'snapshot';
  // Legacy props fallback
  previousUrls?: LinkItem[];
  currentUrls?: LinkItem[];
  previousTitle?: string;
  currentTitle?: string;
}

const TEMP_ID_PREFIXES = ['temp-', 'tab-', 'duplicate-', 'new-'];

function getItemKey(item: LinkItem): string {
  const id = item.id;
  if (id && !TEMP_ID_PREFIXES.some(prefix => id.startsWith(prefix))) {
    return id;
  }
  return normalizeUrl(item.url) || id || '';
}

function areItemsModified(prev: LinkItem, curr: LinkItem): { isModified: boolean; changedFields: string[] } {
  const prevT = (prev.title || prev.name || '').trim();
  const currT = (curr.title || curr.name || '').trim();
  const prevU = normalizeUrl(prev.url);
  const currU = normalizeUrl(curr.url);

  const changedFields: string[] = [];
  if (prevT !== currT) changedFields.push('title');
  if (prevU !== currU) changedFields.push('url');

  return {
    isModified: changedFields.length > 0,
    changedFields,
  };
}

function getFavicon(item: LinkItem & { faviconUrl?: string }): string | undefined {
  return item.favIconUrl || item.faviconUrl;
}

export const LinkDiffViewer: React.FC<LinkDiffViewerProps> = ({
  previousSnapshot,
  currentSnapshot,
  displayMode = 'changes',
  previousUrls = [],
  currentUrls = [],
  previousTitle = '',
  currentTitle = '',
}) => {
  const prev = previousSnapshot || {};
  const curr = currentSnapshot || {};

  const prevTitle = (prev.title !== undefined ? prev.title : previousTitle) || '';
  const currTitle = (curr.title !== undefined ? curr.title : currentTitle) || '';

  const prevShortcut = (prev.shortcut || '').trim();
  const currShortcut = (curr.shortcut || '').trim();

  const prevUrlsList: LinkItem[] = prev.urls !== undefined ? prev.urls : previousUrls;
  const currUrlsList: LinkItem[] = curr.urls !== undefined ? curr.urls : currentUrls;

  const { rows } = useMemo(() => {
    return alignStructuralArray(prevUrlsList, currUrlsList, getItemKey, areItemsModified);
  }, [prevUrlsList, currUrlsList]);

  const isChangesMode = displayMode === 'changes';

  const visibleRows = useMemo(() => {
    if (!isChangesMode) return rows;
    return rows.filter(row => row.type !== 'unchanged');
  }, [rows, isChangesMode]);

  return (
    <VersionComparisonShell>
      <div className="flex flex-col border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
        <VersionFieldComparisonRow
          label="LINK COLLECTION TITLE"
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
            {isChangesMode ? 'No link changes in this version' : 'No links in this collection'}
          </div>
        ) : (
          visibleRows.map((row, idx) => {
            const isAdded = row.type === 'added';
            const isRemoved = row.type === 'removed';
            const isModified = row.type === 'modified';
            const isMoved = row.type === 'moved';

            const prevFavicon = row.prevItem ? getFavicon(row.prevItem as any) : undefined;
            const currFavicon = row.currentItem ? getFavicon(row.currentItem as any) : undefined;

            return (
              <div key={idx} className="py-3 grid grid-cols-2 gap-4 items-start text-xs">
                {/* Left: previous version */}
                <div className="flex flex-col gap-1 min-w-0">
                  {row.prevItem ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {prevFavicon ? (
                            <img
                              src={prevFavicon}
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
                            {row.prevItem.title || row.prevItem.name || 'Untitled Link'}
                          </span>
                        </div>
                        {isChangesMode && isRemoved && (
                          <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-diffRemovedText,#F87171)] font-semibold shrink-0">
                            <FiMinus size={11} /> Removed
                          </span>
                        )}
                        {isMoved && (
                          <span className="text-[11px] text-[var(--color-textMuted,#737373)] shrink-0">
                            Pos #{row.prevIndex}
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

                {/* Right: current version */}
                <div className="flex flex-col gap-1 min-w-0">
                  {row.currentItem ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {currFavicon ? (
                            <img
                              src={currFavicon}
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
                            {row.currentItem.title || row.currentItem.name || 'Untitled Link'}
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

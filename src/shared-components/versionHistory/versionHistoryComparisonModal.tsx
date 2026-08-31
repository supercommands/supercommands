import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';
import { useUIStore } from '../uiStateManager';
import { VersionHistoryHeader } from './versionHistoryHeader';
import { VersionTimeline, TimelineVersionItem } from './versionTimeline';
import { NoteDiffViewer } from './noteDiffViewer';
import { SnippetDiffViewer } from './snippetDiffViewer';
import { TodoDiffViewer } from './todoDiffViewer';
import { LinkDiffViewer } from './linkDiffViewer';
import { SessionDiffViewer } from './sessionDiffViewer';
import { getHistoricalVersion, getVersionCount } from '../../allObjectFolder/src/createObject/notes/noteHistory';
import { getSnapshotById, VersionHistorySnapshot, snapshotsAreEqual } from './structuredVersionHistory';
import { convertHtmlToCleanLines } from './versionComparisonHelpers';

export interface VersionHistoryComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'note' | 'todo' | 'snippet' | 'link' | 'session' | string;
  entityId: string;
  entityTitle: string;
  currentSnapshot: VersionHistorySnapshot | any;
  versionHistory?: any;
  isDraftUnsaved?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
}

export function getNoteBody(snapshot: unknown): string {
  if (typeof snapshot === 'string') return snapshot;
  if (
    snapshot &&
    typeof snapshot === 'object' &&
    typeof (snapshot as { body?: unknown }).body === 'string'
  ) {
    return (snapshot as { body: string }).body;
  }
  return '';
}

export const VersionHistoryComparisonModal: React.FC<VersionHistoryComparisonModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  currentSnapshot,
  versionHistory,
  isDraftUnsaved = false,
  triggerRef,
  appearanceScope = 'default',
  appearanceTokens,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const type = String(entityType).toLowerCase();
  const isNote = type.includes('note');
  const isAltSAppearance = appearanceScope === 'alts';
  const appearanceStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!isAltSAppearance) return appearanceTokens;
    return {
      ...appearanceTokens,
      '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-panelBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-sidebarBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-contextMenuBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-containerBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-editorBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-inputBg': 'var(--alts-input-bg, var(--color-altsInputBg))',
      '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
      '--color-selectedBg': 'var(--alts-selected-bg, var(--color-altsSelectedBg))',
      '--color-borderDefault': 'var(--alts-border-color, var(--color-altsBorderColor))',
      '--color-borderActive': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
      '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
      '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
      '--color-textMuted': 'var(--alts-text-muted, var(--color-altsTextMuted))',
      '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
      '--color-iconDefault': 'var(--alts-icon-fg, var(--color-altsIconFg))',
      '--color-diffAddedBg': 'color-mix(in srgb, var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg)) 18%, transparent)',
      '--color-diffAddedBorder': 'color-mix(in srgb, var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg)) 34%, transparent)',
      '--color-diffAddedText': 'var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg))',
      '--color-diffRemovedBg': 'color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 18%, transparent)',
      '--color-diffRemovedBorder': 'color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 36%, transparent)',
      '--color-diffRemovedText': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
      '--color-diffModifiedBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
      '--color-diffModifiedBorder': 'var(--alts-border-color, var(--color-altsBorderColor))',
      '--color-diffModifiedText': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
    } as React.CSSProperties;
  }, [appearanceTokens, isAltSAppearance]);
  const portalTarget = useMemo<HTMLElement | null>(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (isAltSAppearance) {
      const modalHost =
        (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
        (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
        (window as any).__ALTS_PORTAL_HOST__ ||
        (window as any).__ALTQ_PORTAL_HOST__;
      if (modalHost instanceof HTMLElement) return modalHost;
    }
    return document.body;
  }, [isAltSAppearance]);

  const timelineItems = useMemo<TimelineVersionItem[]>(() => {
    const items: TimelineVersionItem[] = [];

    items.push({
      id: 'current',
      label: isDraftUnsaved ? 'Current draft' : 'Current',
      savedAt: Date.now(),
      isCurrent: true,
    });

    if (isNote) {
      if (versionHistory?.structuredHistory?.versions && Array.isArray(versionHistory.structuredHistory.versions)) {
        const versions = [...versionHistory.structuredHistory.versions].reverse();
        versions.forEach((v, index) => {
          const label = `Version ${versions.length - index}`;
          items.push({
            id: String(v.id),
            label,
            savedAt: v.savedAt,
            isCurrent: false,
          });
        });
      } else {
        const savedCount = getVersionCount(versionHistory);
        for (let i = 1; i <= savedCount; i++) {
          const versionNum = savedCount - i + 1;
          const label = `Version ${versionNum}`;
          const savedAt = i === 1 && versionHistory?.lastCheckpointAt ? versionHistory.lastCheckpointAt : undefined;
          items.push({
            id: `note_v_${i}`,
            label,
            savedAt,
            isCurrent: false,
          });
        }
      }
    } else if (versionHistory && Array.isArray(versionHistory.versions)) {
      const versions = [...versionHistory.versions].reverse();
      versions.forEach((v, index) => {
        const label = `Version ${versions.length - index}`;
        items.push({
          id: String(v.id),
          label,
          savedAt: v.savedAt,
          isCurrent: false,
        });
      });
    }

    return items;
  }, [versionHistory, isNote, isDraftUnsaved]);

  const defaultSelectedId = useMemo(() => {
    const historical = timelineItems.filter(t => !t.isCurrent);
    if (historical.length === 0) return 'current';
    return historical[0].id;
  }, [timelineItems]);

  const [selectedId, setSelectedId] = useState<string>(defaultSelectedId);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(defaultSelectedId);
    }
  }, [isOpen, defaultSelectedId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      unregister();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [isOpen, triggerRef]);

  const { leftSnapshot, rightSnapshot } = useMemo(() => {
    const structHistory = isNote ? versionHistory?.structuredHistory : versionHistory;
    const historicalVersions = structHistory && Array.isArray(structHistory.versions) ? structHistory.versions : [];

    if (selectedId === 'current') {
      const lastHist = historicalVersions.length > 0
        ? historicalVersions[historicalVersions.length - 1].snapshot
        : currentSnapshot;
      return {
        leftSnapshot: lastHist || currentSnapshot,
        rightSnapshot: currentSnapshot,
      };
    }

    if (historicalVersions.length > 0) {
      const idx = historicalVersions.findIndex((v: any) => String(v.id) === selectedId);
      if (idx !== -1) {
        if (idx === 0) {
          // Version 1 (initial creation): compare Version 1 snapshot against Version 1 snapshot
          return {
            leftSnapshot: historicalVersions[0].snapshot,
            rightSnapshot: historicalVersions[0].snapshot,
          };
        }
        // Version N (N >= 2): compare Version N-1 (left) against Version N (right)
        // e.g. Version 3 (idx = 2): left = Version 2 (idx = 1), right = Version 3 (idx = 2)
        const left = historicalVersions[idx - 1].snapshot;
        const right = historicalVersions[idx].snapshot;
        return {
          leftSnapshot: left,
          rightSnapshot: right,
        };
      }
    }

    // Fallback for legacy Note history without structuredHistory
    if (isNote && selectedId.startsWith('note_v_')) {
      const idx = parseInt(selectedId.replace('note_v_', ''), 10);
      const currentBody = getNoteBody(currentSnapshot);
      if (idx === 1) {
        const body1 = getHistoricalVersion(currentBody, versionHistory, 1);
        return {
          leftSnapshot: { entityType: 'note', body: body1 },
          rightSnapshot: { entityType: 'note', body: body1 },
        };
      }
      const legacyBodyLeft = getHistoricalVersion(currentBody, versionHistory, idx - 1);
      const legacyBodyRight = getHistoricalVersion(currentBody, versionHistory, idx);

      return {
        leftSnapshot: { entityType: 'note', body: legacyBodyLeft },
        rightSnapshot: { entityType: 'note', body: legacyBodyRight },
      };
    }

    return {
      leftSnapshot: currentSnapshot,
      rightSnapshot: currentSnapshot,
    };
  }, [selectedId, isNote, currentSnapshot, versionHistory]);

  const isIdentical = useMemo(() => {
    if (isNote) {
      const prevBody = getNoteBody(leftSnapshot);
      const currBody = getNoteBody(rightSnapshot);
      const cleanPrev = convertHtmlToCleanLines(prevBody);
      const cleanCurr = convertHtmlToCleanLines(currBody);

      const prevTitle = typeof leftSnapshot === 'object' ? leftSnapshot?.title : undefined;
      const currTitle = typeof rightSnapshot === 'object' ? rightSnapshot?.title : undefined;

      const prevShortcut = typeof leftSnapshot === 'object' ? leftSnapshot?.shortcut : undefined;
      const currShortcut = typeof rightSnapshot === 'object' ? rightSnapshot?.shortcut : undefined;

      const titleSame = prevTitle === undefined || prevTitle === currTitle;
      const shortcutSame = prevShortcut === undefined || prevShortcut === currShortcut;

      return cleanPrev === cleanCurr && titleSame && shortcutSame;
    }
    return snapshotsAreEqual(leftSnapshot, rightSnapshot);
  }, [isNote, leftSnapshot, rightSnapshot]);

  const displayMode: 'changes' | 'snapshot' =
    selectedId === 'current' || isIdentical
      ? 'snapshot'
      : 'changes';

  if (!isOpen) return null;

  const renderDiffViewer = () => {
    let viewer: React.ReactNode;

    if (type.includes('note')) {
      viewer = <NoteDiffViewer previousSnapshot={leftSnapshot} currentSnapshot={rightSnapshot} displayMode={displayMode} />;
    } else if (type.includes('todo')) {
      viewer = <TodoDiffViewer previousSnapshot={leftSnapshot} currentSnapshot={rightSnapshot} displayMode={displayMode} />;
    } else if (type.includes('snippet')) {
      viewer = <SnippetDiffViewer previousSnapshot={leftSnapshot} currentSnapshot={rightSnapshot} displayMode={displayMode} />;
    } else if (type.includes('link')) {
      viewer = <LinkDiffViewer previousSnapshot={leftSnapshot} currentSnapshot={rightSnapshot} displayMode={displayMode} />;
    } else if (type.includes('session')) {
      viewer = <SessionDiffViewer previousSnapshot={leftSnapshot} currentSnapshot={rightSnapshot} displayMode={displayMode} />;
    } else {
      viewer = (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-textMuted)]">
          Unsupported editor type for version history
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 relative">
        {isIdentical && (
          <div className="px-3 py-1.5 mb-2 rounded-lg bg-[var(--color-inputBg,rgba(255,255,255,0.03))] border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] flex items-center justify-between text-xs text-[var(--color-textMuted,#737373)] shrink-0">
            <span className="flex items-center gap-1.5">
              <FiCheckCircle size={13} className="text-emerald-400 shrink-0" />
              <span>No changes between these versions</span>
            </span>
            <span className="text-[11px] opacity-70">Showing baseline content</span>
          </div>
        )}
        {viewer}
      </div>
    );
  };

  const historicalCount = timelineItems.filter(t => !t.isCurrent).length;

  return createPortal(
    <AnimatePresence>
      {isAltSAppearance && (
        <style>{`
          .version-history-alts-modal,
          .version-history-alts-modal * {
            color-scheme: inherit;
          }
          .version-history-alts-modal {
            color: var(--color-textPrimary);
          }
          .version-history-alts-modal :where(button) {
            color: var(--color-textSecondary);
          }
          .version-history-alts-modal :where(button:hover, button[aria-selected="true"]) {
            background: var(--color-hoverBg);
            color: var(--color-textPrimary);
          }
          .version-history-alts-modal :where(input, textarea, select) {
            background: var(--color-inputBg);
            color: var(--color-textPrimary);
            border-color: var(--color-borderDefault);
          }
        `}</style>
      )}
      <div
        className={`${isAltSAppearance ? 'z-alts-subpopup version-history-alts-modal' : 'bg-black/60'} fixed inset-0 flex items-center justify-center p-6 backdrop-blur-md select-none animate-in fade-in duration-200`}
        style={{
          ...appearanceStyle,
          zIndex: 2147483647,
          backgroundColor: isAltSAppearance
            ? 'color-mix(in srgb, var(--alts-popup-bg, var(--color-altsPopupBg)) 50%, transparent)'
            : undefined,
        }}
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}>
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-history-modal-title"
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative w-full max-w-[1400px] h-full max-h-[850px] min-w-[760px] bg-[var(--color-modalBg,#121212)] border border-[var(--color-borderDefault,rgba(255,255,255,0.12))] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}>
          <VersionHistoryHeader onClose={onClose} />

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <main className="flex-1 flex flex-col min-w-0 p-5 gap-3 bg-[var(--color-containerBg,#080808)]">
              {historicalCount === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2 border border-dashed border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-xl bg-[var(--color-editorBg,#171821)]">
                  <div className="text-sm font-semibold text-[var(--color-textPrimary,#FFFFFF)]">
                    No historical versions recorded yet
                  </div>
                  <div className="text-xs text-[var(--color-textMuted,#737373)] max-w-sm">
                    Earlier checkpoints will automatically appear here as you make meaningful edits to your {type}.
                  </div>
                </div>
              ) : (
                renderDiffViewer()
              )}
            </main>

            <VersionTimeline
              items={timelineItems}
              selectedId={selectedId}
              onSelectVersion={setSelectedId}
              isDraftUnsaved={isDraftUnsaved}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    portalTarget || document.body,
  );
};

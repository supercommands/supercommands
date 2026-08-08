import React from 'react';
import { createPortal } from 'react-dom';
import { useDbStore } from '../../storage/store/useDbStore';
import { getVersionCount } from '../../allObjectFolder/src/createObject/notes/noteHistory';

export interface VersionHistoryListItem {
  id: string;
  label: string;
  savedAt?: number;
  isCurrent?: boolean;
}

export interface VersionHistoryManagerProps {
  setIsVersionHistoryCategoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  versionHistoryCategoryPopupPos: { x: number; y: number } | null;
  versionHistoryCategoryRef: React.RefObject<HTMLDivElement | null>;
  
  // Generalized items mode
  items?: VersionHistoryListItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;

  // Legacy Notes mode fallback
  activeNoteId?: string;
  setNoteVersionIndex?: (versionIndex: number) => void;
  selectedNoteVersionIndex?: number;
}

export default function VersionHistoryManager({
  setIsVersionHistoryCategoryOpen,
  versionHistoryCategoryRef,
  versionHistoryCategoryPopupPos,
  items,
  selectedId,
  onSelect,
  activeNoteId,
  setNoteVersionIndex,
  selectedNoteVersionIndex = 0,
}: VersionHistoryManagerProps) {
  const notes = useDbStore(state => state.notes);

  if (!versionHistoryCategoryPopupPos) return null;

  // If explicit items were passed, use the generalized list model
  if (items && onSelect) {
    const handleSelect = (id: string | null) => {
      onSelect(id);
      setIsVersionHistoryCategoryOpen(false);
    };

    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: `${versionHistoryCategoryPopupPos.x}px`,
          top: `${versionHistoryCategoryPopupPos.y}px`,
          zIndex: 2147483647,
          minWidth: '240px',
        }}
        className="bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden p-4 flex flex-col gap-2 transition-colors animate-in fade-in zoom-in-95 duration-200"
        ref={versionHistoryCategoryRef}
        onClick={e => e.stopPropagation()}>
        <div className="font-bold text-sm text-[var(--color-textPrimary)] mb-1">Version history</div>
        <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
          {items.map(item => {
            const isSelected = item.isCurrent ? (!selectedId || selectedId === 'current') : selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.isCurrent ? null : item.id)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex flex-col ${
                  isSelected
                    ? 'border-[var(--color-borderActive,#3b82f6)] bg-[var(--color-hoverBg,rgba(255,255,255,0.08))] text-[var(--color-textPrimary)]'
                    : 'border-transparent bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
                } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive)]`}>
                <div>{item.label}</div>
                {item.savedAt && (
                  <div className="text-[11px] text-[var(--color-textMuted)] mt-0.5">
                    {new Date(item.savedAt).toLocaleString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );
  }

  // Legacy Notes Mode
  if (!activeNoteId || !setNoteVersionIndex) return null;
  const currentNote = notes.find(note => note.id === activeNoteId);
  if (!currentNote) return null;

  const { versionHistory } = currentNote;
  const savedCount = getVersionCount(versionHistory); // lastSavedText + buffered diffs

  const handleVersionClick = (versionIndex: number) => {
    setNoteVersionIndex(versionIndex);
    setIsVersionHistoryCategoryOpen(false);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: `${versionHistoryCategoryPopupPos.x}px`,
        top: `${versionHistoryCategoryPopupPos.y}px`,
        zIndex: 2147483647,
        minWidth: '240px',
      }}
      className="bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden p-4 flex flex-col gap-2 transition-colors animate-in fade-in zoom-in-95 duration-200"
      ref={versionHistoryCategoryRef}
      onClick={e => e.stopPropagation()}>
      <div className="font-bold text-sm text-[var(--color-textPrimary)] mb-1">Version history</div>
      <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => handleVersionClick(0)}
          className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
            selectedNoteVersionIndex === 0
              ? 'border-[var(--color-borderActive,#3b82f6)] bg-[var(--color-hoverBg,rgba(255,255,255,0.08))] text-[var(--color-textPrimary)]'
              : 'border-transparent bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
          } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive)]`}>
          <div>Current</div>
        </button>

        {Array.from({ length: savedCount }, (_, i) => {
          const versionIndex = i + 1; // 1 = most recent checkpoint, savedCount = oldest
          const label = savedCount - i; // higher number = more recent
          const isSelected = selectedNoteVersionIndex === versionIndex;
          return (
            <button
              key={versionIndex}
              type="button"
              onClick={() => handleVersionClick(versionIndex)}
              className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex flex-col ${
                isSelected
                  ? 'border-[var(--color-borderActive,#3b82f6)] bg-[var(--color-hoverBg,rgba(255,255,255,0.08))] text-[var(--color-textPrimary)]'
                  : 'border-transparent bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
              } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive)]`}>
              <div>Version {label}</div>
              {versionIndex === 1 && (
                <div className="text-[11px] text-[var(--color-textMuted)] mt-0.5">
                  {new Date(versionHistory.lastCheckpointAt).toLocaleString()}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

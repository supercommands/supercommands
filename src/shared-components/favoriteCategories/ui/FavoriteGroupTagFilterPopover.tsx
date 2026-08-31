import * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiCheck, FiX, FiFilter, FiTrash2 } from 'react-icons/fi';
import type { TagRecord } from '../../../allObjectFolder/src/createObject/tags/tagTypes';

interface FavoriteGroupTagFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedTagIds: string[];
  availableTags: TagRecord[];
  favoriteUsageCounts: Record<string, number>;
  onApply: (selectedTagIds: string[]) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  popoverCoords?: { top: number; left: number } | null;
}

const FavoriteGroupTagFilterPopover: React.FC<FavoriteGroupTagFilterPopoverProps> = ({
  isOpen,
  onClose,
  initialSelectedTagIds = [],
  availableTags = [],
  favoriteUsageCounts = {},
  onApply,
  triggerRef,
  popoverCoords: coordsProp,
}) => {
  const [draftSelected, setDraftSelected] = useState<string[]>(initialSelectedTagIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedTagIds && initialSelectedTagIds.length > 0) {
        setDraftSelected(initialSelectedTagIds);
      } else {
        setDraftSelected(availableTags.map(t => t.id));
      }
      setSearchQuery('');
    }
  }, [isOpen, initialSelectedTagIds, availableTags]);

  useEffect(() => {
    if (!isOpen) return;

    if (coordsProp) {
      setPopoverPos({ x: coordsProp.left, y: coordsProp.top });
      return;
    }

    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 240;
      let x = Math.max(12, rect.right - popoverWidth);
      let y = rect.bottom + 6;
      if (y + 320 > window.innerHeight - 12) {
        y = Math.max(12, rect.top - 320 - 6);
      }
      setPopoverPos({ x, y });
      return;
    }

    // Default fallback position (center of screen)
    const popoverWidth = 240;
    const popoverHeight = 320;
    const x = Math.max(12, Math.round((window.innerWidth - popoverWidth) / 2));
    const y = Math.max(12, Math.round((window.innerHeight - popoverHeight) / 2));
    setPopoverPos({ x, y });
  }, [isOpen, triggerRef, coordsProp]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath();
      if (
        popoverRef.current && !path.includes(popoverRef.current) &&
        (!triggerRef?.current || !path.includes(triggerRef.current))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, triggerRef]);

  const uniqueTags = useMemo(() => {
    const map = new Map<string, TagRecord>();
    (availableTags || []).forEach(t => {
      if (!t || !t.name) return;
      const key = t.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, t);
    });
    return Array.from(map.values());
  }, [availableTags]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueTags;
    return uniqueTags.filter(t => t.name.toLowerCase().includes(q));
  }, [uniqueTags, searchQuery]);

  const toggleTag = (tagId: string) => {
    setDraftSelected(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId],
    );
  };

  const handleClear = () => {
    setDraftSelected([]);
  };

  const handleApply = () => {
    onApply(draftSelected);
    onClose();
  };

  if (!isOpen || !popoverPos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-portal="true"
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${popoverPos.x}px`,
        top: `${popoverPos.y}px`,
        zIndex: 2147483647,
      }}
      className="fixed w-60 bg-[var(--color-popupBg,#171821)] border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-xl shadow-2xl overflow-hidden text-[var(--color-textPrimary)] flex flex-col max-h-[340px] select-none animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-borderDefault,rgba(255,255,255,0.08))]">
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-[var(--color-textMuted)]">
          <FiFilter size={13} className="text-[var(--color-accent,#268bd2)]" />
          <span>Filter by tags</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer outline-none border-none bg-transparent">
          <FiX size={13} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-2 py-1.5 border-b border-[var(--color-borderDefault,rgba(255,255,255,0.08))]">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-inputBg,rgba(255,255,255,0.05))] border border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
          <FiSearch size={12} className="text-neutral-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full bg-transparent outline-none text-xs text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] border-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-neutral-400 hover:text-white cursor-pointer border-none bg-transparent">
              <FiX size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Tag List */}
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5 custom-scrollbar min-h-[100px] max-h-[180px]">
        {filteredTags.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[var(--color-textMuted)]">
            No tags found
          </div>
        ) : (
          filteredTags.map(tag => {
            const isSelected = draftSelected.includes(tag.id);
            const favCount = favoriteUsageCounts[tag.id] || 0;
            return (
              <div
                key={tag.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleTag(tag.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTag(tag.id);
                  }
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[var(--color-accent,#268bd2)]/15 text-[var(--color-textPrimary)] font-medium'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg,rgba(255,255,255,0.05))] hover:text-[var(--color-textPrimary)]'
                }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-[var(--color-accent,#268bd2)] border-[var(--color-accent,#268bd2)] text-white'
                        : 'border-[var(--color-borderDefault,rgba(255,255,255,0.2))] bg-transparent'
                    }`}>
                    {isSelected && <FiCheck size={10} />}
                  </div>
                  <span className="truncate">{tag.name}</span>
                </div>
                {favCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-400 font-mono ml-1 shrink-0">
                    {favCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-2 border-t border-[var(--color-borderDefault,rgba(255,255,255,0.08))] flex items-center justify-between gap-1 bg-black/10">
        <button
          type="button"
          onClick={handleClear}
          disabled={draftSelected.length === 0}
          className="px-2 py-1 rounded text-[11px] font-medium text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-none bg-transparent cursor-pointer">
          Clear
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-neutral-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--color-accent,#268bd2)] text-white hover:brightness-110 transition-all border-none cursor-pointer">
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default memo(FavoriteGroupTagFilterPopover);

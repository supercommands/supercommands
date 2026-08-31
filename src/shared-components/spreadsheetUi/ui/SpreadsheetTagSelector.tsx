import * as React from 'react';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiCheck, FiX, FiTag } from 'react-icons/fi';
import { clsx } from 'clsx';
import { useDbStore } from '../../../storage/store/useDbStore';

export interface SpreadsheetTagSelectorProps {
  cellElement: HTMLElement | null;
  initialTagIds: string[];
  onSave: (tagIds: string[]) => void;
  onCancel: () => void;
}

const computePosition = (cellElement: HTMLElement | null) => {
  if (!cellElement) {
    return { top: 100, left: 100, width: 240, placeAbove: false };
  }
  const rect = cellElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const popoverHeight = 260;

  const placeAbove = rect.bottom + popoverHeight > viewportHeight && rect.top > popoverHeight;

  return {
    top: placeAbove ? Math.max(8, rect.top - popoverHeight - 4) : Math.min(viewportHeight - popoverHeight - 8, rect.bottom + 4),
    left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 250)),
    width: Math.max(220, rect.width),
    placeAbove,
  };
};

export const SpreadsheetTagSelector: React.FC<SpreadsheetTagSelectorProps> = ({
  cellElement,
  initialTagIds = [],
  onSave,
  onCancel,
}) => {
  const allTags = useDbStore(state => state.tags) || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(initialTagIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState(() => computePosition(cellElement));

  useLayoutEffect(() => {
    setPosition(computePosition(cellElement));
  }, [cellElement]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const filteredTags = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return allTags;
    return allTags.filter(t => (t.name || '').toLowerCase().includes(term));
  }, [allTags, searchTerm]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    let isReady = false;
    const readyTimer = setTimeout(() => {
      isReady = true;
    }, 100);

    const handleOutsideClick = (e: MouseEvent) => {
      if (!isReady) return;

      const target = e.target as Node | null;
      if (!target) return;

      // 1. If target node was detached from DOM during React re-render, NOT an outside click!
      if (!document.body.contains(target)) return;

      // 2. If target is inside popover or has data-ignore-grid-nav="true", NOT an outside click!
      if (
        popoverRef.current?.contains(target) ||
        (target as HTMLElement).closest?.('[data-ignore-grid-nav="true"]')
      ) {
        return;
      }

      // 3. If target is inside originating cell, NOT an outside click!
      if (cellElement?.contains(target)) {
        return;
      }

      // Genuine outside click -> cancel/close
      onCancel();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      clearTimeout(readyTimer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [cellElement, onCancel]);

  const toggleTag = (tagId: string) => {
    setSelectedIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setFocusedIndex(prev => (filteredTags.length > 0 ? (prev + 1) % filteredTags.length : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setFocusedIndex(prev => (filteredTags.length > 0 ? (prev - 1 + filteredTags.length) % filteredTags.length : 0));
      return;
    }

    if (e.key === 'Enter' && e.target === searchInputRef.current) {
      if (filteredTags.length > 0 && focusedIndex >= 0 && focusedIndex < filteredTags.length) {
        e.preventDefault();
        e.stopPropagation();
        toggleTag(filteredTags[focusedIndex].id);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onSave(selectedIds);
      return;
    }

    if (e.key === ' ') {
      if (document.activeElement !== searchInputRef.current && filteredTags[focusedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        toggleTag(filteredTags[focusedIndex].id);
      }
    }
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      data-ignore-grid-nav="true"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        zIndex: 99999,
      }}
      className={clsx(
        'p-2.5 rounded-lg border shadow-2xl flex flex-col gap-2 select-none',
        'bg-[var(--color-popupBg)] border-[var(--color-borderDefault)] text-[var(--color-textPrimary)]'
      )}
    >
      {/* Header & Search */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded border bg-[var(--color-inputBg)] border-[var(--color-borderDefault)]">
        <FiSearch size={13} className="shrink-0 text-[var(--color-textSecondary)]" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search tags..."
          className="flex-1 bg-transparent text-[12px] font-medium outline-none border-none text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)]"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="p-0.5 rounded text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]"
          >
            <FiX size={12} />
          </button>
        )}
      </div>

      {/* Tag List */}
      <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-0.5">
        {filteredTags.length === 0 ? (
          <div className="py-4 text-center text-[11px] font-medium text-[var(--color-textSecondary)] flex flex-col items-center gap-1">
            <FiTag size={16} className="opacity-50" />
            <span>{allTags.length === 0 ? 'No tags created yet' : 'No matching tags'}</span>
          </div>
        ) : (
          filteredTags.map((tag, idx) => {
            const isChecked = selectedIds.includes(tag.id);
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={tag.id}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleTag(tag.id);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={clsx(
                  'flex items-center justify-between px-2 py-1.5 rounded text-[12px] cursor-pointer transition-colors',
                  isChecked
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-medium'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]',
                  isFocused && 'ring-1 ring-[var(--color-borderActive)] ring-inset'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <div
                    className={clsx(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all',
                      isChecked
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                        : 'border-[var(--color-borderDefault)] bg-[var(--color-inputBg)]'
                    )}
                  >
                    {isChecked && <FiCheck className="text-white text-[9px]" />}
                  </div>
                  <span className="truncate">{tag.name}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--color-borderDefault)] mt-0.5">
        <span className="text-[10px] font-medium text-[var(--color-textSecondary)]">
          {selectedIds.length} tag{selectedIds.length === 1 ? '' : 's'} selected
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onSave(selectedIds);
            }}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
};

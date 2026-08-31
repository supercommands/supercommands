/**
 * @file TagSelector.tsx
 * @description Integrated tag input and dropdown selector matching reference design.
 * Provides chip-based selected tag rendering, case-insensitive search, inline caret input,
 * keyboard navigation, and explicit tag creation.
 */

import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FiTag, FiChevronDown, FiX, FiPlus, FiCheck, FiTrash2, FiSearch } from 'react-icons/fi';
import { deleteTag, type TagRecord } from '../../allObjectFolder/src/createObject/tags';

export interface TagSelectorProps {
  /** Currently selected tags for the object */
  selectedTags: TagRecord[];
  /** Available database tags */
  dbTags: TagRecord[];
  /** Callback when a tag is selected or toggled */
  onTagSelect: (tag: TagRecord) => void;
  /** Callback to remove a specific tag by ID */
  onRemoveTag?: (tagId: string) => void;
  /** Callback to create a new tag */
  onCreateTag?: (name: string) => Promise<any> | void;
  /** Callback to delete a tag permanently */
  onDeleteTag?: (tagId: string) => Promise<any> | void;
  /** Callback to clear all selected tags from the object */
  onClearTags?: () => void;
  /** Workspace ID if available */
  workspaceId?: string | null;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Controlled open state */
  isOpen?: boolean;
  /** Controlled open state callback */
  onOpenChange?: (open: boolean) => void;
  /** Additional container CSS classes */
  className?: string;
  /** Optional visual scope used by portal-hosted editor surfaces such as Alt+S. */
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags = [],
  dbTags = [],
  onTagSelect,
  onRemoveTag,
  onCreateTag,
  onDeleteTag,
  onClearTags,
  workspaceId = null,
  placeholder = 'Search or create tag',
  isOpen: externalIsOpen,
  onOpenChange,
  className = '',
  appearanceScope = 'default',
  appearanceTokens,
}) => {
  const isAltSAppearance = appearanceScope === 'alts';
  const appearanceStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!isAltSAppearance) return appearanceTokens;
    return {
      ...appearanceTokens,
      '--color-contextMenuBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-inputBg': 'var(--alts-input-bg, var(--color-altsInputBg))',
      '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
      '--color-selectedBg': 'var(--alts-selected-bg, var(--color-altsSelectedBg))',
      '--color-borderDefault': 'var(--alts-border-color, var(--color-altsBorderColor))',
      '--color-borderActive': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
      '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
      '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
      '--color-textMuted': 'var(--alts-text-muted, var(--color-altsTextMuted))',
      '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
    } as React.CSSProperties;
  }, [appearanceTokens, isAltSAppearance]);

  const handleDeleteTag = async (e: React.MouseEvent, tag: TagRecord) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (onDeleteTag) {
        await onDeleteTag(tag.id);
      } else {
        const sameNameTags = dbTags.filter(t => t.name.trim().toLowerCase() === tag.name.trim().toLowerCase());
        for (const t of sameNameTags) {
          if (t.id && !t.id.startsWith('temp_')) {
            await deleteTag(t.id);
          }
        }
      }
      if (onRemoveTag) {
        onRemoveTag(tag.id);
      }
    } catch (err) {
      console.error('[TagSelector] Failed to delete tag:', err);
    }
  };
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const setIsOpen = useCallback(
    (open: boolean) => {
      if (externalIsOpen === undefined) {
        setInternalIsOpen(open);
      }
      onOpenChange?.(open);
    },
    [externalIsOpen, onOpenChange]
  );

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isCreatingRef = useRef(false);

  // Normalize dbTags (unique case-insensitively)
  const uniqueDbTags = useMemo(() => {
    const map = new Map<string, TagRecord>();
    (dbTags || []).forEach(t => {
      if (!t || !t.name) return;
      const key = t.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, t);
    });
    return Array.from(map.values());
  }, [dbTags]);

  const trimmedQuery = query.trim().toLowerCase();

  // Filter existing tags case-insensitively
  const filteredTags = useMemo(() => {
    if (!trimmedQuery) return uniqueDbTags;
    return uniqueDbTags.filter(t => t.name.toLowerCase().includes(trimmedQuery));
  }, [uniqueDbTags, trimmedQuery]);

  // Check exact case-insensitive match
  const exactMatch = useMemo(() => {
    if (!trimmedQuery) return null;
    return uniqueDbTags.find(t => t.name.trim().toLowerCase() === trimmedQuery) || null;
  }, [uniqueDbTags, trimmedQuery]);

  const canCreate = Boolean(trimmedQuery && !exactMatch);
  const totalSelectableItems = filteredTags.length + (canCreate ? 1 : 0);

  // Reset activeIndex when query or options change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, filteredTags.length, canCreate]);

  // Scroll active keyboard item into view
  useEffect(() => {
    if (isOpen && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (!isOpen) return;
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen, setIsOpen]);

  const handleRemoveTagChip = (e: React.MouseEvent, tag: TagRecord) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRemoveTag) {
      onRemoveTag(tag.id);
    } else {
      onTagSelect(tag);
    }
    inputRef.current?.focus();
  };

  const handleSelectOption = async (tag: TagRecord) => {
    onTagSelect(tag);
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleCreateOption = async () => {
    if (!trimmedQuery || isCreatingRef.current) return;
    isCreatingRef.current = true;
    try {
      const rawName = query.trim();
      if (onCreateTag) {
        await onCreateTag(rawName);
      } else {
        const newTag: TagRecord = {
          id: `temp_${rawName}`,
          name: rawName,
          workspaceId: workspaceId || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onTagSelect(newTag);
      }
      setQuery('');
      setActiveIndex(0);
    } finally {
      isCreatingRef.current = false;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (totalSelectableItems > 0) {
        setActiveIndex(prev => (prev + 1) % totalSelectableItems);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (totalSelectableItems > 0) {
        setActiveIndex(prev => (prev - 1 + totalSelectableItems) % totalSelectableItems);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (canCreate && activeIndex === filteredTags.length) {
        await handleCreateOption();
      } else if (filteredTags[activeIndex]) {
        await handleSelectOption(filteredTags[activeIndex]);
      } else if (exactMatch) {
        await handleSelectOption(exactMatch);
      } else if (canCreate) {
        await handleCreateOption();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    } else if (e.key === 'Backspace' && query === '') {
      if (selectedTags.length > 0) {
        const lastTag = selectedTags[selectedTags.length - 1];
        if (onRemoveTag) {
          onRemoveTag(lastTag.id);
        } else {
          onTagSelect(lastTag);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      style={appearanceStyle}
      className={`${isAltSAppearance ? 'tag-selector-alts ' : ''}relative w-full text-left ${className}`}>
      {isAltSAppearance && (
        <style>{`
          .tag-selector-alts,
          .tag-selector-alts * {
            box-sizing: border-box;
          }
          .tag-selector-alts input {
            background: transparent !important;
            color: var(--color-textPrimary) !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .tag-selector-alts input::placeholder {
            color: var(--color-textPlaceholder) !important;
          }
          .tag-selector-alts button {
            appearance: none;
            color: inherit;
          }
        `}</style>
      )}
      {/* Closed/Collapsed & Expanded Input Field Container */}
      <div
        onClick={() => {
          if (!isOpen) setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`group relative z-[51] flex items-center flex-wrap gap-1.5 min-h-[38px] px-3 py-1.5 border cursor-text transition-colors duration-150 ${
          isOpen
            ? 'rounded-t-xl rounded-b-none border-[var(--color-borderActive)] bg-[var(--color-contextMenuBg)]'
            : 'rounded-xl border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] hover:border-[var(--color-borderActive)]'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
        aria-label="Tags"
      >
        {/* Left Search Icon when no tags selected */}
        {selectedTags.length === 0 && (
          <FiSearch className="text-[var(--color-textMuted)] flex-shrink-0 mr-0.5" size={15} />
        )}

        {/* Selected Tag Chips */}
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] text-xs font-medium border border-[var(--color-borderDefault)] select-none transition-colors"
          >
            <span className="truncate max-w-[120px]">{tag.name}</span>
            <button
              type="button"
              aria-label={`Remove tag "${tag.name}"`}
              onClick={e => handleRemoveTagChip(e, tag)}
              className="text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] rounded p-0.5 focus:outline-none transition-colors"
            >
              <FiX size={11} />
            </button>
          </span>
        ))}

        {/* Inline Caret / Search Input */}
        <div className="flex-1 flex items-center min-w-[80px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            onChange={e => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-xs text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none border-none p-0"
          />
        </div>

        {/* Right Dropdown Chevron Icon */}
        <button
          type="button"
          aria-label="Toggle tag dropdown"
          onClick={e => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] flex-shrink-0 ml-auto p-0.5 transition-transform duration-200 focus:outline-none"
        >
          <FiChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {/* Open Anchored Dropdown Popover */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 flex flex-col overflow-hidden rounded-t-none rounded-b-xl border border-t-0 border-[var(--color-borderActive)] bg-[var(--color-contextMenuBg)] shadow-2xl animate-in fade-in duration-150"
        >
          {/* Header Section */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-textMuted)]">
              ALL TAGS
            </span>
            {selectedTags.length > 0 && onClearTags && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onClearTags();
                }}
                className="text-[10px] text-[var(--color-danger)] hover:underline font-medium focus:outline-none"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Vertically Scrollable List of Matching Tags */}
          <div className="max-h-[160px] overflow-y-auto px-1 py-1 flex flex-col gap-0.5 custom-scrollbar" role="listbox">
            {filteredTags.length === 0 && !canCreate && (
              <div className="px-3 py-3 text-xs text-[var(--color-textMuted)] text-center italic select-none">
                No tags found
              </div>
            )}

            {filteredTags.map((tag, index) => {
              const isSelected = selectedTags.some(
                st => st.id === tag.id || st.name.trim().toLowerCase() === tag.name.trim().toLowerCase()
              );
              const isActive = activeIndex === index;

              return (
                <div
                  key={tag.id || tag.name}
                  role="option"
                  aria-selected={isSelected}
                  ref={el => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    handleSelectOption(tag);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`group/tagitem flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                    isActive
                      ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                      : 'text-[var(--color-textPrimary)]'
                  } ${isSelected ? 'bg-[var(--color-selectedBg)] font-medium text-[var(--color-accent)]' : ''}`}
                >
                  <span className="truncate max-w-[170px]">{tag.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && <FiCheck size={14} className="text-[var(--color-accent)] shrink-0" />}
                    <button
                      type="button"
                      aria-label={`Delete tag "${tag.name}" permanently`}
                      title="Delete tag permanently"
                      onClick={e => handleDeleteTag(e, tag)}
                      className="text-[var(--color-textMuted)] hover:text-red-500 opacity-0 group-hover/tagitem:opacity-100 transition-opacity p-0.5 rounded cursor-pointer border-none bg-transparent"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visually Distinct Bottom Row for Tag Creation */}
          {canCreate && (
            <div className="border-t border-[var(--color-borderDefault)] p-1">
              <div
                role="option"
                aria-selected={false}
                ref={el => {
                  itemRefs.current[filteredTags.length] = el;
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleCreateOption();
                }}
                onMouseEnter={() => setActiveIndex(filteredTags.length)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--color-accent)] font-medium cursor-pointer select-none transition-colors ${
                  activeIndex === filteredTags.length ? 'bg-[var(--color-hoverBg)]' : ''
                }`}
              >
                <FiPlus size={14} className="flex-shrink-0" />
                <span className="truncate">
                  Create &ldquo;{query.trim()}&rdquo;
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

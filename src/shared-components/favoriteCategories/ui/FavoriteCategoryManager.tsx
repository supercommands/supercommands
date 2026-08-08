import * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppearance } from '@extension/ui';
import { FiFolder, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';

import { useUser } from '../../favorites/favoriteHooks';
import {
  createFavoriteCategory,
  deleteFavoriteCategory,
  updateFavoriteCategory,
  useFavoriteCategories,
} from '../../../allObjectFolder/src/createObject/favoriteCategory';

type FavoriteCategoryManagerProps = {
  className?: string;
  popoverClassName?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  showTrigger?: boolean;
  isFavorite?: boolean;
  onRemoveFavorite?: () => void;
  onSelectCategory?: (categoryId: string | null) => void;
  selectedCategoryId?: string | null;
};

const FavoriteCategoryManager = ({
  className = '',
  popoverClassName = 'absolute right-0 top-full mt-2',
  isOpen: controlledOpen,
  onOpenChange,
  showTrigger = true,
  isFavorite = false,
  onRemoveFavorite,
  onSelectCategory,
  selectedCategoryId = null,
}: FavoriteCategoryManagerProps) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const userId = useUser();
  const categories = useFavoriteCategories(userId);

  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  useEffect(() => {
    if (open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const x = Math.max(12, rect.right - 240);
      const y = rect.bottom + 4;
      setPopoverPos({ x, y });
    }
  }, [open]);

  const normalizedQuery = query.trim();

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA === nameB) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
      return nameA.localeCompare(nameB);
    });
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const needle = normalizedQuery.toLowerCase();
    if (!needle) return sortedCategories;
    return sortedCategories.filter(category => category.name.toLowerCase().includes(needle));
  }, [normalizedQuery, sortedCategories]);

  const exactMatch = useMemo(() => {
    if (!normalizedQuery) return null;
    return categories.find(category => category.name.toLowerCase() === normalizedQuery.toLowerCase()) ?? null;
  }, [categories, normalizedQuery]);

  const closePopover = () => {
    setOpen(false);
    setEditingCategoryId(null);
    setEditingName('');
    setQuery('');
    setHoveredIndex(-1);
  };

  const startEdit = (categoryId: string, categoryName: string) => {
    setEditingCategoryId(categoryId);
    setEditingName(categoryName);
    window.setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingName('');
    setHoveredIndex(-1);
  };

  const handleCreate = async (rawName?: string) => {
    const trimmed = (rawName ?? query).trim();
    if (!trimmed || !userId) return;

    try {
      if (exactMatch) {
        setQuery(exactMatch.name);
        return;
      }

      await createFavoriteCategory(trimmed, userId);
      setQuery('');
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to create favorite category:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategoryId) return;

    const trimmed = editingName.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }

    const duplicate = categories.find(
      category =>
        category.id !== editingCategoryId && category.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (duplicate) {
      setEditingName(duplicate.name);
      return;
    }

    try {
      await updateFavoriteCategory(editingCategoryId, { name: trimmed });
      cancelEdit();
    } catch (error) {
      console.error('Failed to update favorite category:', error);
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      await deleteFavoriteCategory(categoryId);
      if (editingCategoryId === categoryId) {
        cancelEdit();
      }
    } catch (error) {
      console.error('Failed to delete favorite category:', error);
    }
  };

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath();
      if (
        rootRef.current && !path.includes(rootRef.current) &&
        popoverRef.current && !path.includes(popoverRef.current)
      ) {
        closePopover();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={showTrigger ? `relative inline-flex ${className}` : `absolute inset-0 pointer-events-none ${className}`}>
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title="Favorite categories"
          aria-label="Favorite categories"
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-colors
            ${
              isDark
                ? 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                : 'border-black/10 bg-white/70 text-neutral-700 hover:bg-black/5 hover:text-black'
            }`}>
          <FiFolder size={15} />
        </button>
      )}

      {open && popoverPos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: `${popoverPos.x}px`,
            top: `${popoverPos.y}px`,
            zIndex: 2147483647,
          }}
          className="pointer-events-auto w-[240px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
          {isFavorite && onRemoveFavorite && (
            <button
              type="button"
              onClick={() => {
                onRemoveFavorite();
                closePopover();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors border-b border-slate-100 dark:border-white/5">
              <FaStar size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />
              <span className="font-medium flex-1">Remove favourite</span>
            </button>
          )}

          <div className="border-b border-slate-100 dark:border-white/5 flex items-center">
            <form
              onSubmit={async e => {
                e.preventDefault();
                await handleCreate();
              }}
              className="flex-1 flex">
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreate();
                  } else if (e.key === 'Escape') {
                    closePopover();
                  }
                }}
                placeholder="Search or create a category"
                className="w-full bg-transparent px-3 py-2 text-xs outline-none text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)]"
              />
            </form>
          </div>

          <style
            dangerouslySetInnerHTML={{
              __html: `
                .no-scrollbar::-webkit-scrollbar {
                  display: none !important;
                }
                .no-scrollbar {
                  -ms-overflow-style: none !important;
                  scrollbar-width: none !important;
                }
              `,
            }}
          />

          <div className="p-2 flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar">
            {!normalizedQuery && filteredCategories.length === 0 && (
              <div className="px-2 py-2 rounded-lg text-[12px] text-[var(--color-textSecondary)]">
                No favorite categories yet
              </div>
            )}

            {normalizedQuery && !exactMatch && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors border border-dashed border-neutral-300 dark:border-white/10 mb-1">
                <div className="flex items-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-400 dark:text-neutral-500">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span>Create &quot;{normalizedQuery}&quot;</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-400 dark:text-neutral-400 font-mono scale-90">
                  Enter
                </span>
              </button>
            )}

            {editingCategoryId ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 mb-1">
                <input
                  ref={editInputRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      cancelEdit();
                    }
                  }}
                  onBlur={() => {
                    void handleSaveEdit();
                  }}
                  className="w-full bg-transparent outline-none text-[12px] text-[var(--color-textPrimary)]"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-300"
                  title="Save">
                  <FiCheck size={11} />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-300"
                  title="Cancel">
                  <FiX size={11} />
                </button>
              </div>
            ) : null}

            {filteredCategories.map((category, index) => {
              const isHighlighted = hoveredIndex === index;
              const isSelected = editingCategoryId === category.id;
              return (
                <div
                  className={`group flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isHighlighted || isSelected
                      ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-medium'
                      : 'text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
                  }`}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onClick={() => {
                    if (onSelectCategory) {
                      const nextCategory = selectedCategoryId === category.id ? null : category.id;
                      onSelectCategory(nextCategory);
                      closePopover();
                      return;
                    }
                    startEdit(category.id, category.name);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (onSelectCategory) {
                        const nextCategory = selectedCategoryId === category.id ? null : category.id;
                        onSelectCategory(nextCategory);
                        closePopover();
                      } else {
                        startEdit(category.id, category.name);
                      }
                    }
                  }}
                  >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedCategoryId === category.id && (
                      <FiCheck size={11} className="text-yellow-500 shrink-0" />
                    )}
                    <span className="truncate">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        startEdit(category.id, category.name);
                      }}
                      title="Edit"
                      className="p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                      <FiEdit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        void handleDelete(category.id);
                      }}
                      title="Delete"
                      className="p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            {normalizedQuery && exactMatch && filteredCategories.length === 1 && !editingCategoryId && (
              <div className="px-2 py-1.5 rounded-lg text-[12px] text-neutral-500 dark:text-neutral-400">
                Category already exists
              </div>
            )}

            {normalizedQuery && !exactMatch && filteredCategories.length === 0 && !editingCategoryId && (
              <div className="px-2 py-1.5 rounded-lg text-[12px] text-neutral-500 dark:text-neutral-400">
                Press Enter to create the new category
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default memo(FavoriteCategoryManager);

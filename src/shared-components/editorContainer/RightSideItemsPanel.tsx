import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronLeft, FiChevronRight, FiExternalLink, FiSearch, FiStar, FiZapOff, FiMoreVertical } from 'react-icons/fi';
import { FaStar, FaKeyboard, FaTag, FaTrash, FaTimes } from 'react-icons/fa';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import { buildHotkeyString } from '../hotkeys/core/eventParser';
import { useDbStore } from '../../storage/store/useDbStore';
import { createTag, deleteTag, type TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { TagSelector } from '../editorToolbar/TagSelector';

const getTagColor = (tagName: string) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f43f5e', // rose
    '#14b8a6', // teal
  ];
  const nameStr = String(tagName || '');
  if (!nameStr) return colors[0];
  let sum = 0;
  for (let i = 0; i < nameStr.length; i++) {
    sum += nameStr.charCodeAt(i) * (i + 1);
  }
  const index = sum % colors.length;
  return colors[index];
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RightSideItemsPanelProps<T extends { id: string }> {
  /** The full list of items to display (already filtered / sorted by the parent). */
  items: T[];
  /** The ID of the currently active/editing item. */
  activeItemId: string | null;

  /** Search query value — controlled by parent. */
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;

  // ── Field extractors (generic) ─────────────────────────────────────────────
  getItemTitle: (item: T) => string;
  getItemPreview: (item: T) => string;
  /** Returns the full compound ID used for shortcuts / hotkeys / favorites maps. */
  getItemCompoundId: (item: T) => string;
  /** Returns the item type string ('note', 'session', 'snippet', …). */
  getItemType: (item: T) => string;
  getItemWorkspaceId?: (item: T) => string | null;
  getItemFolderId?: (item: T) => string | null;
  getItemTagIds?: (item: T) => string[];
  /** Optional icon renderer for item row */
  getItemIcon?: (item: T) => React.ReactNode;

  /**
   * Letter prefix shown before the shortcut badge in column 1.
   * e.g. 'c' → badge reads "c myshortcut".  Default: 'c'.
   */
  shortcutPrefix?: string;
  showFolderColumn?: boolean;

  // ── Lookup maps ────────────────────────────────────────────────────────────
  shortcutsMap: Record<string, string>;
  hotkeysMap: Record<string, string>;
  workspaceNamesMap?: Record<string, string>;
  folderNamesMap?: Record<string, string>;
  tagNamesMap?: Record<string, string>;

  // ── Callbacks ──────────────────────────────────────────────────────────────
  onLoadItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  /**
   * Called when the user clicks the opener (external-link) button.
   * Each editor provides its own implementation (open note / open session tabs / …).
   */
  onOpenerClick?: (item: T) => void;
  onCloseClick?: () => void;

  onUpdateShortcut: (id: string, value: string) => Promise<void>;
  onUpdateTitle: (id: string, value: string) => Promise<void>;
  /** value is a comma-separated tag string, e.g. "work, urgent" */
  onUpdateTags: (id: string, tagText: string) => Promise<void>;

  isFavorite: (compoundId: string) => boolean;
  toggleFavorite: (compoundId: string, type: string, title: string) => Promise<void>;
  addFavorite?: (compoundId: string, type: string, title: string) => Promise<void>;

  // ── Expansion state (owned by parent) ─────────────────────────────────────
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;

  emptyStateMessage?: string;

  /** Optional ref forwarded to the search input so the parent can focus it. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;

  /** If true, removes outer border, shadow, and rounded corners for seamless integration. */
  hideBorder?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RightSideItemsPanel<T extends { id: string }>({
  items,
  activeItemId,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search items...',
  getItemTitle,
  getItemPreview,
  getItemCompoundId,
  getItemType,
  getItemWorkspaceId,
  getItemTagIds,
  getItemIcon,
  shortcutPrefix = 'c',
  shortcutsMap,
  hotkeysMap,
  tagNamesMap,
  onLoadItem,
  onDeleteItem,
  onOpenerClick,
  onCloseClick,
  onUpdateShortcut,
  onUpdateTitle,
  onUpdateTags,
  isFavorite,
  toggleFavorite,
  addFavorite,
  isExpanded,
  onExpandChange,
  emptyStateMessage = 'No items found.',
  searchInputRef: externalSearchInputRef,
  hideBorder = false,
}: RightSideItemsPanelProps<T>) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // ── Selection State ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);

  // ── Inline editing state ──────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'title' | 'shortcut' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [recordingHotkeyId, setRecordingHotkeyId] = useState<string | null>(null);
  const [recordingCombo, setRecordingCombo] = useState('');

  // ── Tag Dropdown Popover State ───────────────────────────────────────────
  // openTagPickerItemId: item.id OR '__BULK__' when targeting selected rows
  const [openTagPickerItemId, setOpenTagPickerItemId] = useState<string | null>(null);
  const [tagPopupPos, setTagPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const dbTags = useDbStore(state => state.tags);

  // ── Soft Delete State ─────────────────────────────────────────────────────
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const pendingTimerMapRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const onDeleteItemRef = useRef(onDeleteItem);
  useEffect(() => {
    onDeleteItemRef.current = onDeleteItem;
  }, [onDeleteItem]);

  // Flush pending deletes on unmount
  useEffect(() => {
    return () => {
      pendingTimerMapRef.current.forEach((timer, id) => {
        clearTimeout(timer);
        onDeleteItemRef.current(id);
      });
      pendingTimerMapRef.current.clear();
    };
  }, []);

  // ── Prune / reset selection when panel collapses or displayed items change ──
  useEffect(() => {
    if (!isExpanded) {
      setSelectedIds(new Set());
      setOpenTagPickerItemId(null);
      setTagPopupPos(null);
      return;
    }
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const currentItemIds = new Set(items.map(i => i.id));
      const next = new Set<string>();
      prev.forEach(id => {
        if (currentItemIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [items, isExpanded]);

  const visibleItemIds = React.useMemo(() => items.map(i => i.id), [items]);
  const isAllSelected = visibleItemIds.length > 0 && visibleItemIds.every(id => selectedIds.has(id));
  const isSomeSelected = visibleItemIds.some(id => selectedIds.has(id));
  const isIndeterminate = isSomeSelected && !isAllSelected;

  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItemIds));
    }
  }, [isAllSelected, visibleItemIds]);

  const handleToggleSelectItem = useCallback((id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleStartDelete = useCallback((id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    const timer = setTimeout(() => {
      pendingTimerMapRef.current.delete(id);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onDeleteItemRef.current(id);
    }, 3000);
    pendingTimerMapRef.current.set(id, timer);
  }, []);

  const handleUndoDelete = useCallback((id: string) => {
    const timer = pendingTimerMapRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      pendingTimerMapRef.current.delete(id);
    }
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleToggleExpand = useCallback(() => {
    setOpenTagPickerItemId(null);
    setTagPopupPos(null);
    onExpandChange(!isExpanded);
  }, [isExpanded, onExpandChange]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenTagPickerItemId(null);
      setTagPopupPos(null);
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('resize', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('resize', handleOutsideClick);
    };
  }, []);

  const internalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = externalSearchInputRef ?? internalSearchInputRef;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveShortcut = useCallback(async (itemId: string) => {
    await onUpdateShortcut(itemId, editValue.trim());
    setEditingCell(null);
  }, [editValue, onUpdateShortcut]);

  const handleSaveTitle = useCallback(async (itemId: string) => {
    await onUpdateTitle(itemId, editValue.trim());
    setEditingCell(null);
  }, [editValue, onUpdateTitle]);

  // ── Bulk Actions ──────────────────────────────────────────────────────────
  const handleBulkFavorite = useCallback(async () => {
    if (isBusy || selectedIds.size === 0) return;
    setIsBusy(true);
    try {
      const targetItems = items.filter(i => selectedIds.has(i.id));
      const results = await Promise.allSettled(
        targetItems.map(async item => {
          const compoundId = getItemCompoundId(item);
          if (!isFavorite(compoundId)) {
            const itemType = getItemType(item);
            const itemTitle = getItemTitle(item);
            if (addFavorite) {
              await addFavorite(compoundId, itemType, itemTitle);
            } else {
              await toggleFavorite(compoundId, itemType, itemTitle);
            }
          }
          return item.id;
        })
      );

      const failedIds = new Set<string>();
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          failedIds.add(targetItems[idx].id);
          console.error(`Bulk favorite failed for item ${targetItems[idx].id}:`, res.reason);
        }
      });

      if (failedIds.size > 0) {
        setSelectedIds(failedIds);
      } else {
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Bulk favorite error:', err);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, selectedIds, items, getItemCompoundId, isFavorite, getItemType, getItemTitle, addFavorite, toggleFavorite]);

  const handleBulkDelete = useCallback(() => {
    if (isBusy || selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    idsToDelete.forEach(id => {
      if (!deletingIds.has(id)) {
        handleStartDelete(id);
      }
    });
    setSelectedIds(new Set());
  }, [isBusy, selectedIds, deletingIds, handleStartDelete]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isAltShiftF = e.altKey && e.shiftKey && (e.key === 'f' || e.key === 'F');
      if (isAltShiftF) {
        e.preventDefault();
        e.stopPropagation();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [searchRef]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative self-stretch hidden md:flex flex-col ${hideBorder ? 'rounded-none border-none shadow-none' : 'rounded-xl border border-[var(--color-borderDefault)]'} bg-[var(--color-editorBg)] overflow-visible transition-[width] duration-300 ease-in-out shrink-0 ${
        isExpanded ? 'w-[680px]' : 'w-[280px]'
      }`}
    >
      {isExpanded && (
        <button
          type="button"
          onClick={handleToggleExpand}
          aria-label="Collapse item list"
          title="Collapse item list"
          className="absolute right-0 top-1/2 z-50 flex h-9 w-9 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-iconDefault)] shadow-lg shadow-black/10 transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] dark:shadow-black/40"
        >
          <FiChevronRight size={18} />
        </button>
      )}
      <div className="w-full h-full flex flex-col pl-3.5 pt-2.5 pb-4 pr-2 overflow-hidden">

        {/* ── Header: Search + Bulk Actions + Close ── */}
        <div className="relative mb-3 flex-shrink-0 flex items-center justify-between gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]" size={13} />
            <input
              ref={searchRef}
              type="text"
              placeholder={searchPlaceholder || 'Search'}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-7 pr-[68px] py-1.5 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] text-xs outline-none focus:border-[var(--color-focusRing)] focus:ring-1 focus:ring-[var(--color-focusRing)] transition-colors placeholder-[var(--color-textPlaceholder)]"
            />
            {!searchQuery && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9.5px] font-medium text-[var(--color-textMuted)] opacity-60 whitespace-nowrap">
                Alt+Shift+F
              </span>
            )}
          </div>

          {/* Bulk Action Group */}
          {isExpanded && selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-xl px-2 py-1">
              <span className="text-[11px] font-semibold text-[var(--color-accent)] mr-0.5 whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <div className="grid grid-cols-3 gap-1">
                {/* 1. Favorite */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleBulkFavorite}
                  aria-label={`Favorite ${selectedIds.size} selected items`}
                  title={`Favorite (${selectedIds.size})`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-amber-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <FiStar size={12} />
                </button>
                {/* 2. Tag */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={e => {
                    e.stopPropagation();
                    if (openTagPickerItemId === '__BULK__') {
                      setOpenTagPickerItemId(null);
                      setTagPopupPos(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      let x = rect.left - 100;
                      if (x < 10) x = 10;
                      if (x + 240 > window.innerWidth - 10) x = window.innerWidth - 250;
                      let y = rect.bottom + 4;
                      if (y + 260 > window.innerHeight - 10) y = rect.top - 260;
                      setTagPopupPos({ x, y });
                      setOpenTagPickerItemId('__BULK__');
                      setNewTagName('');
                    }
                  }}
                  aria-label={`Tag ${selectedIds.size} selected items`}
                  title={`Tag (${selectedIds.size})`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <FaTag size={11} />
                </button>
                {/* 3. Delete */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleBulkDelete}
                  aria-label={`Delete ${selectedIds.size} selected items`}
                  title={`Delete (${selectedIds.size})`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textError)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          {onCloseClick && (
            <button
              type="button"
              onClick={onCloseClick}
              aria-label="Close editor"
              title="Close"
              className="-mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-borderActive)] cursor-pointer"
            >
              <FaTimes size={16} />
            </button>
          )}
        </div>

        {/* ── Content Body ── */}
        {isExpanded ? (
          /* EXPANDED MODE: 8-Column Table (Checkbox + 7 fields) */
          <div className="flex-1 min-h-0 relative flex flex-col rounded-xl overflow-hidden">
            {/* Sticky Table Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-borderDefault)] text-xs font-semibold text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] backdrop-blur-md shrink-0">
              {/* Checkbox Col */}
              <div className="w-[32px] shrink-0 flex items-center justify-center pr-1 border-r border-[var(--color-borderDefault)]">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all items"
                  className="h-3.5 w-3.5 rounded border-[var(--color-borderDefault)] text-[var(--color-accent)] focus:ring-[var(--color-focusRing)] cursor-pointer"
                />
              </div>
              <div className="w-[105px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight px-2 border-r border-[var(--color-borderDefault)]">Command short</div>
              <div className="w-[115px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight px-2 border-r border-[var(--color-borderDefault)]">Title</div>
              <div className="flex-1 min-w-[110px] px-2 font-bold text-[var(--color-textPrimary)] tracking-tight border-r border-[var(--color-borderDefault)] overflow-hidden truncate">Content</div>
              <div className="w-[80px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-left px-2 border-r border-[var(--color-borderDefault)]">Hotkey</div>
              <div className="w-[70px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-left px-2 border-r border-[var(--color-borderDefault)]">Tag</div>
              <div className="w-[50px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-center px-1">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar divide-y divide-[var(--color-borderDefault)]">
              {items.length === 0 ? (
                <div className="text-xs text-[var(--color-textSecondary)] text-center py-8">
                  {emptyStateMessage}
                </div>
              ) : (
                items.map(item => {
                  const compoundId = getItemCompoundId(item);
                  const itemType = getItemType(item);
                  const itemTitle = getItemTitle(item);
                  const itemPreview = getItemPreview(item);
                  const isCurrent = item.id === activeItemId;
                  const isDeleting = deletingIds.has(item.id);
                  const isSelected = selectedIds.has(item.id);

                  const sc = shortcutsMap[compoundId] || shortcutsMap[item.id] || '';
                  const hotkeyCombo = hotkeysMap[compoundId] || '';

                  const tagIds = getItemTagIds ? getItemTagIds(item) : ((item as any).tagIds || []);
                  const noteTags = tagIds.map((tid: string) => tagNamesMap?.[tid] || '').filter(Boolean);
                  const tagText = noteTags.join(', ');
                  const itemTags: string[] = noteTags.length > 0 ? noteTags : (tagText ? tagText.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

                  return (
                    <div
                      key={item.id}
                      className={`px-3 transition-colors flex items-stretch justify-between text-xs group ${
                        isCurrent
                          ? 'bg-[var(--color-selectedBg)] font-semibold text-[var(--color-textPrimary)]'
                          : isSelected
                          ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                          : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                      }`}
                    >
                      {/* Checkbox Col */}
                      <div
                        className="w-[32px] shrink-0 flex items-center justify-center pr-1 py-2 border-r border-[var(--color-borderDefault)] min-h-[32px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => handleToggleSelectItem(item.id, e)}
                          aria-label={`Select ${itemTitle || 'item'}`}
                          className="h-3.5 w-3.5 rounded border-[var(--color-borderDefault)] text-[var(--color-accent)] focus:ring-[var(--color-focusRing)] cursor-pointer"
                        />
                      </div>

                      {/* Col 1: Command shortcut badge */}
                      <div
                        className="w-[105px] shrink-0 flex items-center justify-between px-2 py-2 border-r border-[var(--color-borderDefault)] cursor-pointer min-h-[32px]"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'shortcut' });
                          setEditValue(sc || '');
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'shortcut' });
                          setEditValue(sc || '');
                        }}
                      >
                        {editingCell?.itemId === item.id && editingCell?.field === 'shortcut' ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                              setEditValue(val);
                            }}
                            onBlur={() => handleSaveShortcut(item.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveShortcut(item.id);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="px-1.5 py-0.5 w-[65px] rounded border border-blue-500 bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] text-[10px] outline-none shrink-0"
                          />
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            {sc ? (
                              <>
                                <span
                                  className="px-1.5 py-0.5 rounded-lg border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] text-[11px] font-medium block truncate max-w-[65px] text-center shrink-0 cursor-pointer"
                                  title={`${shortcutPrefix} ${sc} (Click to edit)`}
                                >
                                  {shortcutPrefix} {sc}
                                </span>
                                <svg width="16" height="10" viewBox="0 0 24 10" fill="none" className="text-[var(--color-iconDefault)] opacity-50 shrink-0">
                                  <path d="M0 5H22M22 5L18 1M22 5L18 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </>
                            ) : (
                              <span className="text-[var(--color-textSecondary)] opacity-0 group-hover:opacity-60 text-[10px] italic select-none">
                                + shortcut
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Col 2: Title with Opener on hover */}
                      <div
                        className="w-[140px] shrink-0 text-[var(--color-textPrimary)] px-2 py-2 border-r border-[var(--color-borderDefault)] flex items-center justify-between gap-1.5 cursor-pointer min-h-[32px] overflow-hidden group/title"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'title' });
                          setEditValue(itemTitle || '');
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'title' });
                          setEditValue(itemTitle || '');
                        }}
                      >
                        {editingCell?.itemId === item.id && editingCell?.field === 'title' ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => handleSaveTitle(item.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveTitle(item.id);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="px-1.5 py-0.5 w-full rounded border border-[var(--color-focusRing)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] text-xs font-semibold outline-none"
                          />
                        ) : (
                          <>
                            {getItemIcon && (
                              <div className="shrink-0 flex items-center justify-center mr-1 min-w-[36px]">
                                {getItemIcon(item)}
                              </div>
                            )}
                            <span title={itemTitle || 'Untitled (Double click to edit)'} className="truncate flex-1 text-[12px] font-medium opacity-85 text-[var(--color-textPrimary)]">
                              {itemTitle || <span className="text-[var(--color-textMuted)] opacity-60 italic text-xs">Untitled</span>}
                            </span>
                            {onOpenerClick && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onOpenerClick(item);
                                }}
                                className="text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 shrink-0"
                                title="Open item"
                              >
                                <FiExternalLink size={11} />
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Col 3: Content preview (Clicking here loads data into main editor) */}
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          onLoadItem(item.id);
                        }}
                        title="Click to load into editor"
                        className="flex-1 min-w-[110px] px-2 py-2 truncate text-[var(--color-textSecondary)] opacity-75 dark:opacity-75 text-[11.5px] border-r border-[var(--color-borderDefault)] flex items-center overflow-hidden cursor-pointer hover:opacity-100 hover:text-[var(--color-textPrimary)] transition-colors"
                      >
                        {itemPreview.trim() || '—'}
                      </div>

                      {/* Col 4: Hotkey slot */}
                      <div
                        className="w-[80px] shrink-0 flex items-center justify-start text-[10px] px-2 py-2 border-r border-[var(--color-borderDefault)] cursor-pointer min-h-[32px] overflow-hidden"
                        onClick={e => {
                          e.stopPropagation();
                          setRecordingHotkeyId(item.id);
                          setRecordingCombo(hotkeyCombo || 'Keys...');
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setRecordingHotkeyId(item.id);
                          setRecordingCombo(hotkeyCombo || 'Keys...');
                        }}
                      >
                        {recordingHotkeyId === item.id ? (
                          <input
                            autoFocus
                            type="text"
                            placeholder="Keys..."
                            value={recordingCombo}
                            readOnly
                            onClick={e => e.stopPropagation()}
                            onKeyDown={async e => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.key === 'Escape') {
                                setRecordingHotkeyId(null);
                                setRecordingCombo('');
                                return;
                              }
                              if (e.key === 'Backspace' || e.key === 'Delete') {
                                await deleteUserHotkeyByReference(compoundId);
                                setRecordingHotkeyId(null);
                                setRecordingCombo('');
                                return;
                              }
                              if (e.key === 'Enter') {
                                if (recordingCombo && recordingCombo !== 'Keys...') {
                                  await saveUserHotkey(recordingCombo, compoundId, itemType as any);
                                } else {
                                  await deleteUserHotkeyByReference(compoundId);
                                }
                                setRecordingHotkeyId(null);
                                setRecordingCombo('');
                                return;
                              }
                              const combo = buildHotkeyString(e.nativeEvent, isMac);
                              if (combo) setRecordingCombo(combo);
                            }}
                            onBlur={async () => {
                              if (recordingCombo && recordingCombo !== 'Keys...') {
                                await saveUserHotkey(recordingCombo, compoundId, itemType as any);
                              }
                              setRecordingHotkeyId(null);
                              setRecordingCombo('');
                            }}
                            className="px-1 py-0.5 w-[72px] rounded border border-[var(--color-focusRing)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] text-[9px] outline-none"
                          />
                        ) : hotkeyCombo ? (
                          <div
                            className="flex items-center gap-1 text-[var(--color-textSecondary)] shrink-0 select-none max-w-full truncate overflow-hidden"
                            title="Click to edit hotkey"
                          >
                            <FaKeyboard size={11} className="text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] shrink-0" />
                            <span className="font-mono text-[var(--color-textPrimary)] truncate overflow-hidden">{hotkeyCombo}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] transition-colors shrink-0"
                            title="Assign Hotkey"
                          >
                            <FaKeyboard size={11} />
                          </button>
                        )}
                      </div>

                      {/* Col 5: Tag slot */}
                      <div
                        className="w-[70px] shrink-0 flex items-center justify-start text-[10px] px-2 py-2 border-r border-[var(--color-borderDefault)] cursor-pointer min-h-[32px] overflow-hidden"
                        onClick={e => {
                          e.stopPropagation();
                          if (openTagPickerItemId === item.id) {
                            setOpenTagPickerItemId(null);
                            setTagPopupPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            let x = rect.left - 170;
                            if (x < 10) x = 10;
                            if (x + 240 > window.innerWidth - 10) x = window.innerWidth - 250;
                            let y = rect.bottom + 4;
                            if (y + 260 > window.innerHeight - 10) y = rect.top - 260;
                            setTagPopupPos({ x, y });
                            setOpenTagPickerItemId(item.id);
                            setNewTagName('');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1 text-[var(--color-textSecondary)] shrink-0 max-w-[65px] truncate" title={tagText || "Assign tag"}>
                          <FaTag size={10} className={itemTags.length > 0 ? "text-[var(--color-accent)] shrink-0" : "text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] shrink-0"} />
                          <span className="truncate text-[var(--color-textSecondary)]">
                            {tagText || <span className="text-[var(--color-textMuted)] opacity-60 italic text-[9px]">+ tag</span>}
                          </span>
                        </div>
                      </div>

                      {/* Col 6: Actions (Star + Delete ONLY / UNDO) */}
                      <div
                        className="w-[50px] shrink-0 flex items-center justify-center gap-2 px-1 py-2"
                        onClick={e => e.stopPropagation()}
                      >
                        {isDeleting ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleUndoDelete(item.id);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-all shrink-0 cursor-pointer"
                            title="Undo delete"
                          >
                            UNDO
                          </button>
                        ) : (
                          <>
                            {/* Favorite Star */}
                            <button
                              type="button"
                              onClick={async e => {
                                e.stopPropagation();
                                await toggleFavorite(compoundId, itemType, itemTitle);
                              }}
                              className="p-0.5 text-[var(--color-iconDefault)] hover:text-amber-400 transition-colors shrink-0"
                              title="Favorite"
                            >
                              {isFavorite(compoundId) ? (
                                <FaStar className="text-amber-400" size={11} />
                              ) : (
                                <FiStar size={11} />
                              )}
                            </button>

                            {/* Delete Trash */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleStartDelete(item.id);
                              }}
                              className="p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textError)] transition-colors shrink-0"
                              title="Delete"
                            >
                              <FaTrash size={10} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* COLLAPSED MODE: Clean Saved Items List */
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1 py-1">
            {items.length === 0 ? (
              <div className="text-xs text-[var(--color-textMuted)] text-center py-6">
                {emptyStateMessage}
              </div>
            ) : (
              items.map(item => {
                const isCurrent = item.id === activeItemId;
                const isDeleting = deletingIds.has(item.id);
                const itemTitle = getItemTitle(item);
                const itemPreview = getItemPreview(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isDeleting) onLoadItem(item.id);
                    }}
                    className={`group py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-2 relative ${
                      isDeleting
                        ? 'bg-red-900/20 border border-red-500/30'
                        : isCurrent
                        ? 'bg-[var(--color-selectedBg)]'
                        : 'hover:bg-[var(--color-hoverBg)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {getItemIcon && (
                        <div className="shrink-0 flex items-center justify-center mr-0.5">
                          {getItemIcon(item)}
                        </div>
                      )}
                      {/* Row 1: Title & Content preview inline */}
                      <span className={`text-xs font-medium text-[var(--color-textPrimary)] opacity-85 dark:opacity-85 truncate shrink-0 ${itemPreview.trim() ? 'max-w-[45%]' : 'w-full'}`}>
                        {itemTitle || 'Untitled'}
                      </span>
                      {itemPreview.trim() && (
                        <span className="text-[11.5px] text-[var(--color-textSecondary)] opacity-75 dark:opacity-75 truncate flex-1">
                          — {itemPreview}
                        </span>
                      )}
                    </div>

                    {/* Vertical 3-Dots Expand Button (visible on hover) */}
                    {!isDeleting && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleExpand();
                        }}
                        className="p-1 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                        title="Expand panel"
                      >
                        <FiMoreVertical size={14} />
                      </button>
                    )}

                    {isDeleting && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleUndoDelete(item.id);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-all shrink-0 cursor-pointer"
                        title="Undo delete"
                      >
                        UNDO
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Portal Tag Selector Dropdown Popover using shared TagSelector component */}
      {isExpanded && openTagPickerItemId && tagPopupPos && (() => {
        const isBulk = openTagPickerItemId === '__BULK__';

        const deduplicateTagNames = (tagsArr: string[]): string[] => {
          const seen = new Set<string>();
          const result: string[] = [];
          tagsArr.forEach(t => {
            const trimmed = String(t || '').trim();
            if (trimmed) {
              const lower = trimmed.toLowerCase();
              if (!seen.has(lower)) {
                seen.add(lower);
                result.push(trimmed);
              }
            }
          });
          return result;
        };

        const getTagsForItem = (item: T): string[] => {
          const tagIds = getItemTagIds ? getItemTagIds(item) : ((item as any).tagIds || []);
          const noteTags = tagIds.map((tid: string) => tagNamesMap?.[tid] || '').filter(Boolean);
          const tagText = noteTags.join(', ');
          const rawTags = noteTags.length > 0 ? noteTags : (tagText ? tagText.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
          return deduplicateTagNames(rawTags);
        };

        if (isBulk) {
          const targetItems = items.filter(i => selectedIds.has(i.id));
          if (targetItems.length === 0) return null;

          const allTargetTagNames = deduplicateTagNames(
            targetItems.flatMap(item => getTagsForItem(item))
          );

          const selectedTags: TagRecord[] = allTargetTagNames.map(name => {
            const found = dbTags.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
            return (
              found || {
                id: `temp_${name}`,
                name,
                workspaceId: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }
            );
          });

          const handleBulkTagSelect = async (tag: TagRecord) => {
            setIsBusy(true);
            try {
              const lowerName = tag.name.trim().toLowerCase();
              const isPresentOnAll = targetItems.every(item =>
                getTagsForItem(item).some(t => t.toLowerCase() === lowerName)
              );
              const shouldAdd = !isPresentOnAll;

              await Promise.allSettled(
                targetItems.map(async item => {
                  const itemTags = getTagsForItem(item);
                  let updated: string[];
                  if (shouldAdd) {
                    updated = deduplicateTagNames([...itemTags, tag.name]);
                  } else {
                    updated = itemTags.filter(t => t.toLowerCase() !== lowerName);
                  }
                  await onUpdateTags(item.id, updated.join(', '));
                })
              );
            } catch (e) {
              console.error('Failed bulk tag select:', e);
            } finally {
              setIsBusy(false);
            }
          };

          const handleBulkCreateTag = async (rawName: string) => {
            const trimmed = rawName.trim();
            if (!trimmed) return;
            setIsBusy(true);
            try {
              const lower = trimmed.toLowerCase();
              let existingTag = dbTags.find(t => t.name.trim().toLowerCase() === lower);

              // If tag doesn't exist in DB, create it ONCE in DB!
              if (!existingTag) {
                const firstWsId = (getItemWorkspaceId ? getItemWorkspaceId(targetItems[0]) : (targetItems[0] as any).workspaceId) || '';
                if (firstWsId) {
                  try {
                    existingTag = await createTag(trimmed, firstWsId);
                  } catch (e) {
                    console.error('Failed creating bulk tag in DB:', e);
                  }
                }
              }

              const tagToUse: TagRecord = existingTag || {
                id: `temp_${trimmed}`,
                name: trimmed,
                workspaceId: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              await handleBulkTagSelect(tagToUse);
            } catch (e) {
              console.error('Failed bulk create tag:', e);
            } finally {
              setIsBusy(false);
            }
          };

          const handleBulkTagDelete = async (tagId: string) => {
            try {
              const targetTag = dbTags.find(t => t.id === tagId);
              if (targetTag) {
                const sameNameTags = dbTags.filter(t => t.name.trim().toLowerCase() === targetTag.name.trim().toLowerCase());
                for (const t of sameNameTags) {
                  if (t.id && !t.id.startsWith('temp_')) {
                    await deleteTag(t.id);
                  }
                }
              } else {
                await deleteTag(tagId);
              }
            } catch (err) {
              console.error('Failed to delete tag:', err);
            }
          };

          return createPortal(
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: `${tagPopupPos.x}px`,
                top: `${tagPopupPos.y}px`,
                zIndex: 2147483647,
              }}
              className="w-[260px]"
            >
              <TagSelector
                selectedTags={selectedTags}
                dbTags={dbTags}
                onTagSelect={handleBulkTagSelect}
                onRemoveTag={tagId => {
                  const tag = selectedTags.find(t => t.id === tagId);
                  if (tag) handleBulkTagSelect(tag);
                }}
                onCreateTag={handleBulkCreateTag}
                onDeleteTag={handleBulkTagDelete}
                onClearTags={() => Promise.allSettled(targetItems.map(i => onUpdateTags(i.id, '')))}
                isOpen={true}
                onOpenChange={open => {
                  if (!open) {
                    setOpenTagPickerItemId(null);
                    setTagPopupPos(null);
                  }
                }}
              />
            </div>,
            document.body
          );
        }

        // Single item mode using shared TagSelector
        const activeItem = items.find(i => i.id === openTagPickerItemId);
        if (!activeItem) return null;

        const itemTagNames = getTagsForItem(activeItem);
        const selectedTags: TagRecord[] = itemTagNames.map(name => {
          const found = dbTags.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
          return (
            found || {
              id: `temp_${name}`,
              name,
              workspaceId: (getItemWorkspaceId ? getItemWorkspaceId(activeItem) : (activeItem as any).workspaceId) || '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          );
        });

        const handleSingleTagSelect = async (tag: TagRecord) => {
          const lowerName = tag.name.trim().toLowerCase();
          const exists = itemTagNames.some(t => t.toLowerCase() === lowerName);
          let updatedTagNames: string[];
          if (exists) {
            updatedTagNames = itemTagNames.filter(t => t.toLowerCase() !== lowerName);
          } else {
            updatedTagNames = deduplicateTagNames([...itemTagNames, tag.name]);
          }
          await onUpdateTags(activeItem.id, updatedTagNames.join(', '));
        };

        const handleSingleCreateTag = async (rawName: string) => {
          const trimmed = rawName.trim();
          if (!trimmed) return;
          const lower = trimmed.toLowerCase();
          let existingTag = dbTags.find(t => t.name.trim().toLowerCase() === lower);
          if (!existingTag) {
            const wsId = (getItemWorkspaceId ? getItemWorkspaceId(activeItem) : (activeItem as any).workspaceId) || '';
            if (wsId) {
              try {
                existingTag = await createTag(trimmed, wsId);
              } catch (e) {
                console.error('Failed to create tag in DB:', e);
              }
            }
          }
          const tagToUse: TagRecord = existingTag || {
            id: `temp_${trimmed}`,
            name: trimmed,
            workspaceId: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await handleSingleTagSelect(tagToUse);
        };

        const handleSingleTagDelete = async (tagId: string) => {
          try {
            const targetTag = dbTags.find(t => t.id === tagId);
            if (targetTag) {
              const sameNameTags = dbTags.filter(t => t.name.trim().toLowerCase() === targetTag.name.trim().toLowerCase());
              for (const t of sameNameTags) {
                if (t.id && !t.id.startsWith('temp_')) {
                  await deleteTag(t.id);
                }
              }
            } else {
              await deleteTag(tagId);
            }
          } catch (err) {
            console.error('Failed to delete tag:', err);
          }
        };

        return createPortal(
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${tagPopupPos.x}px`,
              top: `${tagPopupPos.y}px`,
              zIndex: 2147483647,
            }}
            className="w-[260px]"
          >
            <TagSelector
              selectedTags={selectedTags}
              dbTags={dbTags}
              onTagSelect={handleSingleTagSelect}
              onRemoveTag={tagId => {
                const tag = selectedTags.find(t => t.id === tagId);
                if (tag) handleSingleTagSelect(tag);
              }}
              onCreateTag={handleSingleCreateTag}
              onDeleteTag={handleSingleTagDelete}
              onClearTags={() => onUpdateTags(activeItem.id, '')}
              isOpen={true}
              onOpenChange={open => {
                if (!open) {
                  setOpenTagPickerItemId(null);
                  setTagPopupPos(null);
                }
              }}
            />
          </div>,
          document.body
        );
      })()}
    </div>
  );
}


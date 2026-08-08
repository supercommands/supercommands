import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronLeft, FiChevronRight, FiExternalLink, FiSearch, FiStar, FiZapOff } from 'react-icons/fi';
import { FaStar, FaFolder, FaKeyboard, FaTag, FaTrash, FaTimes } from 'react-icons/fa';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import { buildHotkeyString } from '../hotkeys/core/eventParser';
import { useDbStore } from '../../storage/store/useDbStore';
import { createTag } from '../../allObjectFolder/src/createObject/tags/tagData';

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

  // ── Expansion state (owned by parent) ─────────────────────────────────────
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;

  emptyStateMessage?: string;

  /** Optional ref forwarded to the search input so the parent can focus it. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  getItemFolderId,
  getItemTagIds,
  shortcutPrefix = 'c',
  showFolderColumn = true,
  shortcutsMap,
  hotkeysMap,
  workspaceNamesMap,
  folderNamesMap,
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
  isExpanded,
  onExpandChange,
  emptyStateMessage = 'No items found.',
  searchInputRef: externalSearchInputRef,
}: RightSideItemsPanelProps<T>) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // ── Inline editing state ──────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'title' | 'shortcut' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [recordingHotkeyId, setRecordingHotkeyId] = useState<string | null>(null);
  const [recordingCombo, setRecordingCombo] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState('');

  // ── Tag Dropdown Popover State ───────────────────────────────────────────
  const [openTagPickerItemId, setOpenTagPickerItemId] = useState<string | null>(null);
  const [tagPopupPos, setTagPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const dbTags = useDbStore(state => state.tags);

  const handleToggleExpand = useCallback(() => {
    setOpenTagPickerItemId(null);
    setTagPopupPos(null);
    onExpandChange(!isExpanded);
  }, [isExpanded, onExpandChange]);

  useEffect(() => {
    if (!isExpanded) {
      setOpenTagPickerItemId(null);
      setTagPopupPos(null);
    }
  }, [isExpanded]);

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

  const handleSaveTags = useCallback(async (itemId: string) => {
    await onUpdateTags(itemId, tagEditValue);
    setEditingTagId(null);
  }, [tagEditValue, onUpdateTags]);

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
      className={`relative self-stretch hidden md:flex flex-col border-l border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] overflow-visible transition-[width] duration-300 ease-in-out shrink-0 ${
        isExpanded ? 'w-[680px]' : 'w-[280px]'
      }`}
    >
      <button
        type="button"
        onClick={handleToggleExpand}
        aria-label={isExpanded ? 'Collapse item list' : 'Expand item list'}
        title={isExpanded ? 'Collapse item list' : 'Expand item list'}
        className="absolute right-0 top-1/2 z-50 flex h-9 w-9 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-iconDefault)] shadow-lg shadow-black/10 transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] dark:shadow-black/40"
      >
        {isExpanded ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
      </button>
      <div className="w-full h-full flex flex-col pl-3.5 pt-2.5 pb-4 pr-2 overflow-hidden">

        {/* ── Header: Search + Close ── */}
        <div className="relative mb-3 flex-shrink-0 flex items-start gap-1.5 w-full">
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
          /* EXPANDED MODE: 7-Column Table */
          <div className="flex-1 min-h-0 relative flex flex-col rounded-xl overflow-hidden">
            {/* Sticky Table Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-borderDefault)] text-xs font-semibold text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] backdrop-blur-md shrink-0">
              <div className="w-[110px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight pr-2 border-r border-[var(--color-borderDefault)]">Command short</div>
              <div className="w-[120px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight px-2 border-r border-[var(--color-borderDefault)]">Title</div>
              <div className="flex-1 min-w-[120px] px-2 font-bold text-[var(--color-textPrimary)] tracking-tight border-r border-[var(--color-borderDefault)] overflow-hidden truncate">Content</div>
              <div className="w-[80px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-left px-2 border-r border-[var(--color-borderDefault)]">Hotkey</div>
              <div className="w-[70px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-left px-2 border-r border-[var(--color-borderDefault)]">Tag</div>
              {showFolderColumn && <div className="w-[70px] shrink-0 font-bold text-[var(--color-textPrimary)] tracking-tight text-left px-2 border-r border-[var(--color-borderDefault)]">Folder</div>}
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

                  const sc = shortcutsMap[compoundId] || shortcutsMap[item.id] || '';
                  const hotkeyCombo = hotkeysMap[compoundId] || '';

                  const wsId = getItemWorkspaceId ? getItemWorkspaceId(item) : (item as any).workspaceId;
                  const fldId = getItemFolderId ? getItemFolderId(item) : (item as any).folderId;
                  const wsName = wsId ? (workspaceNamesMap?.[wsId] || '') : '';
                  const folderName = fldId ? (folderNamesMap?.[fldId] || '') : '';
                  const folderDisplayName = folderName || wsName;

                  const tagIds = getItemTagIds ? getItemTagIds(item) : ((item as any).tagIds || []);
                  const noteTags = tagIds.map((tid: string) => tagNamesMap?.[tid] || '').filter(Boolean);
                  const tagText = noteTags.join(', ');
                  const itemTags: string[] = noteTags.length > 0 ? noteTags : (tagText ? tagText.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

                  return (
                    <div
                      key={item.id}
                      className={`px-4 transition-colors flex items-stretch justify-between text-xs group ${
                        isCurrent
                          ? 'bg-[var(--color-selectedBg)] font-semibold text-[var(--color-textPrimary)]'
                          : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                      }`}
                    >
                      {/* Col 1: Command shortcut badge */}
                      <div
                        className="w-[110px] shrink-0 flex items-center justify-between pr-2 py-2 border-r border-[var(--color-borderDefault)] cursor-pointer min-h-[32px]"
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
                              const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                              setEditValue(val);
                            }}
                            onBlur={() => handleSaveShortcut(item.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveShortcut(item.id);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="px-1.5 py-0.5 w-[70px] rounded border border-blue-500 bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] text-[10px] outline-none shrink-0"
                          />
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            {sc ? (
                              <>
                                <span
                                  className="px-2 py-0.5 rounded-lg border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] text-xs font-medium block truncate max-w-[70px] text-center shrink-0 cursor-pointer"
                                  title={`${shortcutPrefix} ${sc} (Click to edit)`}
                                >
                                  {shortcutPrefix} {sc}
                                </span>
                                <svg width="18" height="10" viewBox="0 0 24 10" fill="none" className="text-[var(--color-iconDefault)] opacity-50 shrink-0">
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
                        className="w-[120px] shrink-0 font-medium text-[var(--color-textPrimary)] px-2 py-2 border-r border-[var(--color-borderDefault)] flex items-center justify-between gap-1 cursor-pointer min-h-[32px] overflow-hidden group/title"
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
                            <span title={itemTitle || 'Untitled (Double click to edit)'} className="truncate flex-1">
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
                        className="flex-1 min-w-[120px] px-2 py-2 truncate text-[var(--color-textSecondary)] text-xs border-r border-[var(--color-borderDefault)] flex items-center overflow-hidden cursor-pointer hover:text-[var(--color-textPrimary)] transition-colors"
                      >
                        {itemPreview.trim() || '—'}
                      </div>

                      {/* Col 4: Hotkey slot (overflow-hidden prevents text overlap) */}
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

                      {/* Col 6: Folder slot */}
                      {showFolderColumn && (
                        <div
                          className="w-[70px] shrink-0 flex items-center justify-start text-[10px] px-2 py-2 border-r border-[var(--color-borderDefault)] overflow-hidden"
                          onClick={e => e.stopPropagation()}
                        >
                          {folderDisplayName ? (
                            <div
                              className="flex items-center gap-1 text-[var(--color-textSecondary)] shrink-0 max-w-full truncate"
                              title={folderDisplayName}
                            >
                              <FaFolder size={10} className="text-[var(--color-iconDefault)] shrink-0" />
                              <span className="truncate text-[var(--color-textSecondary)]">{folderDisplayName}</span>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Col 7: Actions (Star + Delete ONLY) */}
                      <div
                        className="w-[50px] shrink-0 flex items-center justify-center gap-2 px-1 py-2"
                        onClick={e => e.stopPropagation()}
                      >
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
                            onDeleteItem(item.id);
                          }}
                          className="p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textError)] transition-colors shrink-0"
                          title="Delete"
                        >
                          <FaTrash size={10} />
                        </button>
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
                const itemTitle = getItemTitle(item);
                const itemPreview = getItemPreview(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => onLoadItem(item.id)}
                    className={`py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer flex flex-col gap-0.5 relative ${
                      isCurrent
                        ? 'bg-[var(--color-selectedBg)]'
                        : 'hover:bg-[var(--color-hoverBg)]'
                    }`}
                  >
                    {/* Row 1: Title */}
                    <div className="text-xs font-semibold text-[var(--color-textPrimary)] truncate">
                      {itemTitle || 'Untitled'}
                    </div>
                    {/* Row 2: Content preview */}
                    {itemPreview.trim() && (
                      <div className="text-[11px] text-[var(--color-textSecondary)] truncate">
                        {itemPreview}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Portal Tag Selector Dropdown Popover */}
      {isExpanded && openTagPickerItemId && tagPopupPos && (() => {
        const activeItem = items.find(i => i.id === openTagPickerItemId);
        if (!activeItem) return null;
        const tagIds = getItemTagIds ? getItemTagIds(activeItem) : ((activeItem as any).tagIds || []);
        const noteTags = tagIds.map((tid: string) => tagNamesMap?.[tid] || '').filter(Boolean);
        const tagText = noteTags.join(', ');
        const itemTags: string[] = noteTags.length > 0 ? noteTags : (tagText ? tagText.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        const selectedTags = itemTags.map(name => {
          const found = dbTags.find(t => t.name.toLowerCase() === name.toLowerCase());
          return { id: found?.id || `temp_${name}`, name };
        });
        const targetWsId = getItemWorkspaceId ? getItemWorkspaceId(activeItem) : (activeItem as any).workspaceId;

        const handleTagToggle = async (tagObj: { id: string; name: string }) => {
          const isSelected = selectedTags.some(t => t.name.toLowerCase() === tagObj.name.toLowerCase() || t.id === tagObj.id);
          let newTags: string[];
          if (isSelected) {
            newTags = selectedTags.filter(t => t.name.toLowerCase() !== tagObj.name.toLowerCase() && t.id !== tagObj.id).map(t => t.name);
          } else {
            newTags = [...selectedTags.map(t => t.name), tagObj.name];
          }
          await onUpdateTags(activeItem.id, newTags.join(', '));
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
            className="w-[240px] bg-[var(--color-contextMenuBg,#171821)] backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Integrated Inline Search Row */}
            <div className="border-b border-black/10 dark:border-white/10 flex items-center">
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (!newTagName.trim()) return;
                  const trimmed = newTagName.trim();
                  const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                  if (existing) {
                    await handleTagToggle({ id: existing.id, name: existing.name });
                  } else {
                    if (targetWsId) {
                      const newTagRecord = await createTag(trimmed, targetWsId);
                      await handleTagToggle({ id: newTagRecord.id, name: newTagRecord.name });
                    } else {
                      await handleTagToggle({ id: `temp_${trimmed}`, name: trimmed });
                    }
                  }
                  setNewTagName('');
                }}
                className="flex-1 flex"
              >
                <input
                  autoFocus
                  type="text"
                  placeholder="Type to search or create..."
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-xs outline-none text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)]"
                />
              </form>
            </div>

            {/* Selected Tags list */}
            {selectedTags.length > 0 && (
              <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
                {selectedTags.map(st => (
                  <span
                    key={st.id}
                    className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-500/20"
                  >
                    {st.name}
                    <button
                      type="button"
                      onClick={() => handleTagToggle(st)}
                      className="hover:text-blue-800 dark:hover:text-blue-200 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <FiZapOff size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag List Area */}
            <div className="p-2 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar">
              {/* Clear Tags item */}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={async e => {
                    e.stopPropagation();
                    await onUpdateTags(activeItem.id, '');
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-xs text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors mb-1"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500" />
                  <span className="font-medium flex-1">Clear Tags</span>
                  <FiZapOff size={10} className="opacity-75" />
                </button>
              )}

              {/* Create Tag Option */}
              {newTagName.trim() && (
                <button
                  type="button"
                  onClick={async e => {
                    e.stopPropagation();
                    const trimmed = newTagName.trim();
                    const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                    if (existing) {
                      await handleTagToggle({ id: existing.id, name: existing.name });
                    } else {
                      if (targetWsId) {
                        const newTagRecord = await createTag(trimmed, targetWsId);
                        await handleTagToggle({ id: newTagRecord.id, name: newTagRecord.name });
                      } else {
                        await handleTagToggle({ id: `temp_${trimmed}`, name: trimmed });
                      }
                    }
                    setNewTagName('');
                  }}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs text-neutral-600 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors border border-dashed border-neutral-300 dark:border-white/10 mb-1"
                >
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    <span>Create "{newTagName.trim()}"</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-400 font-mono scale-90">
                    Enter
                  </span>
                </button>
              )}

              {/* Existing DB Tags */}
              {dbTags
                .filter(t => t.name.toLowerCase().includes(newTagName.toLowerCase()))
                .map((tag, idx) => {
                  const isSelected = selectedTags.some(st => st.name.toLowerCase() === tag.name.toLowerCase() || st.id === tag.id);
                  const dotColor = getTagColor(tag.name);

                  return (
                    <button
                      key={tag.id || idx}
                      type="button"
                      onClick={() => handleTagToggle({ id: tag.id, name: tag.name })}
                      className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-blue-500 font-bold text-xs shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

/**
 * @file AltSlashPopup.tsx
 * @description Fixed 550px Alt+/ Command Palette with zero shrinking or position shifting.
 * Sub-popovers (NewDueDateDropdown for Todo, DestinationPicker for Folder, Tag Selector for Tags)
 * open INSTANTLY (0 transitions, 0 animations, 0 slide/fade) outside to the right of the active row.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { useAppearance } from '@extension/ui';
import { FaStar, FaFolder } from 'react-icons/fa';
import { FiStar, FiZap, FiTag, FiTerminal, FiZapOff, FiChevronRight, FiX, FiCheck } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useUIStore } from '../uiStateManager';
import { DestinationPicker } from './DestinationPicker';
import { VisualKeyDisplay } from '../hotkeys/ui/VisualKeyDisplay';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';

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
  return colors[sum % colors.length];
};

export interface AltSlashPopupProps {
  isOpen: boolean;
  onClose: () => void;

  // Favorite
  isFav?: boolean;
  onToggleFav?: () => void;

  // Hotkey
  pendingHotkey?: string;
  onHotkeyChange?: (hotkey: string) => void;

  // Shortcut / Text Command
  pendingShortcut?: string;
  onShortcutChange?: (shortcut: string) => void;

  // Todo
  reminderDate?: string;
  reminderTime?: string;
  isRecurring?: boolean;
  recurringCycle?: string | null;
  onTodoScheduleChange?: (data: { date: string; time: string; isRecurring: boolean; cycle: string | null }) => void;

  // Destination / Folder
  workspaceId?: string | null;
  folderId?: string | null;
  onDestinationChange?: (workspaceId: string | null, folderId: string | null) => void;
  folderNamesMap?: Record<string, string>;
  workspaceNamesMap?: Record<string, string>;

  // Tags
  selectedTags?: TagRecord[];
  dbTags?: TagRecord[];
  onTagSelect?: (tag: any) => void;
  onCreateTag?: (name: string) => Promise<any>;

  // Visibility Flags
  showTodo?: boolean;
  showShortcut?: boolean;
  showLocationPicker?: boolean;
  showTags?: boolean;
}

export const AltSlashPopup: React.FC<AltSlashPopupProps> = ({
  isOpen,
  onClose,
  isFav = false,
  onToggleFav,
  pendingHotkey = '',
  onHotkeyChange,
  pendingShortcut = '',
  onShortcutChange,
  reminderDate = '',
  reminderTime = '',
  isRecurring = false,
  recurringCycle = null,
  onTodoScheduleChange,
  workspaceId = null,
  folderId = null,
  onDestinationChange,
  folderNamesMap,
  workspaceNamesMap,
  selectedTags = [],
  dbTags = [],
  onTagSelect,
  onCreateTag,
  showTodo = true,
  showShortcut = true,
  showLocationPicker = true,
  showTags = true,
}) => {
  let isDark = true;
  try {
    const appearance = useAppearance();
    if (appearance?.theme) {
      isDark = appearance.theme.isDark;
    }
  } catch {
    if (typeof document !== 'undefined') {
      isDark = document.documentElement.classList.contains('dark');
    }
  }

  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubPopover, setActiveSubPopover] = useState<'todo' | 'folder' | 'tags' | null>(null);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState<boolean>(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const menuCardRef = useRef<HTMLDivElement>(null);
  const floatingLayerRef = useRef<HTMLDivElement>(null);

  // Local state for editing values
  const [localHotkey, setLocalHotkey] = useState(pendingHotkey);
  const [localShortcut, setLocalShortcut] = useState(pendingShortcut);
  const [localDate, setLocalDate] = useState(reminderDate);
  const [localTime, setLocalTime] = useState(reminderTime);
  const [localRecurring, setLocalRecurring] = useState(isRecurring);
  const [localCycle, setLocalCycle] = useState<string | null>(recurringCycle);
  const [newTagName, setNewTagName] = useState('');
  const [subPopoverTopOffset, setSubPopoverTopOffset] = useState<number>(0);

  useEffect(() => {
    setLocalHotkey(pendingHotkey);
  }, [pendingHotkey]);

  useEffect(() => {
    setLocalShortcut(pendingShortcut);
  }, [pendingShortcut]);

  useEffect(() => {
    setLocalDate(reminderDate);
    setLocalTime(reminderTime);
    setLocalRecurring(isRecurring);
    setLocalCycle(recurringCycle);
  }, [reminderDate, reminderTime, isRecurring, recurringCycle]);

  // Instant calculation of row alignment offset (0 lag, 0 animation)
  useEffect(() => {
    if (!activeSubPopover) {
      setSubPopoverTopOffset(0);
      return;
    }
    const rowEl = document.getElementById(`alt-slash-item-${activeSubPopover}`);
    const parentCardEl = menuCardRef.current;
    if (rowEl && parentCardEl) {
      const rowRect = rowEl.getBoundingClientRect();
      const parentRect = parentCardEl.getBoundingClientRect();
      const offset = Math.max(0, Math.round(rowRect.top - parentRect.top));
      setSubPopoverTopOffset(offset);
    }
  }, [activeSubPopover, searchQuery, selectedMenuIndex]);

  // Outside click dismissal for sub-popover
  useEffect(() => {
    if (!activeSubPopover) return;

    const handleClickOutsideFloating = (e: MouseEvent) => {
      if (floatingLayerRef.current && !floatingLayerRef.current.contains(e.target as Node)) {
        setActiveSubPopover(null);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutsideFloating);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutsideFloating);
    };
  }, [activeSubPopover]);

  // Derived location name label
  const locationLabel = useMemo(() => {
    if (folderId && folderNamesMap?.[folderId]) {
      return folderNamesMap[folderId];
    }
    if (workspaceId && workspaceNamesMap?.[workspaceId]) {
      return workspaceNamesMap[workspaceId];
    }
    return 'Select Location';
  }, [folderId, workspaceId, folderNamesMap, workspaceNamesMap]);

  // Derived schedule label for Todo
  const scheduleLabel = useMemo(() => {
    if (!localDate && !localTime) return 'No Schedule';
    let str = '';
    if (localDate) {
      try {
        const parts = localDate.split('-').map(Number);
        if (parts.length === 3) {
          const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          str = format(dateObj, 'do MMM yyyy');
        } else {
          str = localDate;
        }
      } catch {
        str = localDate;
      }
    }
    if (localTime) {
      const [hhStr, mmStr] = localTime.split(':');
      const hh = Number(hhStr);
      const mm = Number(mmStr || 0);
      if (!isNaN(hh) && !isNaN(mm)) {
        const hr12 = hh % 12 || 12;
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const minStr = String(mm).padStart(2, '0');
        str += ` · ${hr12}:${minStr} ${ampm}`;
      } else {
        str += ` · ${localTime}`;
      }
    } else {
      str += ' · Any time';
    }
    if (localRecurring) str += ' (Recurring)';
    return str || 'Scheduled';
  }, [localDate, localTime, localRecurring]);

  const toolsList = useMemo(() => {
    const items: Array<any> = [];

    if (onToggleFav) {
      items.push({
        id: 'favorite',
        label: 'Favorite',
        icon: isFav ? (
          <FaStar size={15} className="text-amber-400 shrink-0" />
        ) : (
          <FiStar size={15} className="shrink-0 text-neutral-400" />
        ),
        badge: (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleFav();
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border border-transparent hover:border-amber-400/30"
          >
            {isFav ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <FaStar size={13} /> Favorited
              </span>
            ) : (
              <span className="text-neutral-400 flex items-center gap-1 hover:text-white">
                <FiStar size={13} /> Favorite
              </span>
            )}
          </button>
        ),
        action: () => {
          onToggleFav();
        },
      });
    }

    if (onHotkeyChange) {
      items.push({
        id: 'hotkey',
        label: 'Assign Hotkey',
        icon: <FiZap size={15} className="shrink-0 text-neutral-400" />,
        badge: localHotkey ? (
          <div className="flex items-center gap-1.5">
            <VisualKeyDisplay hotkey={localHotkey} size="sm" />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setLocalHotkey('');
                onHotkeyChange?.('');
                setIsRecordingHotkey(false);
              }}
              className="text-neutral-400 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10"
              title="Clear hotkey"
            >
              <FiX size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsRecordingHotkey(true);
            }}
            className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded border ${
              isRecordingHotkey
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-black/10 dark:bg-white/5 text-neutral-400 hover:text-white border-black/10 dark:border-white/10'
            }`}
          >
            <FiZap size={11} /> {isRecordingHotkey ? 'Press keys...' : 'Record Key'}
          </button>
        ),
        action: () => {
          setIsRecordingHotkey(prev => !prev);
        },
      });
    }

    if (showShortcut && onShortcutChange) {
      items.push({
        id: 'shortcut',
        label: 'Text Command',
        icon: <FiTerminal size={15} className="shrink-0 text-neutral-400" />,
        badge: isEditingShortcut ? (
          <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/10" onClick={e => e.stopPropagation()}>
            <input
              ref={shortcutInputRef}
              type="text"
              placeholder=";shortcut"
              value={localShortcut}
              onChange={e => setLocalShortcut(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onShortcutChange?.(localShortcut);
                  setIsEditingShortcut(false);
                } else if (e.key === 'Escape') {
                  setIsEditingShortcut(false);
                }
              }}
              className="w-20 bg-transparent text-xs font-mono font-semibold text-blue-400 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                onShortcutChange?.(localShortcut);
                setIsEditingShortcut(false);
              }}
              className="text-emerald-400 hover:text-emerald-300 p-0.5"
            >
              <FiCheck size={12} />
            </button>
          </div>
        ) : localShortcut ? (
          <div className="flex items-center gap-1.5">
            <span
              onClick={e => {
                e.stopPropagation();
                setIsEditingShortcut(true);
                setTimeout(() => shortcutInputRef.current?.focus(), 50);
              }}
              className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 cursor-pointer"
            >
              {localShortcut.startsWith(';') ? localShortcut : `;${localShortcut}`}
            </span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setLocalShortcut('');
                onShortcutChange?.('');
                setIsEditingShortcut(false);
              }}
              className="text-neutral-400 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10"
              title="Clear shortcut"
            >
              <FiX size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsEditingShortcut(true);
              setTimeout(() => shortcutInputRef.current?.focus(), 50);
            }}
            className="text-[11px] font-medium text-neutral-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10"
          >
            <FiTerminal size={11} /> Add Command
          </button>
        ),
        action: () => {
          setIsEditingShortcut(prev => !prev);
          if (!isEditingShortcut) {
            setTimeout(() => shortcutInputRef.current?.focus(), 50);
          }
        },
      });
    }

    if (showTodo && onTodoScheduleChange) {
      items.push({
        id: 'todo',
        label: 'Create Todo',
        icon: <BsCalendarCheck size={15} className="shrink-0 text-neutral-400" />,
        badge: (
          <div className="flex items-center gap-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${localDate || localTime ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-black/10 dark:bg-white/5 text-neutral-400 border border-black/10 dark:border-white/10'}`}>
              {scheduleLabel}
            </span>
            <FiChevronRight size={13} className="text-neutral-400" />
          </div>
        ),
        action: () => {
          setActiveSubPopover(prev => (prev === 'todo' ? null : 'todo'));
        },
      });
    }

    if (showLocationPicker && onDestinationChange) {
      items.push({
        id: 'folder',
        label: 'Folder',
        icon: <FaFolder size={14} className="shrink-0 text-neutral-400" />,
        badge: (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-neutral-400 max-w-[120px] truncate px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10">
              {locationLabel}
            </span>
            <FiChevronRight size={13} className="text-neutral-400" />
          </div>
        ),
        action: () => {
          setActiveSubPopover(prev => (prev === 'folder' ? null : 'folder'));
        },
      });
    }

    if (showTags && (onTagSelect || onCreateTag)) {
      items.push({
        id: 'tags',
        label: 'Tags',
        icon: <FiTag size={15} className="shrink-0 text-neutral-400" />,
        badge: (
          <div className="flex items-center gap-1">
            {selectedTags.length > 0 ? (
              <div className="flex items-center gap-1 max-w-[130px] overflow-hidden">
                {selectedTags.slice(0, 2).map(st => (
                  <span key={st.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate">
                    {st.name}
                  </span>
                ))}
                {selectedTags.length > 2 && (
                  <span className="text-[10px] text-neutral-400 font-bold">+{selectedTags.length - 2}</span>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-medium text-neutral-400 px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10">
                Select Tags
              </span>
            )}
            <FiChevronRight size={13} className="text-neutral-400" />
          </div>
        ),
        action: () => {
          setActiveSubPopover(prev => (prev === 'tags' ? null : 'tags'));
          if (activeSubPopover !== 'tags') {
            setTimeout(() => tagSearchInputRef.current?.focus(), 50);
          }
        },
      });
    }

    return items;
  }, [
    isFav,
    onToggleFav,
    localHotkey,
    isRecordingHotkey,
    onHotkeyChange,
    showShortcut,
    isEditingShortcut,
    localShortcut,
    onShortcutChange,
    showTodo,
    scheduleLabel,
    localDate,
    localTime,
    onTodoScheduleChange,
    showLocationPicker,
    locationLabel,
    onDestinationChange,
    showTags,
    selectedTags,
    onTagSelect,
    onCreateTag,
    activeSubPopover,
  ]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return toolsList;
    const query = searchQuery.toLowerCase().trim();
    return toolsList.filter(item => item.label.toLowerCase().includes(query));
  }, [toolsList, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMenuIndex(0);
      setSearchQuery('');
      setActiveSubPopover(null);
      setIsRecordingHotkey(false);
      setIsEditingShortcut(false);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      searchInputRef.current?.focus();

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 10);
    }
  }, [isOpen]);

  const [tagActiveIndex, setTagActiveIndex] = useState(0);

  useEffect(() => {
    if (activeSubPopover === 'tags') {
      setTagActiveIndex(0);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      tagSearchInputRef.current?.focus();
      setTimeout(() => {
        tagSearchInputRef.current?.focus();
      }, 20);
    }
  }, [activeSubPopover]);

  // Strict Keyboard Event Isolation (Capture Phase Listener)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Isolate background execution completely for all menu keys
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'PageUp', 'PageDown'].includes(e.key)) {
        if (e.key !== 'Enter' || activeSubPopover === null) {
          e.preventDefault();
        }
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
      }

      // 2. Hotkey recording mode
      if (isRecordingHotkey) {
        if (e.key === 'Escape') {
          setIsRecordingHotkey(false);
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          setLocalHotkey('');
          onHotkeyChange?.('');
          setIsRecordingHotkey(false);
          return;
        }
        const modifiers: string[] = [];
        if (e.altKey) modifiers.push('Alt');
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Meta');

        const key = e.key.toUpperCase();
        if (['ALT', 'CONTROL', 'SHIFT', 'META'].includes(key)) return;

        const formatted = [...modifiers, key].join('+');
        setLocalHotkey(formatted);
        onHotkeyChange?.(formatted);
        setIsRecordingHotkey(false);
        return;
      }

      // 3. Escape key handling — 1st Esc closes active floating sub-popover layer ONLY
      if (e.key === 'Escape') {
        if (isEditingShortcut) {
          setIsEditingShortcut(false);
          return;
        }
        if (activeSubPopover !== null) {
          setActiveSubPopover(null);
          setTimeout(() => searchInputRef.current?.focus(), 10);
          return;
        }
        onClose();
        return;
      }

      // 4. Tag sub-popover Navigation & Enter handling
      if (activeSubPopover === 'tags') {
        const trimmed = newTagName.trim();
        const tagList = dbTags;
        const totalItems = (trimmed ? 1 : 0) + tagList.length;

        if (e.key === 'ArrowDown') {
          setTagActiveIndex(prev => (totalItems > 0 ? (prev + 1) % totalItems : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          setTagActiveIndex(prev => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
          return;
        }
        if (e.key === 'Enter') {
          if (trimmed && tagActiveIndex === 0) {
            const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
            if (existing) {
              onTagSelect?.({ id: existing.id, name: existing.name });
            } else if (onCreateTag) {
              void onCreateTag(trimmed);
            }
            setNewTagName('');
          } else {
            const actualIndex = trimmed ? tagActiveIndex - 1 : tagActiveIndex;
            if (actualIndex >= 0 && actualIndex < tagList.length) {
              const selectedTag = tagList[actualIndex];
              onTagSelect?.({ id: selectedTag.id, name: selectedTag.name });
            } else if (trimmed) {
              const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
              if (existing) {
                onTagSelect?.({ id: existing.id, name: existing.name });
              } else if (onCreateTag) {
                void onCreateTag(trimmed);
              }
              setNewTagName('');
            }
          }
          return;
        }
      }

      // 5. If floating sub-popover or text input is active, allow text input inside sub-popover
      if (isEditingShortcut || (activeSubPopover !== null && e.target !== searchInputRef.current)) {
        return;
      }

      // 6. Menu Navigation
      if (e.key === 'ArrowDown') {
        setSelectedMenuIndex(prev => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        setSelectedMenuIndex(prev => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        const activeItem = filteredItems[selectedMenuIndex];
        if (activeItem) {
          activeItem.action();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (activeSubPopover !== null) {
        setActiveSubPopover(null);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return true;
      }
      onClose();
      return true;
    });

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      unregister();
    };
  }, [isOpen, filteredItems, selectedMenuIndex, activeSubPopover, isRecordingHotkey, isEditingShortcut, newTagName, dbTags, tagActiveIndex, onHotkeyChange, onTagSelect, onCreateTag, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/30 backdrop-blur-[2px] pointer-events-auto"
      onClick={e => {
        e.stopPropagation();
        if (activeSubPopover !== null) {
          setActiveSubPopover(null);
        } else {
          onClose();
        }
      }}
    >
      <div className="relative flex items-start gap-4 select-none">
        {/* Main Fixed 550px Command Palette Menu Card (Locked Dimensions: Never Shrinks, Never Shifts) */}
        <div
          ref={menuCardRef}
          onClick={e => e.stopPropagation()}
          className={`relative rounded-2xl border flex flex-col w-[550px] min-w-[550px] max-w-[550px] h-auto shadow-2xl pb-2 shrink-0 select-none overflow-hidden
            ${
              isDark
                ? 'bg-[#171821] border-white/10 text-neutral-300'
                : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75]'
            }`}
          style={{
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Search Header */}
          <div
            className={`relative flex items-center px-4 py-3 border-b shrink-0 mb-1
            ${isDark ? 'border-white/5 bg-[#171821]' : 'border-black/5 bg-[#fdf6e3]'} rounded-t-2xl`}
          >
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Select property tool to configure..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedMenuIndex(0);
              }}
              className={`w-full bg-transparent outline-none border-none text-[13px] pr-16
                ${isDark ? 'text-white placeholder-neutral-500' : 'text-neutral-800 placeholder-[#93a1a1]'}`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border select-none tracking-wider
                ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-neutral-400'
                    : 'border-black/10 bg-black/5 text-[#586e75]'
                }`}
              >
                ALT + /
              </span>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar px-2 py-1">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">
                No matching properties
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isHighlighted = idx === selectedMenuIndex;
                const isSubExpanded = activeSubPopover === item.id;

                return (
                  <div key={item.id} id={`alt-slash-item-${item.id}`} className="px-1 mb-1 flex flex-col">
                    {/* Item Row (Title on Left, Badge on Right) */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedMenuIndex(idx);
                        item.action();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left ${
                        isHighlighted || isSubExpanded
                          ? isDark
                            ? 'bg-white/10 text-white'
                            : 'bg-black/10 text-[#073642]'
                          : isDark
                          ? 'hover:bg-white/5 text-neutral-300 hover:text-white'
                          : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                            isDark
                              ? 'text-neutral-400 group-hover:text-white'
                              : 'text-neutral-500 group-hover:text-[#073642]'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <span className="text-[13px] font-medium tracking-tight truncate">
                          {item.label}
                        </span>
                      </div>

                      {/* Right Side In-Row Badge / Value Display */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Floating Top-Layer Sub-Popover Overlay Card (Attached OUTSIDE to the right, z-[200000], Instant 0-animation display) */}
        {activeSubPopover && (
          <div
            ref={floatingLayerRef}
            onClick={e => e.stopPropagation()}
            style={{ marginTop: `${subPopoverTopOffset}px` }}
            className="absolute left-full top-0 ml-3 shrink-0 z-[200000]"
          >
            {/* Outside Floating Sub-Panel 1: Create Todo NewDueDateDropdown */}
            {activeSubPopover === 'todo' && (
              <NewDueDateDropdown
                isOpen={activeSubPopover === 'todo'}
                onClose={() => setActiveSubPopover(null)}
                positionClassName="relative top-0 left-0"
                onSelect={({ date, time }) => {
                  setLocalDate(date);
                  setLocalTime(time || '');
                  onTodoScheduleChange?.({
                    date,
                    time: time || '',
                    isRecurring: localRecurring,
                    cycle: localCycle,
                  });
                  setActiveSubPopover(null);
                }}
                currentDate={localDate}
                currentTime={localTime}
              />
            )}

            {/* Outside Floating Sub-Panel 2: Workspace & Folder Picker */}
            {activeSubPopover === 'folder' && (
              <div className="w-[270px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden p-1">
                <DestinationPicker
                  selectedWorkspaceId={workspaceId}
                  selectedFolderId={folderId}
                  onSelectWorkspace={(wsId: string) => {
                    onDestinationChange?.(wsId, null);
                    setActiveSubPopover(null);
                  }}
                  onSelectFolder={(wsId: string, fId: string) => {
                    onDestinationChange?.(wsId, fId);
                    setActiveSubPopover(null);
                  }}
                  onClear={() => {
                    onDestinationChange?.(null, null);
                    setActiveSubPopover(null);
                  }}
                  onClose={() => setActiveSubPopover(null)}
                />
              </div>
            )}

            {/* Outside Floating Sub-Panel 3: Tag Search & Selector */}
            {activeSubPopover === 'tags' && (
              <div className="w-[260px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden flex flex-col p-2">
                <div className="border-b border-white/5 flex items-center mb-1 pb-1">
                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      if (!newTagName.trim()) return;
                      const trimmed = newTagName.trim();
                      const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                      if (existing) {
                        onTagSelect?.({ id: existing.id, name: existing.name });
                      } else if (onCreateTag) {
                        await onCreateTag(trimmed);
                      }
                      setNewTagName('');
                    }}
                    className="flex-1 flex"
                  >
                    <input
                      ref={tagSearchInputRef}
                      type="text"
                      placeholder="Type to search or create..."
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      className="w-full bg-transparent px-2.5 py-1 text-xs outline-none text-white placeholder-neutral-500"
                      autoFocus
                    />
                  </form>
                  <button
                    type="button"
                    onClick={() => setActiveSubPopover(null)}
                    className="text-neutral-400 hover:text-white p-0.5"
                  >
                    <FiX size={13} />
                  </button>
                </div>

                {selectedTags.length > 0 && (
                  <div className="px-2 py-1 flex flex-wrap gap-1 border-b border-white/5 bg-white/5 mb-1 rounded-lg">
                    {selectedTags.map(st => (
                      <span
                        key={st.id}
                        className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-500/20"
                      >
                        {st.name}
                        <button
                          type="button"
                          onClick={() => onTagSelect?.(st)}
                          className="hover:text-blue-200 opacity-70 hover:opacity-100"
                        >
                          <FiZapOff size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="p-1 flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {selectedTags.length > 0 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        selectedTags.forEach(st => onTagSelect?.(st));
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-xs text-red-400 hover:bg-red-500/20 mb-1"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500" />
                      <span className="font-medium flex-1">Clear Tags</span>
                      <FiZapOff size={10} className="opacity-75" />
                    </button>
                  )}

                  {newTagName.trim() && (
                    <button
                      type="button"
                      onMouseEnter={() => setTagActiveIndex(0)}
                      onClick={async e => {
                        e.stopPropagation();
                        const trimmed = newTagName.trim();
                        const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                        if (existing) {
                          onTagSelect?.({ id: existing.id, name: existing.name });
                        } else if (onCreateTag) {
                          await onCreateTag(trimmed);
                        }
                        setNewTagName('');
                      }}
                      className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs border border-dashed mb-1 ${
                        tagActiveIndex === 0
                          ? 'bg-white/15 text-white border-white/30 font-medium'
                          : 'text-neutral-400 hover:bg-white/5 hover:text-white border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span>Create "{newTagName.trim()}"</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-neutral-400 font-mono scale-90">
                        Enter
                      </span>
                    </button>
                  )}

                  {dbTags.map((tag, tagIdx) => {
                    const isSelected = selectedTags.some(t => t.id === tag.id);
                    const itemIdx = newTagName.trim() ? tagIdx + 1 : tagIdx;
                    const isHighlighted = tagActiveIndex === itemIdx;
                    const dotColor = getTagColor(tag.name);
                    return (
                      <button
                        key={tag.id || tagIdx}
                        type="button"
                        onMouseEnter={() => setTagActiveIndex(itemIdx)}
                        onClick={() => onTagSelect?.({ id: tag.id, name: tag.name })}
                        className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs ${
                          isHighlighted
                            ? 'bg-white/15 text-white font-medium'
                            : isSelected
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                          <span>{tag.name}</span>
                        </div>
                        {isSelected && (
                          <span
                            className="text-red-400 hover:text-red-300 p-0.5 rounded flex items-center justify-center bg-red-500/10"
                            title="Remove tag"
                          >
                            <FiZapOff size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AltSlashPopup;

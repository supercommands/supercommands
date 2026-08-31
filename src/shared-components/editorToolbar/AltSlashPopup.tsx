/**
 * @file AltSlashPopup.tsx
 * @description Fixed 550px Alt+/ Command Palette with theme integration,
 * correct portal target resolution, clean single-star Favorite action UI,
 * and instant sub-popover placement.
 */

import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { useAppearance } from '@extension/ui';
import { FaStar } from 'react-icons/fa';
import { FiStar, FiZap, FiTag, FiTerminal, FiZapOff, FiChevronRight, FiX, FiCheck } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useUIStore } from '../uiStateManager';
import { DestinationPicker } from './DestinationPicker';
import { VisualKeyDisplay } from '../hotkeys/ui/VisualKeyDisplay';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import { TagSelector } from './TagSelector';

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

  // Destination / Workspace
  workspaceId?: string | null;
  folderId?: string | null;
  onDestinationChange?: (workspaceId: string | null, folderId: string | null) => void;
  workspaceNamesMap?: Record<string, string>;

  // Tags
  selectedTags?: TagRecord[];
  dbTags?: TagRecord[];
  onTagSelect?: (tag: any) => void;
  onCreateTag?: (name: string) => Promise<any>;

  // Visibility Flags
  showTodo?: boolean;
  showHotkey?: boolean;
  showShortcut?: boolean;
  showLocationPicker?: boolean;
  showTags?: boolean;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
}

interface CommandToolItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge: React.ReactNode;
  action: () => void;
  ariaLabel?: string;
  ariaPressed?: boolean;
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
  workspaceNamesMap,
  selectedTags = [],
  dbTags = [],
  onTagSelect,
  onCreateTag,
  showTodo = true,
  showHotkey = true,
  showShortcut = true,
  showLocationPicker = true,
  showTags = true,
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
      '--color-iconDefault': 'var(--alts-icon-fg, var(--color-altsIconFg))',
    } as React.CSSProperties;
  }, [appearanceTokens, isAltSAppearance]);

  const { theme } = useAppearance();

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

  // Resolve themed portal host container. In Alt+S, use the modal portal inside
  // the Shadow DOM so the extracted Alt+S Tailwind CSS applies to sub-popups.
  const portalTarget = useMemo(() => {
    if (typeof window !== 'undefined') {
      const host = isAltSAppearance
        ? (
            (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
            (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
            (window as any).__ALTS_PORTAL_HOST__ ||
            (window as any).__ALTQ_PORTAL_HOST__
          )
        : ((window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__);
      if (host && host instanceof HTMLElement) return host;
    }
    return document.body;
  }, [isAltSAppearance]);

  useEffect(() => {
    if (!showLocationPicker && activeSubPopover === 'folder') {
      setActiveSubPopover(null);
    }
  }, [showLocationPicker, activeSubPopover]);

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
    if (workspaceId && workspaceNamesMap?.[workspaceId]) {
      return workspaceNamesMap[workspaceId];
    }
    return 'Select Workspace';
  }, [workspaceId, workspaceNamesMap]);

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
    const items: CommandToolItem[] = [];

    if (onToggleFav) {
      items.push({
        id: 'favorite',
        label: 'Favourite',
        icon: isFav ? (
          <FaStar size={15} className="text-[#eab308] shrink-0" />
        ) : (
          <FiStar size={15} className="shrink-0 text-[var(--color-iconDefault)]" />
        ),
        ariaLabel: isFav ? 'Remove from favourites' : 'Add to favourites',
        ariaPressed: isFav,
        badge: (
          <span className="flex items-center justify-center w-6 h-6 shrink-0 pointer-events-none">
            {isFav ? (
              <FaStar size={14} className="text-[#eab308]" aria-hidden="true" />
            ) : (
              <FiStar size={14} className="text-[var(--color-iconDefault)] hover:text-[#eab308]" aria-hidden="true" />
            )}
          </span>
        ),
        action: () => {
          onToggleFav();
        },
      });
    }

    if (showHotkey && onHotkeyChange) {
      items.push({
        id: 'hotkey',
        label: 'Assign Hotkey',
        icon: <FiZap size={15} className="shrink-0 text-[var(--color-iconDefault)]" />,
        badge: isRecordingHotkey ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {localHotkey && <VisualKeyDisplay hotkey={localHotkey} size="sm" />}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse">
              Press keys... (Enter to save)
            </span>
          </div>
        ) : localHotkey ? (
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
              className="text-[var(--color-iconDefault)] hover:text-[var(--color-error)] p-0.5 rounded hover:bg-[var(--color-error)]/10"
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
            className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded border bg-[var(--color-inputBg)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] border-[var(--color-borderDefault)]"
          >
            <FiZap size={11} /> Record Key
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
        icon: <FiTerminal size={15} className="shrink-0 text-[var(--color-iconDefault)]" />,
        badge: isEditingShortcut ? (
          <div className="flex items-center gap-1 bg-[var(--color-inputBg)] px-1.5 py-0.5 rounded border border-[var(--color-borderDefault)]" onClick={e => e.stopPropagation()}>
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
              className="text-[var(--color-success)] hover:opacity-80 p-0.5"
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
              className="text-[var(--color-iconDefault)] hover:text-[var(--color-error)] p-0.5 rounded hover:bg-[var(--color-error)]/10"
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
            className="text-[11px] font-medium text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)]"
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
        icon: <BsCalendarCheck size={15} className="shrink-0 text-[var(--color-iconDefault)]" />,
        badge: (
          <div className="flex items-center gap-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${localDate || localTime ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20' : 'bg-[var(--color-inputBg)] text-[var(--color-textMuted)] border border-[var(--color-borderDefault)]'}`}>
              {scheduleLabel}
            </span>
            <FiChevronRight size={13} className="text-[var(--color-iconDefault)]" />
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
        label: 'Workspace',
        icon: (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-bold leading-none text-[var(--color-iconDefault)]">
            W
          </span>
        ),
        badge: (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-[var(--color-textSecondary)] max-w-[120px] truncate px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)]">
              {locationLabel}
            </span>
            <FiChevronRight size={13} className="text-[var(--color-iconDefault)]" />
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
        icon: <FiTag size={15} className="shrink-0 text-[var(--color-iconDefault)]" />,
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
                  <span className="text-[10px] text-[var(--color-textMuted)] font-bold">+{selectedTags.length - 2}</span>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-medium text-[var(--color-textMuted)] px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)]">
                Select Tags
              </span>
            )}
            <FiChevronRight size={13} className="text-[var(--color-iconDefault)]" />
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
    showHotkey,
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
    return toolsList.filter(item => {
      const labelMatch = item.label.toLowerCase().includes(query);
      const aliasMatch = item.id === 'favorite' && ('favorite'.includes(query) || 'favourite'.includes(query));
      return labelMatch || aliasMatch;
    });
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
        if (e.key === 'Escape' || e.key === 'Enter') {
          setIsRecordingHotkey(false);
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          setLocalHotkey('');
          onHotkeyChange?.('');
          return;
        }
        if (['ArrowDown', 'ArrowUp', 'Tab', 'PageUp', 'PageDown'].includes(e.key)) {
          setIsRecordingHotkey(false);
        } else {
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
          return;
        }
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

      // 4. Tag sub-popover Navigation
      if (activeSubPopover === 'tags') {
        return;
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
      style={appearanceStyle}
      className={`${isAltSAppearance ? 'z-alts-subpopup' : 'z-[100000]'} fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[var(--glass-blur,4px)] pointer-events-auto`}
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
        {/* Main Fixed 550px Command Palette Menu Card */}
        <div
          ref={menuCardRef}
          onClick={e => e.stopPropagation()}
          className="relative rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] flex flex-col w-[550px] min-w-[550px] max-w-[550px] h-auto shadow-2xl pb-2 shrink-0 select-none overflow-hidden backdrop-blur-xl"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--color-borderDefault)',
          }}
        >
          {/* Search Header */}
          <div className="relative flex items-center px-4 py-3 border-b border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] rounded-t-2xl shrink-0 mb-1">
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Select property tool to configure..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedMenuIndex(0);
              }}
              className="w-full bg-transparent outline-none border-none text-[13px] text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] pr-16"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textMuted)] select-none tracking-wider">
                ALT + /
              </span>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar px-2 py-1">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--color-textMuted)]">
                No matching properties
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isHighlighted = idx === selectedMenuIndex;
                const isSubExpanded = activeSubPopover === item.id;

                return (
                  <div key={item.id} id={`alt-slash-item-${item.id}`} className="px-1 mb-1 flex flex-col">
                    {/* Item Row */}
                    <button
                      type="button"
                      aria-label={item.ariaLabel}
                      aria-pressed={item.ariaPressed}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedMenuIndex(idx);
                        item.action();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                        isHighlighted || isSubExpanded
                          ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-medium'
                          : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0 text-[var(--color-iconDefault)]">
                          {item.icon}
                        </div>
                        <span className="text-[13px] font-medium tracking-tight truncate text-[var(--color-textPrimary)]">
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

            {/* Outside Floating Sub-Panel 2: Workspace Picker */}
            {activeSubPopover === 'folder' && (
              <div className="w-[270px] bg-[var(--color-contextMenuBg)] backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden p-1">
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
              <div className="w-[280px] p-2 bg-[var(--color-contextMenuBg)] backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl flex flex-col">
                <TagSelector
                  selectedTags={selectedTags}
                  dbTags={dbTags}
                  onTagSelect={tag => onTagSelect?.(tag)}
                  onRemoveTag={tagId => {
                    const tag = selectedTags.find(t => t.id === tagId);
                    if (tag) onTagSelect?.(tag);
                  }}
                  onCreateTag={onCreateTag}
                  onClearTags={() => {
                    selectedTags.forEach(st => onTagSelect?.(st));
                  }}
                  workspaceId={workspaceId}
                  isOpen={true}
                  appearanceScope={appearanceScope}
                  appearanceTokens={appearanceStyle}
                  onOpenChange={open => {
                    if (!open) setActiveSubPopover(null);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
};

export default AltSlashPopup;

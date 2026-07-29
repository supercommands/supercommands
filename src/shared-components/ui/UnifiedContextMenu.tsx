import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiExternalLink, FiLoader, FiZap, FiSearch, FiTrash, FiZapOff } from 'react-icons/fi';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useDbStore } from '../../storage/store/useDbStore';
import { VisualKeyDisplay } from '../hotkeys/ui/VisualKeyDisplay';
import { HotkeyCaptureForm } from '../hotkeys/ui/HotkeyCaptureForm';
import { checkReservedHotkey } from '../hotkeys/core/reservedHotkeys';
import { readAllHotkeys, readAllShortcuts, extractSnippetIdFromCompoundId } from '../hotkeys/utils/hotkeyUtils';
import { findCommandByAnyId } from '../commands';
import { getShortcutTriggerFormatError, normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';

// Interface for Menu Actions
export type MenuAction =
  | {
    divider: true;
    key?: string;
    label?: string;
    icon?: React.ReactNode;
    onSelect?: () => void;
    className?: string;
    disabled?: boolean;
    closeOnExecute?: boolean;
  }
  | {
    key: string;
    label: string;
    icon: React.ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    className?: string;
    divider?: false;
    closeOnExecute?: boolean;
    shortcut?: string | React.ReactNode;
    checked?: boolean;
  };

// Props interface
export interface UnifiedContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions?: MenuAction[];
  itemId?: string; // Compound ID for conflict checking
  hotkeyInput?: {
    value: string;
    onChange: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
    isUpdating?: boolean;
    isClearing?: boolean;
    onClear?: () => void;
    onOverwrite?: (conflictId: string) => void;
    showSuccess?: string | null;
  };
  shortcutInput?: {
    value: string;
    onChange: (val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
    isUpdating?: boolean;
    isClearing?: boolean;
    onClear?: () => void;
    onOverwrite?: (conflictId: string) => void;
    showSuccess?: string | null;
  };
  onNavigateAlreadyAssigned?: () => void;
  error?: string;
  conflictId?: string | null;
  showSearch?: boolean;
  menuTarget?: {
    label: string;
    iconUrl?: string;
    icon?: React.ReactNode;
  };
  rightPanelContent?: React.ReactNode;
  portalContainer?: HTMLElement | null;
  showAllHotkeysOption?: boolean;
  quickActions?: MenuAction[];
  preferDown?: boolean;
}

const shakeKeyframes = `
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-2px, 0, 0); }
  40%, 60% { transform: translate3d(2px, 0, 0); }
}
`;

export const UnifiedContextMenu: React.FC<UnifiedContextMenuProps> = ({
  x,
  y,
  onClose,
  actions = [],
  itemId = '',
  hotkeyInput,
  shortcutInput,
  onNavigateAlreadyAssigned,
  error: propsError,
  conflictId: propsConflictId,
  showSearch = false,
  menuTarget,
  rightPanelContent,
  portalContainer = document.body,
  showAllHotkeysOption = true,
  quickActions = [],
  preferDown = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const setHighlightedCommandId = useUIStore(state => state.setHighlightedCommandId);
  const isMac = typeof navigator !== 'undefined' && 
    (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  const commands = useDbStore(state => state.commands);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);

  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalConflictId, setInternalConflictId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuFocusIndex, setMenuFocusIndex] = useState(-1);

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (!showSearch || !searchQuery) return true;
      if (action.divider) return false;
      return action.label?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [actions, searchQuery, showSearch]);

  // Reset focus when query changes
  useEffect(() => {
    if (searchQuery) {
      setMenuFocusIndex(filteredActions.length > 0 ? 0 : -1);
    } else {
      setMenuFocusIndex(-1);
    }
  }, [searchQuery, filteredActions.length]);

  // Helper to find conflict name
  const findConflictingItemName = (conflictingId: string): { name: string; type: string } | null => {
    const cmd = findCommandByAnyId(commands, conflictingId);
    if (cmd) return { name: cmd.label || 'Command', type: 'COMMAND' };

    for (const workspace of workspaces) {
      const workspaceId = String((workspace as any).workspaceId ?? workspace.id);
      if (workspaceId === conflictingId) {
        return {
          name: String((workspace as any).workspaceName ?? (workspace as any).name ?? 'Workspace'),
          type: 'WORKSPACE',
        };
      }
    }

    for (const folder of folders) {
      const folderId = String((folder as any).folderId ?? folder.id);
      if (folderId === conflictingId) {
        return {
          name: String((folder as any).folderName ?? (folder as any).name ?? 'Folder'),
          type: 'FOLDER',
        };
      }
    }

    for (const snippet of snippets) {
      const snippetId = String((snippet as any).snippet_id ?? snippet.id);
      const compound = `${String((snippet as any).workspaceId ?? '')}-${String((snippet as any).folderId ?? '')}-${snippetId}`;
      if (compound === conflictingId || snippetId === conflictingId) {
        const type = String((snippet as any).category || 'NOTE').toUpperCase();
        return { name: String((snippet as any).key ?? (snippet as any).name ?? 'Snippet'), type };
      }
    }
    return null;
  };

  // Central Validation Logic
  useEffect(() => {
    const runValidation = async () => {
      setInternalError(null);
      setInternalConflictId(null);

      if (hotkeyInput?.value) {
        // 1. Check Reserved
        const reserved = checkReservedHotkey(hotkeyInput.value, isMac);
        if (reserved.isReserved) {
          setInternalError(reserved.reason || 'This shortcut is reserved by the system or extension.');
          setInternalConflictId('extension-reserved');
          return;
        }

        // 2. Check Duplicates
        if (itemId) {
          const allHotkeys = await readAllHotkeys();
          const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
          const existingEntry = Object.entries(allHotkeys).find(
            ([id, hk]) => hk === hotkeyInput.value && extractSnippetIdFromCompoundId(id) !== currentSnippetId,
          );
          if (existingEntry) {
            const conflictId = existingEntry[0];
            const conflict = findConflictingItemName(conflictId);
            const msg = conflict
              ? `Hotkey "${hotkeyInput.value}" is already assigned to "${conflict.name}" - ${conflict.type}`
              : `Hotkey "${hotkeyInput.value}" is already assigned`;
            setInternalError(msg);
            setInternalConflictId(conflictId);
            return;
          }
        }
      }

      if (shortcutInput?.value) {
        const normalized = normalizeShortcutTrigger(shortcutInput.value);
        const formatError = getShortcutTriggerFormatError(shortcutInput.value);
        if (formatError) {
          setInternalError(formatError);
          setInternalConflictId(null);
          return;
        }

        if (normalized && itemId) {
          const allShortcuts = await readAllShortcuts();
          const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => normalizeShortcutTrigger(sc) === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
          if (existingEntry) {
            const conflictId = existingEntry[0];
            const conflict = findConflictingItemName(conflictId);
            const msg = conflict
              ? `Shortcut "${normalized}" is already assigned to "${conflict.name}" - ${conflict.type}`
              : `Shortcut "${normalized}" is already assigned`;
            setInternalError(msg);
            setInternalConflictId(conflictId);
            return;
          }
        }
      }
    };

    const timer = setTimeout(runValidation, 200);
    return () => clearTimeout(timer);
  }, [hotkeyInput?.value, shortcutInput?.value, itemId, isMac, folders, snippets, workspaces]);

  // Use either internal validation or passed props
  const error = internalError || propsError;
  const conflictId = internalConflictId || propsConflictId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Use composedPath() to support Shadow DOM retargeting.
      // If the menuRef element is in the event path, the click was inside the menu.
      const path = event.composedPath();
      if (menuRef.current && !path.includes(menuRef.current)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Focus input if present
    if (hotkeyInput && inputRef.current) {
      // Small timeout to ensure render
      setTimeout(() => inputRef.current?.focus(), 10);
    }
    if (shortcutInput && shortcutInputRef.current) {
      setTimeout(() => shortcutInputRef.current?.focus(), 10);
    }
    if (showSearch && !hotkeyInput && !shortcutInput && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, hotkeyInput, shortcutInput]);

  // Dimensions
  const isInputMode = !!hotkeyInput || !!shortcutInput || !!rightPanelContent;
  const hasActions = actions.length > 0;
  const menuWidth = 240; // Increased from 192 to prevent squashing
  const defaultPanelWidth = 260; // default w-[260px]

  // Calculate total initial width for positioning
  const totalWidth = (hasActions ? menuWidth : 0) + (isInputMode ? defaultPanelWidth : 0);
  const padding = 12;

  // Calculate estimated height
  const quickActionsHeight = quickActions.length > 0 ? 44 : 0;
  const headerHeight = menuTarget?.label ? 36 : 0;
  const searchHeight = showSearch ? 44 : 0;
  const actionsListHeight = hasActions ? actions.length * 36 : 0;
  const actionsHeight = hasActions ? quickActionsHeight + headerHeight + searchHeight + actionsListHeight + 16 : 0;
  const inputModeHeight = isInputMode ? 220 : 0;
  const estimatedHeight = Math.max(actionsHeight, inputModeHeight, 100);

  // Calculate available space
  const spaceAbove = y - padding;
  const spaceBelow = window.innerHeight - y - padding;

  // Smart Flip & Constraint Logic
  const fitsBelow = spaceBelow >= estimatedHeight;
  const fitsAbove = spaceAbove >= estimatedHeight;

  let shouldFlip = false;
  if (!preferDown) {
    if (!fitsBelow && fitsAbove) {
      shouldFlip = true;
    } else if (!fitsBelow && !fitsAbove) {
      shouldFlip = spaceAbove > spaceBelow;
    }
  } else {
    if (!fitsBelow && fitsAbove && spaceAbove > spaceBelow) {
      shouldFlip = true;
    }
  }

  // Calculate dynamic constraints
  const availableSpace = shouldFlip ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, availableSpace);

  // Calculate adjusted top/left
  let finalLeft = x;
  const wouldOverflowRight = x + totalWidth + padding > window.innerWidth;

  if (wouldOverflowRight) {
    // SHIFT LEFT Strategy:
    finalLeft = window.innerWidth - totalWidth - padding;
    if (finalLeft < padding) finalLeft = padding;
  }

  // Final top position if NOT flipping: shift upward if space allows to prevent unnecessary scrolling
  let finalTop = y;
  if (!shouldFlip && y + estimatedHeight > window.innerHeight - padding) {
    const idealTop = window.innerHeight - estimatedHeight - padding;
    finalTop = Math.max(padding, idealTop);
  }

  const style: React.CSSProperties = {
    position: 'fixed' as const,
    zIndex: 2147483647, // Max z-index
    left: finalLeft,
    maxHeight: `${maxHeight}px`,
    overflowY: 'auto' as const,
    ...(shouldFlip ? { bottom: window.innerHeight - y, top: 'auto' } : { top: finalTop }),
  };

  return createPortal(
    <div
      ref={menuRef}
      data-unified-menu="true"
      className={`bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-row transition-[width,left] ease-out custom-scrollbar`}
      style={{
        ...style,
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        pointerEvents: 'auto',
      }}>
      <style>{`
        ${shakeKeyframes}
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 9999px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.4);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
      `}</style>

      {hasActions && (
      <div className="flex flex-col min-w-fit w-max">
        {/* QUICK ACTIONS ROW (TOP LEVEL) */}
        {quickActions.length > 0 && (
          <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100 dark:border-white/10 bg-slate-50/30 dark:bg-white/5 last:border-b-0">
            {quickActions.map((action, idx) => (
              <button
                key={`quick-${action.key || idx}`}
                disabled={action.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (action.onSelect) action.onSelect();
                  if ((action as any).closeOnExecute !== false) onClose();
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-all whitespace-nowrap shadow-sm hover:shadow-md ${action.className || 'text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* HEADER */}
        {menuTarget?.label && (
          <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              {menuTarget.iconUrl ? (
                <img src={menuTarget.iconUrl} alt={menuTarget.label} className="w-4 h-4 rounded-sm object-cover" />
              ) : menuTarget.icon ? (
                <span className="w-4 h-4 flex items-center justify-center text-[var(--color-iconDefault)]">
                  {menuTarget.icon}
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-500" />
              )}
              <span 
                className="text-[11px] font-semibold text-slate-500 dark:text-neutral-300 truncate whitespace-nowrap flex-1 block"
                style={{ maxWidth: '300px' }}
                title={menuTarget.label}
              >
                {`${menuTarget.label}`}
              </span>
            </div>
          </div>
        )}

        {/* MENU ACTIONS PANEL */}
        {hasActions && (
          <div className="flex flex-col py-0 transition-colors duration-200">
            <div className="flex-1 overflow-y-auto min-h-0 py-0">
              {filteredActions.length > 0 ? (
                filteredActions.map((action, idx) => {
                  if (action.divider) {
                    return (
                      <div key={`divider-${idx}`} className="border-b border-slate-100 dark:border-white/10 mx-2 my-1" />
                    );
                  }

                  // Active State Checking
                  const isActiveHostname = hotkeyInput && action.key === 'assign-hotkey';
                  const isActiveShortcut = shortcutInput && action.key === 'assign-shortcut';
                  const isSelected = isActiveHostname || isActiveShortcut || action.checked;
                  const isFocused = idx === menuFocusIndex;

                  return (
                    <button
                      key={action.key}
                      disabled={action.disabled}
                      onClick={e => {
                        e.stopPropagation();
                        
                        action.onSelect();
                        // Don't close if selecting an assignment action or clearing
                        if (
                          action.key !== 'assign-hotkey' &&
                          action.key !== 'assign-shortcut' &&
                          action.key !== 'clear-hotkey'
                        ) {
                          if (!action.divider && action.closeOnExecute !== false) {
                            onClose();
                          }
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${isSelected
                        ? 'bg-slate-100 bg-[var(--color-accentBg)] text-blue-600 text-[var(--color-accent)] font-medium'
                        : isFocused
                          ? 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white'
                          : action.className
                            ? action.className
                            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700/50'
                        } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className="flex items-center gap-2">
                        {action.icon}
                        <span className="truncate">
                          {action.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(action as any).checked && (
                          <FiCheck className="text-[var(--color-accent)]" size={14} />
                        )}
                        {!action.divider &&
                          (action as any).shortcut &&
                          (typeof (action as any).shortcut === 'string' ? (
                            <span className="text-[10px] text-slate-400 dark:text-neutral-400 font-medium ml-2">
                              {(action as any).shortcut}
                            </span>
                          ) : (
                            (action as any).shortcut
                          ))}
                      </div>
                    </button>
                  );
                })
              ) : searchQuery ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-neutral-400">No results found</div>
              ) : null}
            </div>

            {/* Search Bar at Bottom (Only show if NOT in input mode AND showSearch is true) */}
            {!isInputMode && showSearch && (
              <div className="px-2 pb-2 pt-1 mt-auto border-t border-slate-100 dark:border-white/5">
                <div className="relative flex items-center">
                  <FiSearch className="absolute left-2 text-[var(--color-iconDefault)]" size={12} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search actions..."
                    className="w-full pl-7 pr-2 py-1 text-xs bg-slate-100 dark:bg-neutral-800 rounded-md border border-transparent focus:border-blue-500 dark:focus:border-neutral-500 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-neutral-500/30 outline-none text-slate-900 dark:text-neutral-200"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onClick={e => e.stopPropagation()} // Prevent menu from closing when clicking search input
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        setMenuFocusIndex(prev =>
                          filteredActions.length > 0 ? (prev + 1) % filteredActions.length : -1,
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        setMenuFocusIndex(prev =>
                          filteredActions.length > 0 ? (prev - 1 + filteredActions.length) % filteredActions.length : -1,
                        );
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        const targetAction = filteredActions[menuFocusIndex];
                        if (targetAction && !targetAction.disabled && !targetAction.divider) {
                          targetAction.onSelect();
                          if (
                            targetAction.key !== 'assign-hotkey' &&
                            targetAction.key !== 'assign-shortcut' &&
                            targetAction.key !== 'clear-hotkey'
                          ) {
                            if (targetAction.closeOnExecute !== false) {
                              onClose();
                            }
                          }
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        onClose();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Unified Conflict Link at Bottom Left */}
            {error && conflictId && conflictId !== 'extension-reserved' && showAllHotkeysOption && (
              <div className="px-2 pb-2 pt-1 mt-auto border-t border-slate-100 dark:border-white/5 flex flex-col gap-1">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (conflictId) setHighlightedCommandId(conflictId);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-slate-400 dark:text-neutral-400 hover:text-blue-500 hover:text-[var(--color-accentHover)] hover:bg-slate-50 dark:hover:bg-neutral-700/50 rounded-md transition-all group">
                  <FiExternalLink size={11} className="group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Open All Hotkeys Menu</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* RIGHT PANEL (Side Expansion: Inputs or Custom Content) */}
      {(hotkeyInput || shortcutInput || rightPanelContent) && (
        <div
          className={`min-w-[220px] w-fit flex flex-col ${hasActions ? 'bg-slate-50/50 dark:bg-black/20 animate-in slide-in-from-left-4 duration-300 border-l border-slate-100 dark:border-white/10' : 'px-1'}`}>
          {/* Custom Right Panel Content */}
          {rightPanelContent && <div className="h-full flex flex-col">{rightPanelContent}</div>}

          {/* Hotkey Editor */}
          {hotkeyInput && (
            <div className="px-2 pb-2 flex flex-col h-full justify-between">
              <div className="flex flex-col gap-3">
                {/* True Unified Card (Big & Clean - Transparent) */}
                <div
                  className={`flex flex-col rounded-lg overflow-hidden transition-all duration-200 ${error
                    ? 'border border-red-500/50 dark:border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] animate-shake'
                    : ''
                    }`}>
                  {/* Header with Clear Button */}
                  <div className="px-1 py-1.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between overflow-hidden">
                    <div className="text-[10px] font-bold tracking-wider text-slate-600 dark:text-neutral-200 leading-tight">
                      {hotkeyInput.value
                        ? `Assign a Keyboard Shortcut (${hotkeyInput.value})`
                        : isMac
                          ? 'Assign a Keyboard Shortcut (Meta / Ctrl + Key)'
                          : 'Assign a Keyboard Shortcut (Alt / Ctrl + Key)'}
                    </div>
                    {hotkeyInput.value && hotkeyInput.onClear && (
                      <div className="flex items-center">
                        <button
                          onClick={hotkeyInput.onClear}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1 rounded-md hover:bg-red-500/10 flex items-center gap-1.5 text-[10px] font-medium"
                          title="Clear hotkey">
                        {hotkeyInput.isSaving && !hotkeyInput.value ? (
                          <>
                            <span>Clearing...</span>
                            <FiLoader size={10} className="animate-spin" />
                          </>
                        ) : (
                          <>
                            <span>Clear</span>
                            <FiZapOff size={12} />
                          </>
                        )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body (Input - Big & Clean) */}
                  <div className="relative min-h-[60px] flex items-center justify-center overflow-hidden transition-all duration-200">
                    <input
                      ref={inputRef}
                      type="text"
                      value={hotkeyInput.value}
                      readOnly
                      onKeyDown={hotkeyInput.onChange}
                      autoFocus
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                    />

                    {/* Visual Content */}
                    <div className="relative z-0 pointer-events-none flex items-center justify-center p-3 whitespace-nowrap flex-nowrap overflow-visible">
                      {!hotkeyInput.value ? (
                        <span className="text-slate-400 dark:text-neutral-500 font-medium text-sm">
                          {isMac ? 'Press Meta / Ctrl + Key...' : 'Press Alt / Ctrl + Key...'}
                        </span>
                      ) : (
                        <VisualKeyDisplay hotkey={hotkeyInput.value} size="lg" />
                      )}
                    </div>
                  </div>

                  {/* Footer (Error & Link - Minimalist) */}
                  {error && (
                    <div className="px-3 py-2 border-t border-red-500/20 flex flex-col gap-1">
                      <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                        <FiZap size={12} className="shrink-0 mt-0.5" />
                        <div className="text-[11px] font-medium leading-tight flex flex-wrap gap-x-1">
                          <span className="text-slate-500 dark:text-neutral-100/90">Conflict:</span>
                          {(() => {
                            const parts = error.split('"');
                            if (parts.length >= 5) {
                              const hotkeyValue = parts[1];
                              const isAlreadyAssigned = parts[2];
                              const itemName = parts[3];
                              const remaining = parts[4];

                              const typeMatch = remaining.match(/-\s*(\w+)/);
                              const typeRaw = typeMatch ? typeMatch[1].toLowerCase() : '';

                              let typeDisplay = typeRaw;
                              if (typeRaw === 'note') typeDisplay = 'Note';
                              else if (typeRaw === 'link') typeDisplay = 'Link';
                              else if (typeRaw === 'snippet') typeDisplay = 'Snippet';
                              else if (typeRaw === 'command') typeDisplay = 'Command';
                              else if (typeRaw) typeDisplay = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1);

                              return (
                                <>
                                  <span className="text-red-600 dark:text-red-400 font-bold">"{hotkeyValue}"</span>
                                  <span className="text-slate-500 dark:text-neutral-100/90">{isAlreadyAssigned}</span>
                                  <span className="text-red-600 dark:text-red-400 font-bold">"{itemName}"</span>
                                  {/* <span className="text-[#93a1a1] dark:text-neutral-200/80 text-[10px]"> ({typeDisplay})</span> */}
                                </>
                              );
                            }
                            return <span className="text-slate-500 dark:text-neutral-200/80">{error}</span>;
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-5">{/* Conflict link moved to actions panel */}</div>
                    </div>
                  )}
                </div>
              </div>

              {hotkeyInput.isSaving ? (
                <div className="flex items-center gap-1.5 px-1 self-end mt-4">
                  {hotkeyInput.showSuccess ? (
                    <>
                      <FiCheck size={12} className="text-[var(--color-success)]" />
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        Saved: {hotkeyInput.showSuccess}
                      </span>
                    </>
                  ) : (
                    <>
                      <FiLoader size={12} className="animate-spin text-[var(--color-accent)]" />
                      <span className="text-[10px] font-medium text-[var(--color-accent)] whitespace-nowrap">
                        {hotkeyInput.isClearing ? 'Clearing...' : hotkeyInput.isUpdating ? 'Updating...' : 'Saving...'}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 self-end px-1 mt-4">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      hotkeyInput.onCancel();
                    }}
                    className="rounded-xl border border-transparent hover:bg-slate-100 dark:hover:bg-white/10 px-1 py-0.5 text-xs font-medium text-slate-500 dark:text-neutral-400 transition-colors"
                    title="Cancel">
                    Cancel
                  </button>
                  {/* Only show Overwrite button if error exists, onOverwrite is defined, AND it's NOT an extension conflict */}
                  {error && hotkeyInput.onOverwrite && conflictId !== 'extension-reserved' ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (conflictId) hotkeyInput.onOverwrite?.(conflictId);
                      }}
                      className="rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-1 text-xs font-medium shadow-sm transition-colors"
                      title="Overwrite existing assignment">
                      Overwrite
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        hotkeyInput.onSave();
                      }}
                      disabled={!!error}
                      className={`rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${error ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      title="Save">
                      Save
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Shortcut Editor */}
          {shortcutInput && (
            <div className="px-3 pb-3 flex flex-col h-full justify-between">
              <div className="flex flex-col gap-3">
                {/* True Unified Card (Standard Text - Transparent) */}
                <div
                  className={`flex flex-col rounded-lg overflow-hidden transition-all duration-200 ${error
                    ? 'border border-red-500/50 dark:border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] animate-shake'
                    : ''
                    }`}>
                  {/* Header */}
                  <div className="px-2 py-1 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="text-[9px] font-semibold tracking-wider text-slate-500 dark:text-neutral-200">
                      Assign a Text Shortcut
                    </div>
                    {shortcutInput.value && shortcutInput.onClear && (
                      <div className="flex items-center">
                        <button
                          onClick={shortcutInput.onClear}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1 rounded-md hover:bg-red-500/10 flex items-center gap-1.5 text-[10px] font-medium"
                          title="Clear shortcut">
                        {shortcutInput.isSaving && !shortcutInput.value ? (
                          <>
                            <span>Clearing...</span>
                            <FiLoader size={10} className="animate-spin" />
                          </>
                        ) : (
                          <>
                            <span>Clear</span>
                            <FiZapOff size={12} />
                          </>
                        )}
                      </button>
                      </div>
                    )}
                  </div>

                  {/* Body (Input - Standard Small) */}
                  <div className="p-2 flex items-center justify-center min-h-[85px] transition-all duration-200">
                    <input
                      ref={shortcutInputRef}
                      type="text"
                      value={normalizeShortcutTrigger(shortcutInput.value)}
                      onChange={e => shortcutInput.onChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') shortcutInput.onSave();
                        if (e.key === 'Escape') shortcutInput.onCancel();
                      }}
                      className="flex-1 min-w-0 bg-transparent py-1 text-center text-xs text-slate-900 dark:text-neutral-200 outline-none px-1"
                      placeholder="shortcut"
                      autoFocus
                    />
                  </div>

                  {/* Footer (Error & Link - Minimalist) */}
                  {error && (
                    <div className="px-2 py-1.5 border-t border-red-500/20 flex flex-col gap-1">
                      <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400">
                        <FiZap size={11} className="shrink-0 mt-0.5" />
                        <div className="text-[10px] font-medium leading-tight flex flex-wrap gap-x-1">
                          <span className="text-slate-500 dark:text-neutral-100/90">Conflict:</span>
                          {(() => {
                            const parts = error.split('"');
                            if (parts.length >= 5) {
                              const shortcutValue = parts[1];
                              const isAlreadyAssigned = parts[2];
                              const itemName = parts[3];
                              const remaining = parts[4];

                              const typeMatch = remaining.match(/-\s*(\w+)/);
                              const typeRaw = typeMatch ? typeMatch[1].toLowerCase() : '';

                              let typeDisplay = typeRaw;
                              if (typeRaw === 'note') typeDisplay = 'Note';
                              else if (typeRaw === 'link') typeDisplay = 'Link';
                              else if (typeRaw === 'snippet') typeDisplay = 'Snippet';
                              else if (typeRaw === 'command') typeDisplay = 'Command';
                              else if (typeRaw) typeDisplay = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1);

                              return (
                                <>
                                  <span className="text-red-600 dark:text-red-400 font-bold">"{shortcutValue}"</span>
                                  <span className="text-slate-500 dark:text-neutral-100/90">{isAlreadyAssigned}</span>
                                  <span className="text-red-600 dark:text-red-400 font-bold">"{itemName}"</span>
                                  <span className="text-slate-400 dark:text-neutral-200/80 text-[10px]">
                                    {' '}
                                    - {typeDisplay}
                                  </span>
                                </>
                              );
                            }
                            return <span className="text-slate-500 dark:text-neutral-200/80">{error}</span>;
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">{/* Conflict link moved to actions panel */}</div>
                    </div>
                  )}
                </div>
              </div>

              {shortcutInput.isSaving ? (
                <div className="flex items-center gap-1.5 px-1 self-end mt-4">
                  {shortcutInput.showSuccess ? (
                    <>
                      <FiCheck size={12} className="text-[var(--color-success)]" />
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        Saved: {shortcutInput.showSuccess}
                      </span>
                    </>
                  ) : (
                    <>
                      <FiLoader size={12} className="animate-spin text-[var(--color-success)]" />
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        {shortcutInput.isClearing
                          ? 'Clearing...'
                          : shortcutInput.isUpdating
                            ? 'Updating...'
                            : 'Saving...'}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 self-end px-1 mt-4">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      shortcutInput.onCancel();
                    }}
                    className="rounded-xl border border-transparent hover:bg-[#eee8d5] dark:hover:bg-white/10 px-2 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-400 transition-colors"
                    title="Cancel">
                    Cancel
                  </button>
                  {error && shortcutInput.onOverwrite ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (conflictId) shortcutInput.onOverwrite?.(conflictId);
                      }}
                      className="rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-1 text-xs font-medium shadow-sm transition-colors"
                      title="Overwrite existing assignment">
                      Overwrite
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        shortcutInput.onSave();
                      }}
                      disabled={!!error}
                      className={`rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${error ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      title="Save">
                      Save
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>,
    portalContainer || document.body,
  );
};

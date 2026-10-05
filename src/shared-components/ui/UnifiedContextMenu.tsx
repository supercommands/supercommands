import * as React from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiExternalLink, FiLoader, FiZap, FiSearch, FiTrash, FiZapOff } from 'react-icons/fi';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useDbStore } from '../../storage/store/useDbStore';
import { VisualKeyDisplay } from '../hotkeys/ui/VisualKeyDisplay';
import { HotkeyCaptureForm } from '../hotkeys/ui/HotkeyCaptureForm';
import { checkReservedHotkey } from '../hotkeys/core/reservedHotkeys';
import { readAllHotkeys, readAllShortcuts, extractSnippetIdFromCompoundId } from '../hotkeys/utils/hotkeyUtils';
import { findCommandByAnyId } from '../commands';
import { checkShortcutAssignment, normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { getShortcutConflictOwnerRows } from '../shortcuts/ui/shortcutConflictDisplay';
import { resolveShortcutAssignmentChoice } from '../shortcuts/core/shortcutManager';
import type { ShortcutAssignmentCheck, ShortcutAssignmentApproval } from '../shortcuts/core/shortcutAssignmentTypes';
// Interface for Menu Actions
export type MenuAction = {
    divider: true;
    key?: string;
    label?: string;
    icon?: React.ReactNode;
    onSelect?: () => void;
    className?: string;
    disabled?: boolean;
    closeOnExecute?: boolean;
} | {
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
        onBackspaceEmpty?: () => void;
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
        onResolve?: (approval: ShortcutAssignmentApproval) => Promise<void>;
        onBackspaceEmpty?: () => void;
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
    appearanceScope?: 'default' | 'alts';
    appearanceTokens?: React.CSSProperties;
}
const shakeKeyframes = `
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-2px, 0, 0); }
  40%, 60% { transform: translate3d(2px, 0, 0); }
}
`;
export const UnifiedContextMenu: React.FC<UnifiedContextMenuProps> = ({ x, y, onClose, actions = [], itemId = '', hotkeyInput, shortcutInput, onNavigateAlreadyAssigned, error: propsError, conflictId: propsConflictId, showSearch = false, menuTarget, rightPanelContent, portalContainer = document.body, showAllHotkeysOption = true, quickActions = [], preferDown = false, appearanceScope = 'default', appearanceTokens, }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [shortcutCheck, setShortcutCheck] = useState<{
        draft: string;
        result: ShortcutAssignmentCheck;
    } | null>(null);
    const [shortcutChoicePending, setShortcutChoicePending] = useState(false);
    const [shortcutChoiceError, setShortcutChoiceError] = useState<string | null>(null);
    const shortcutValueRef = useRef(shortcutInput?.value || '');
    shortcutValueRef.current = shortcutInput?.value || '';
    const shortcutInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const setHighlightedCommandId = useUIStore(state => state.setHighlightedCommandId);
    const isMac = typeof navigator !== 'undefined' &&
        (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
    const commands = useDbStore(state => state.commands);
    const organisations = useDbStore(state => state.organisations);
    const snippets = useDbStore(state => state.snippets);
    const isAltSAppearance = appearanceScope === 'alts';
    const appearanceStyle = useMemo<React.CSSProperties | undefined>(() => {
        if (!isAltSAppearance)
            return appearanceTokens;
        return {
            ...appearanceTokens,
            '--color-contextMenuBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
            '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
            '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
            '--color-inputBg': 'var(--alts-input-bg, var(--color-altsInputBg))',
            '--color-panelBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
            '--color-containerBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
            '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
            '--color-selectedBg': 'var(--alts-selected-bg, var(--color-altsSelectedBg))',
            '--color-borderDefault': 'var(--alts-border-color, var(--color-altsBorderColor))',
            '--color-borderActive': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
            '--color-focusRing': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
            '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
            '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
            '--color-textMuted': 'var(--alts-text-muted, var(--color-altsTextMuted))',
            '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
            '--color-iconDefault': 'var(--alts-icon-fg, var(--color-altsIconFg))',
            '--color-accent': 'var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg))',
            '--color-accentHover': 'var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg))',
            '--color-success': 'var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg))',
            '--color-danger': '#ef4444',
            '--color-dangerHover': '#f87171',
            '--color-dangerBg': 'rgba(239, 68, 68, 0.14)',
        } as React.CSSProperties;
    }, [appearanceTokens, isAltSAppearance]);
    const [internalError, setInternalError] = useState<string | null>(null);
    const [internalConflictId, setInternalConflictId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [menuFocusIndex, setMenuFocusIndex] = useState(-1);
    const filteredActions = useMemo(() => {
        return actions.filter(action => {
            if (!showSearch || !searchQuery)
                return true;
            if (action.divider)
                return false;
            return action.label?.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [actions, searchQuery, showSearch]);
    // Reset focus when query changes
    useEffect(() => {
        if (searchQuery) {
            setMenuFocusIndex(filteredActions.length > 0 ? 0 : -1);
        }
        else {
            setMenuFocusIndex(-1);
        }
    }, [searchQuery, filteredActions.length]);
    // Helper to find conflict name
    const findConflictingItemName = (conflictingId: string): {
        name: string;
        type: string;
    } | null => {
        const cmd = findCommandByAnyId(commands, conflictingId);
        if (cmd)
            return { name: cmd.label || 'Command', type: 'COMMAND' };
        for (const organisation of organisations) {
            const organisationId = String((organisation as any).organisationId ?? organisation.id);
            if (organisationId === conflictingId) {
                return {
                    name: String((organisation as any).organisationName ?? (organisation as any).name ?? 'Workspace'),
                    type: 'ORGANISATION',
                };
            }
        }
        for (const snippet of snippets) {
            const snippetId = String((snippet as any).snippet_id ?? snippet.id);
            const compound = `${String((snippet as any).organisationId ?? '')}-${String('')}-${snippetId}`;
            if (compound === conflictingId || snippetId === conflictingId) {
                const type = String((snippet as any).category || 'NOTE').toUpperCase();
                return { name: String((snippet as any).key ?? (snippet as any).name ?? 'Snippet'), type };
            }
        }
        return null;
    };
    // Central Validation Logic
    useEffect(() => {
        let active = true;
        setShortcutCheck(null);
        setShortcutChoiceError(null);
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
                    const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === hotkeyInput.value && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
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
                const draft = shortcutInput.value;
                try {
                    const result = await checkShortcutAssignment(draft, itemId);
                    if (active && shortcutValueRef.current === draft)
                        setShortcutCheck({ draft, result });
                }
                catch (failure) {
                    if (active && shortcutValueRef.current === draft)
                        setShortcutCheck({ draft, result: {
                                status: 'error', value: draft, message: failure instanceof Error ? failure.message : String(failure),
                            } });
                }
            }
        };
        const timer = setTimeout(runValidation, 200);
        return () => { active = false; clearTimeout(timer); };
    }, [hotkeyInput?.value, shortcutInput?.value, itemId, isMac, snippets, organisations]);
    // Use either internal validation or passed props
    const currentShortcutCheck = shortcutCheck && shortcutInput && shortcutCheck.draft === shortcutInput.value
        ? shortcutCheck.result
        : null;
    const shortcutConflict = currentShortcutCheck?.status === 'conflict' ? currentShortcutCheck.conflict : null;
    const shortcutChecking = Boolean(shortcutInput?.value && !currentShortcutCheck);
    const error = shortcutInput ? shortcutChoiceError || (currentShortcutCheck?.status !== 'available' ? currentShortcutCheck?.message : propsError) : internalError || propsError;
    const conflictId = shortcutInput ? shortcutConflict?.id || (currentShortcutCheck?.status === 'error' ? 'omni-reserved' : null) : internalConflictId || propsConflictId;
    const chooseShortcut = async (mode: 'add' | 'overwrite') => {
        if (!shortcutInput || !shortcutConflict || shortcutChoicePending || shortcutChecking)
            return;
        setShortcutChoicePending(true);
        setShortcutChoiceError(null);
        try {
            const approval = { ...shortcutConflict, mode };
            if (shortcutInput.onResolve)
                await shortcutInput.onResolve(approval);
            else {
                if (!itemId)
                    throw new Error('Choose a saved item before assigning this Text Command.');
                await resolveShortcutAssignmentChoice(itemId, shortcutInput.value, approval);
                shortcutInput.onCancel();
            }
        }
        catch (failure) {
            setShortcutChoiceError(failure instanceof Error ? failure.message : String(failure));
            const draft = shortcutInput.value;
            try {
                const result = await checkShortcutAssignment(draft, itemId);
                if (shortcutValueRef.current === draft)
                    setShortcutCheck({ draft, result });
            }
            catch (refreshFailure) {
                if (shortcutValueRef.current === draft)
                    setShortcutCheck({ draft, result: {
                            status: 'error', value: draft, message: refreshFailure instanceof Error ? refreshFailure.message : String(refreshFailure),
                        } });
            }
        }
        finally {
            setShortcutChoicePending(false);
        }
    };
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
    const inputModeHeight = shortcutConflict ? 340 : isInputMode ? 220 : 0;
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
        }
        else if (!fitsBelow && !fitsAbove) {
            shouldFlip = spaceAbove > spaceBelow;
        }
    }
    else {
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
        if (finalLeft < padding)
            finalLeft = padding;
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
    return createPortal(<div ref={menuRef} data-unified-menu="true" className={`${isAltSAppearance ? 'unified-context-menu-alts z-alts-subpopup' : ''} bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-row transition-[width,left] ease-out custom-scrollbar`} style={{
            ...appearanceStyle,
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
        .unified-context-menu-alts,
        .unified-context-menu-alts * {
          box-sizing: border-box;
        }
        .unified-context-menu-alts input {
          color: var(--color-textPrimary) !important;
          border-color: var(--color-borderDefault) !important;
          box-shadow: none !important;
        }
        .unified-context-menu-alts input::placeholder {
          color: var(--color-textPlaceholder) !important;
        }
        .unified-context-menu-alts button {
          appearance: none;
          -webkit-appearance: none;
          color: var(--color-textPrimary) !important;
        }
        .unified-context-menu-alts button[title^="Clear"] {
          color: var(--color-danger) !important;
        }
        .unified-context-menu-alts button[title="Cancel"] {
          color: var(--color-textSecondary) !important;
        }
        .unified-context-menu-alts button[title="Save"],
        .unified-context-menu-alts button[title="Overwrite existing assignment"] {
          color: var(--color-textPrimary) !important;
        }
        .unified-context-menu-alts :where(
          [class*="text-slate-600"],
          [class*="text-slate-900"],
          [class*="dark:text-neutral-200"],
          [class*="dark:text-neutral-100"],
          [class*="text-neutral-700"],
          [class*="text-[#586e75]"]
        ) {
          color: var(--color-textPrimary) !important;
        }
        .unified-context-menu-alts :where(
          [class*="text-slate-500"],
          [class*="text-slate-400"],
          [class*="dark:text-neutral-500"],
          [class*="dark:text-neutral-400"]
        ) {
          color: var(--color-textSecondary) !important;
        }
        .unified-context-menu-alts :where(
          [class*="bg-[#f5f3ff]"],
          [class*="dark:bg-neutral-800"]
        ) {
          background-color: var(--color-panelBg) !important;
        }
        .unified-context-menu-alts :where(
          [class*="border-[#c7bcff]"],
          [class*="dark:border-[#9fa2ff]"]
        ) {
          border-color: var(--color-borderActive) !important;
        }
        .unified-context-menu-alts :where(
          [class*="hover:border-[#b9adff]"],
          [class*="dark:hover:border-[#8f93ff]"]
        ):hover {
          border-color: var(--color-focusRing) !important;
        }
        .unified-context-menu-alts :where(
          [class*="hover:bg-slate-100"],
          [class*="dark:hover:bg-white/10"],
          [class*="hover:bg-[#eee8d5]"]
        ):hover {
          background-color: var(--color-hoverBg) !important;
        }
      `}</style>

      {hasActions && (<div className="flex flex-col min-w-fit w-max">
        {/* QUICK ACTIONS ROW (TOP LEVEL) */}
        {quickActions.length > 0 && (<div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] last:border-b-0">
            {quickActions.map((action, idx) => (<button key={`quick-${action.key || idx}`} disabled={action.disabled} onClick={(e) => {
                        e.stopPropagation();
                        if (action.onSelect)
                            action.onSelect();
                        if ((action as any).closeOnExecute !== false)
                            onClose();
                    }} className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-all whitespace-nowrap shadow-sm hover:shadow-md ${action.className || 'text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {action.icon}
                <span>{action.label}</span>
              </button>))}
          </div>)}

        {/* HEADER */}
        {menuTarget?.label && (<div className="px-3 py-2 border-b border-[var(--color-borderDefault)]">
            <div className="flex items-center gap-2 min-w-0">
              {menuTarget.iconUrl ? (<img src={menuTarget.iconUrl} alt={menuTarget.label} className="w-4 h-4 rounded-sm object-cover"/>) : menuTarget.icon ? (<span className="w-4 h-4 flex items-center justify-center text-[var(--color-iconDefault)]">
                  {menuTarget.icon}
                </span>) : (<span className="w-1.5 h-1.5 rounded-full bg-[var(--color-textMuted)]"/>)}
              <span className="text-[11px] font-semibold text-[var(--color-textSecondary)] truncate whitespace-nowrap flex-1 block" style={{ maxWidth: '300px' }} title={menuTarget.label}>
                {`${menuTarget.label}`}
              </span>
            </div>
          </div>)}

        {/* MENU ACTIONS PANEL */}
        {hasActions && (<div className="flex flex-col py-0 transition-colors duration-200">
            <div className="flex-1 overflow-y-auto min-h-0 py-0">
              {filteredActions.length > 0 ? (filteredActions.map((action, idx) => {
                    if (action.divider) {
                        return (<div key={`divider-${idx}`} className="border-b border-[var(--color-borderDefault)] mx-2 my-1"/>);
                    }
                    // Active State Checking
                    const isActiveHostname = hotkeyInput && action.key === 'assign-hotkey';
                    const isActiveShortcut = shortcutInput && action.key === 'assign-shortcut';
                    const isSelected = isActiveHostname || isActiveShortcut || action.checked;
                    const isFocused = idx === menuFocusIndex;
                    return (<button key={action.key} disabled={action.disabled} onClick={e => {
                            e.stopPropagation();
                            action.onSelect();
                            // Don't close if selecting an assignment action or clearing
                            if (action.key !== 'assign-hotkey' &&
                                action.key !== 'assign-shortcut' &&
                                action.key !== 'clear-hotkey') {
                                if (!action.divider && action.closeOnExecute !== false) {
                                    onClose();
                                }
                            }
                        }} className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${isSelected
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-accent)] font-semibold'
                            : isFocused
                                ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-medium'
                                : action.className
                                    ? action.className
                                    : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] font-medium'} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className="flex items-center gap-2">
                        {action.icon}
                        <span className="truncate">
                          {action.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(action as any).checked && (<FiCheck className="text-[var(--color-accent)]" size={14}/>)}
                        {!action.divider &&
                            (action as any).shortcut &&
                            (typeof (action as any).shortcut === 'string' ? (<span className="text-[10px] text-[var(--color-textSecondary)] font-medium ml-2">
                              {(action as any).shortcut}
                            </span>) : ((action as any).shortcut))}
                      </div>
                    </button>);
                })) : searchQuery ? (<div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-neutral-400">No results found</div>) : null}
            </div>

            {/* Search Bar at Bottom (Only show if NOT in input mode AND showSearch is true) */}
            {!isInputMode && showSearch && (<div className="px-2 pb-2 pt-1 mt-auto border-t border-slate-100 dark:border-white/5">
                <div className="relative flex items-center">
                  <FiSearch className="absolute left-2 text-[var(--color-iconDefault)]" size={12}/>
                  <input ref={searchInputRef} type="text" placeholder="Search actions..." className="w-full pl-7 pr-2 py-1 text-xs bg-slate-100 dark:bg-neutral-800 rounded-md border border-transparent focus:border-blue-500 dark:focus:border-neutral-500 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-neutral-500/30 outline-none text-slate-900 dark:text-neutral-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onClick={e => e.stopPropagation()} // Prevent menu from closing when clicking search input
                 autoFocus onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            setMenuFocusIndex(prev => filteredActions.length > 0 ? (prev + 1) % filteredActions.length : -1);
                        }
                        else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            setMenuFocusIndex(prev => filteredActions.length > 0 ? (prev - 1 + filteredActions.length) % filteredActions.length : -1);
                        }
                        else if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            const targetAction = filteredActions[menuFocusIndex];
                            if (targetAction && !targetAction.disabled && !targetAction.divider) {
                                targetAction.onSelect();
                                if (targetAction.key !== 'assign-hotkey' &&
                                    targetAction.key !== 'assign-shortcut' &&
                                    targetAction.key !== 'clear-hotkey') {
                                    if (targetAction.closeOnExecute !== false) {
                                        onClose();
                                    }
                                }
                            }
                        }
                        else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            onClose();
                        }
                    }}/>
                </div>
              </div>)}

            {/* Unified Conflict Link at Bottom Left */}
            {error && conflictId && !conflictId.endsWith('-reserved') && showAllHotkeysOption && (<div className="px-2 pb-2 pt-1 mt-auto border-t border-slate-100 dark:border-white/5 flex flex-col gap-1">
                <button onClick={e => {
                        e.stopPropagation();
                        if (conflictId)
                            setHighlightedCommandId(conflictId);
                    }} className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-slate-400 dark:text-neutral-400 hover:text-blue-500 hover:text-[var(--color-accentHover)] hover:bg-slate-50 dark:hover:bg-neutral-700/50 rounded-md transition-all group">
                  <FiExternalLink size={11} className="group-hover:scale-110 transition-transform"/>
                  <span className="font-medium">Open All Hotkeys Menu</span>
                </button>
              </div>)}
          </div>)}
      </div>)}

      {/* RIGHT PANEL (Side Expansion: Inputs or Custom Content) */}
      {(hotkeyInput || shortcutInput || rightPanelContent) && (<div className={`min-w-[220px] w-fit flex flex-col ${hasActions ? 'bg-slate-50/50 dark:bg-black/20 animate-in slide-in-from-left-4 duration-300 border-l border-slate-100 dark:border-white/10' : 'px-1'}`}>
          {/* Custom Right Panel Content */}
          {rightPanelContent && <div className="h-full flex flex-col">{rightPanelContent}</div>}

          {/* Hotkey Editor */}
          {hotkeyInput && (<div className="px-2 pb-2 flex flex-col h-full justify-between">
              <div className="flex flex-col gap-3">
                {/* True Unified Card (Big & Clean - Transparent) */}
                <div className={`flex flex-col rounded-lg overflow-hidden transition-all duration-200 ${shortcutConflict
                    ? 'border border-[var(--color-warning)]'
                    : error
                    ? 'border border-[var(--color-danger)]'
                    : ''}`}>
                  {/* Header with Clear Button */}
                  <div className="px-1 py-1.5 border-b border-[var(--color-borderDefault)] flex items-center justify-between overflow-hidden">
                    <div className="text-[10px] font-bold tracking-wider text-[var(--color-textPrimary)] leading-tight">
                      {hotkeyInput.value
                    ? `Assign a Keyboard Shortcut (${hotkeyInput.value})`
                    : isMac
                        ? 'Assign a Keyboard Shortcut (Meta / Ctrl + Key)'
                        : 'Assign a Keyboard Shortcut (Alt / Ctrl + Key)'}
                    </div>
                    {hotkeyInput.value && hotkeyInput.onClear && (<div className="flex items-center">
                        <button onClick={hotkeyInput.onClear} className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1.5 text-[10px] font-medium" title="Clear hotkey">
                        {hotkeyInput.isSaving && !hotkeyInput.value ? (<>
                            <span>Clearing...</span>
                            <FiLoader size={10} className="animate-spin"/>
                          </>) : (<>
                            <span>Clear</span>
                            <FiZapOff size={12}/>
                          </>)}
                        </button>
                      </div>)}
                  </div>

                  {/* Body (Input - Big & Clean) */}
                  <div className="relative min-h-[60px] flex items-center justify-center overflow-hidden transition-all duration-200">
                    <input ref={inputRef} type="text" data-is-hotkey-input="true" value={hotkeyInput.value} readOnly onKeyDown={hotkeyInput.onChange} autoFocus className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"/>

                    {/* Visual Content */}
                    <div className="relative z-0 pointer-events-none flex items-center justify-center p-3 whitespace-nowrap flex-nowrap overflow-visible">
                      {!hotkeyInput.value ? (<span className="text-[var(--color-textPlaceholder)] font-medium text-sm">
                          {isMac ? 'Press Meta / Ctrl + Key...' : 'Press Alt / Ctrl + Key...'}
                        </span>) : (<VisualKeyDisplay hotkey={hotkeyInput.value} size="lg"/>)}
                    </div>
                  </div>

                  {/* Footer (Error & Link - Minimalist) */}
                  {error && (<div className="px-3 py-2 border-t border-red-500/20 flex flex-col gap-1">
                      <div className="flex items-start gap-2 text-[var(--color-danger)]">
                        <FiZap size={12} className="shrink-0 mt-0.5"/>
                        <div className="text-[11px] font-medium leading-tight flex flex-wrap gap-x-1">
                          <span className="text-[var(--color-textSecondary)]">Conflict:</span>
                          <span className="text-[var(--color-textSecondary)]">{error}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-5">{/* Conflict link moved to actions panel */}</div>
                    </div>)}
                </div>
              </div>

              {hotkeyInput.isSaving ? (<div className="flex items-center gap-1.5 px-1 self-end mt-4">
                  {hotkeyInput.showSuccess ? (<>
                      <FiCheck size={12} className="text-[var(--color-success)]"/>
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        Saved: {hotkeyInput.showSuccess}
                      </span>
                    </>) : (<>
                      <FiLoader size={12} className="animate-spin text-[var(--color-accent)]"/>
                      <span className="text-[10px] font-medium text-[var(--color-accent)] whitespace-nowrap">
                        {hotkeyInput.isClearing ? 'Clearing...' : hotkeyInput.isUpdating ? 'Updating...' : 'Saving...'}
                      </span>
                    </>)}
                </div>) : (<div className="flex items-center gap-2 self-end px-1 mt-4">
                  <button onClick={e => {
                        e.stopPropagation();
                        hotkeyInput.onCancel();
                    }} className="rounded-xl border border-transparent hover:bg-[var(--color-hoverBg)] px-1 py-0.5 text-xs font-medium text-[var(--color-textSecondary)] transition-colors" title="Cancel">
                    Cancel
                  </button>
                  {/* Only show Overwrite button if error exists, onOverwrite is defined, AND it's NOT an extension/OS conflict */}
                  {error && hotkeyInput.onOverwrite && !conflictId?.endsWith('-reserved') ? (<button onClick={e => {
                            e.stopPropagation();
                            if (conflictId)
                                hotkeyInput.onOverwrite?.(conflictId);
                        }} className="rounded-md border border-[var(--color-borderActive)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-focusRing)] px-2 py-1 text-xs font-medium shadow-sm transition-colors" title="Overwrite existing assignment">
                      Overwrite
                    </button>) : (<button onClick={e => {
                            e.stopPropagation();
                            hotkeyInput.onSave();
                        }} disabled={!!error} className={`rounded-md border border-[var(--color-borderActive)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-focusRing)] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${error ? 'opacity-50 cursor-not-allowed grayscale' : ''}`} title="Save">
                      Save
                    </button>)}
                </div>)}
            </div>)}

          {/* Shortcut Editor */}
          {shortcutInput && (<div className="px-3 pb-3 flex flex-col h-full justify-between">
              <div className="flex flex-col gap-3">
                {/* True Unified Card (Standard Text - Transparent) */}
                <div className={`flex flex-col rounded-lg overflow-hidden transition-all duration-200 ${error
                    ? 'border border-red-500/50 dark:border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] animate-shake'
                    : ''}`}>
                  {/* Header */}
                  <div className="px-2 py-1 border-b border-[var(--color-borderDefault)] flex items-center justify-between">
                    <div className="text-[9px] font-semibold tracking-wider text-[var(--color-textPrimary)]">
                      Assign a Text Shortcut
                    </div>
                    {shortcutInput.value && shortcutInput.onClear && (<div className="flex items-center">
                        <button onClick={shortcutInput.onClear} className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1.5 text-[10px] font-medium" title="Clear shortcut">
                        {shortcutInput.isSaving && !shortcutInput.value ? (<>
                            <span>Clearing...</span>
                            <FiLoader size={10} className="animate-spin"/>
                          </>) : (<>
                            <span>Clear</span>
                            <FiZapOff size={12}/>
                          </>)}
                      </button>
                      </div>)}
                  </div>

                  {/* Body (Input - Standard Small) */}
                  <div className="p-2 flex items-center justify-center min-h-[85px] transition-all duration-200">
                    <input ref={shortcutInputRef} type="text" data-command-chain-shortcut-popup="true" value={normalizeShortcutTrigger(shortcutInput.value)} onChange={e => shortcutInput.onChange(e.target.value)} onKeyDown={e => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation?.();
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!error && !shortcutChecking && !shortcutChoicePending)
                            shortcutInput.onSave();
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        shortcutInput.onCancel();
                    }
                    if (e.key === 'Backspace' && !shortcutInput.value) {
                        e.preventDefault();
                        shortcutInput.onBackspaceEmpty?.();
                    }
                }} className="flex-1 min-w-0 bg-transparent py-1 text-center text-xs text-[var(--color-textPrimary)] outline-none px-1" placeholder="shortcut" autoFocus/>
                  </div>

                  {/* Footer (Error & Link - Minimalist) */}
                  {error && (shortcutConflict ? <div className="border-t border-[var(--color-borderDefault)] px-2 py-2 text-left text-xs leading-relaxed">
                    <div className="font-semibold text-[var(--color-danger)]">Command already assigned</div>
                    <div className="text-[var(--color-textSecondary)]">c_{normalizeShortcutTrigger(shortcutInput.value)} is already assigned to:</div>
                    <div className="text-[var(--color-textPrimary)]">{getShortcutConflictOwnerRows(shortcutConflict).rows.map(owner => `${owner.label}${owner.type ? ` · ${owner.type}` : ''}${owner.count > 1 ? ` ×${owner.count}` : ''}`).join(', ')}</div>
                    {shortcutChoiceError && <div className="mt-1 text-[var(--color-danger)]" role="alert">{shortcutChoiceError}</div>}
                  </div> : <div className="border-t border-[var(--color-borderDefault)] px-2 py-2 text-xs text-[var(--color-danger)]" role="alert">{error}</div>)}
                </div>
              </div>

              {shortcutInput.isSaving || shortcutChoicePending ? (<div className="flex items-center gap-1.5 px-1 self-end mt-4">
                  {shortcutInput.showSuccess ? (<>
                      <FiCheck size={12} className="text-[var(--color-success)]"/>
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        Saved: {shortcutInput.showSuccess}
                      </span>
                    </>) : (<>
                      <FiLoader size={12} className="animate-spin text-[var(--color-success)]"/>
                      <span className="text-[10px] font-medium text-[var(--color-success)] whitespace-nowrap">
                        {shortcutInput.isClearing
                            ? 'Clearing...'
                            : shortcutInput.isUpdating
                                ? 'Updating...'
                                : 'Saving...'}
                      </span>
                    </>)}
                </div>) : (<div className={`gap-2 px-1 mt-3 ${shortcutConflict ? 'flex flex-col items-stretch' : 'flex items-center self-end'}`}>
                  {shortcutConflict?.canShare ? (<button type="button" onClick={e => { e.stopPropagation(); void chooseShortcut('add'); }} className="rounded-md border border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] px-2 py-1.5 text-left text-xs text-[var(--color-textPrimary)] hover:border-[var(--color-focusRing)]">
                      <span className="block font-semibold">Assign to this item too</span><span className="block text-[var(--color-textSecondary)]">Keep existing assignments and add this item. You can then choose which item to open.</span>
                    </button>) : null}
                  {shortcutConflict ? (<button onClick={e => {
                            e.stopPropagation();
                            void chooseShortcut('overwrite');
                        }} className="rounded-md border border-[var(--color-warning)] bg-[var(--color-panelBg)] px-2 py-1.5 text-left text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]" title="Overwrite existing assignment">
                      <span className="block font-semibold">Overwrite</span><span className="block text-[var(--color-textSecondary)]">Remove existing assignments and use this command here.</span>
                    </button>) : (<button onClick={e => {
                            e.stopPropagation();
                            shortcutInput.onSave();
                        }} disabled={!!error || shortcutChecking || shortcutChoicePending} className={`rounded-md border border-[var(--color-borderActive)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-focusRing)] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${error ? 'opacity-50 cursor-not-allowed grayscale' : ''}`} title="Save">
                      Save
                    </button>)}
                  <button onClick={e => {
                        e.stopPropagation();
                        shortcutInput.onCancel();
                    }} className="rounded-xl border border-transparent hover:bg-[var(--color-hoverBg)] px-2 py-1 text-xs font-medium text-[var(--color-textSecondary)] transition-colors" title="Cancel">
                    Cancel
                  </button>
                </div>)}
            </div>)}
        </div>)}
    </div>, portalContainer || document.body);
};

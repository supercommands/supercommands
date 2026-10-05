import React from 'react';
import { useAppearance } from '@extension/ui';
import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useKeystrokeRecording } from '../../../shared-components/hotkeys';
import { useHotkeyValidation } from '../../../shared-components/hotkeys';
import { useShortcutValidation } from '../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../shared-components/shortcuts/core/shortcutDbData';
import { VisualKeyDisplay } from '../../../shared-components/hotkeys';
import { FiZapOff } from 'react-icons/fi';
import type { ShortcutAssignmentApproval } from '../../shortcuts/core/shortcutAssignmentTypes';
import { resolveShortcutAssignmentChoice } from '../../shortcuts/core/shortcutManager';
import { getShortcutConflictOwnerRows } from '../../shortcuts/ui/shortcutConflictDisplay';
import clsx from 'clsx';

const commandPopoverWidth = 320;
const commandPopoverGap = 8;
const commandPopoverThemeVars = [
    '--color-popupBg', '--color-hoverBg', '--color-selectedBg', '--color-textPrimary', '--color-textSecondary',
    '--color-borderDefault', '--color-borderActive', '--color-warning', '--color-danger',
    '--color-focusRing'
];

function getCommandPopoverTheme(anchor: HTMLElement): React.CSSProperties {
    const computed = window.getComputedStyle(anchor);
    return commandPopoverThemeVars.reduce<React.CSSProperties>((style, name) => {
        const value = computed.getPropertyValue(name).trim();
        if (value) (style as Record<string, string>)[name] = value;
        return style;
    }, {});
}

function getCommandPopoverPosition(anchor: HTMLElement, panel: HTMLElement | null) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(commandPopoverWidth, window.innerWidth - commandPopoverGap * 2);
    const height = panel?.offsetHeight || 0;
    const top = rect.bottom + commandPopoverGap + height > window.innerHeight && rect.top > height + commandPopoverGap
        ? rect.top - height - commandPopoverGap
        : rect.bottom + commandPopoverGap;
    return {
        top: Math.max(commandPopoverGap, Math.min(top, window.innerHeight - height - commandPopoverGap)),
        left: Math.max(commandPopoverGap, Math.min(rect.left, window.innerWidth - width - commandPopoverGap)),
        width,
    };
}
interface GridInputProps {
    itemId: string;
    initialValue: string;
    onSave: (value: string) => void;
    onCancel: () => void;
    onOverwrite: (value: string, conflictId: string) => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
    navigateOnCleanArrow?: boolean;
    onCommit?: () => void;
    requireModifierCombo?: boolean;
}
export const GridHotkeyInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite, onNavigateFromCleanEdit, navigateOnCleanArrow = true, onCommit, requireModifierCombo = false, }) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const { theme } = useAppearance();
    const { hotkey, setHotkey, captureHotkey } = useKeystrokeRecording(initialValue, isMac);
    const { validateHotkey } = useHotkeyValidation();
    const [error, setError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const input = inputRef.current;
        input?.focus();
        if (input) {
            const end = input.value.length;
            input.setSelectionRange(end, end);
        }
    }, []);
    // Real-time validation
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (hotkey && hotkey !== initialValue) {
                const res = await validateHotkey(hotkey, itemId);
                setError(res.errorMessage);
                setConflictId(res.conflictId);
            }
            else {
                setError(null);
                setConflictId(null);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [hotkey, itemId, initialValue, validateHotkey]);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        const arrowDeltas: Record<string, [
            number,
            number
        ]> = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };
        const arrowDelta = arrowDeltas[e.key];
        if (navigateOnCleanArrow &&
            arrowDelta &&
            hotkey === initialValue &&
            !e.altKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey &&
            onNavigateFromCleanEdit) {
            e.preventDefault();
            onNavigateFromCleanEdit(...arrowDelta);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (conflictId) {
                if (conflictId.endsWith('-reserved'))
                    return;
                onOverwrite(hotkey, conflictId);
            }
            else {
                onSave(hotkey);
            }
            onCommit?.();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
        }
        if (e.key === 'Tab' && !navigateOnCleanArrow && onNavigateFromCleanEdit) {
            e.preventDefault();
            if (conflictId) {
                if (conflictId.endsWith('-reserved'))
                    return;
                onOverwrite(hotkey, conflictId);
            }
            else {
                onSave(hotkey);
            }
            onNavigateFromCleanEdit(0, e.shiftKey ? -1 : 1);
            return;
        }
        if (requireModifierCombo && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                setHotkey('');
            }
            return;
        }
        captureHotkey(e);
    };
    return (<div className={clsx('w-full flex flex-col items-center justify-center relative transition-all duration-200', error ? 'min-h-[80px] py-2' : 'min-h-[40px]')}>
      <input ref={inputRef} type="text" data-is-hotkey-input="true" readOnly onKeyDown={handleKeyDown} onKeyUp={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }} onKeyPress={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }} onBlur={() => {
            if (!error)
                onSave(hotkey);
            else
                onCancel();
        }} className="absolute opacity-0 pointer-events-none"/>
      <div className={clsx('flex items-center justify-start px-2 w-full grow cursor-pointer py-1 ring-emerald-500/30 focus-within:ring-2 rounded', 'hover:bg-white/5')} onClick={() => inputRef.current?.focus()}>
        {hotkey ? (<VisualKeyDisplay hotkey={hotkey} variant="text"/>) : (<span className="text-xs font-normal text-[var(--color-textPlaceholder)]">Press Alt / Ctrl + Key...</span>)}
      </div>

      {error && (<div className={clsx('w-full px-2 mt-1.5 py-1.5 flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1 rounded border-2 z-50', 'bg-red-500/5 border-red-500/30')}>
          <div className="flex items-start gap-1 justify-center max-w-full">
            <FiZapOff size={11} className="text-red-500 shrink-0 mt-0.5"/>
            <div className="text-[10px] font-bold leading-tight text-center break-words">
              {(() => {
                const parts = error.split('"');
                if (parts.length >= 5) {
                    return (<span className={clsx('font-medium', 'text-[var(--color-textPrimary)]')}>
                      {parts[0]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[1]}"</span>
                      {parts[2]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[3]}"</span>
                      {parts[4]}
                    </span>);
                }
                return <span className="text-red-500 font-medium">{error}</span>;
            })()}
            </div>
          </div>
        </div>)}
    </div>);
};
export const GridCommandInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite, onNavigateFromCleanEdit, navigateOnCleanArrow = true, onCommit, }) => {
    const normalizedInitialValue = normalizeShortcutTrigger(initialValue || '');
    const [value, setValue] = useState(normalizedInitialValue);
    const { validateShortcut } = useShortcutValidation();
    const [error, setError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);
    const [assignmentConflict, setAssignmentConflict] = useState<{
        value: string;
        approval: ShortcutAssignmentApproval;
    } | null>(null);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0, width: commandPopoverWidth });
    const [popoverTheme, setPopoverTheme] = useState<React.CSSProperties>({});
    const valueRef = useRef(value);
    const popoverRef = useRef<HTMLDivElement>(null);
    valueRef.current = value;
    const inputRef = useRef<HTMLInputElement>(null);
    const showConflict = assignmentConflict?.value === value;
    const showFeedback = Boolean(error || showConflict);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    useLayoutEffect(() => {
        if (!showFeedback || !inputRef.current) return;
        const anchor = inputRef.current;
        const updatePosition = () => {
            setPopoverPosition(getCommandPopoverPosition(anchor, popoverRef.current));
            setPopoverTheme(getCommandPopoverTheme(anchor));
        };
        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(anchor);
        if (popoverRef.current) observer.observe(popoverRef.current);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [showFeedback, value, assignmentConflict]);
    useEffect(() => {
        if (!showConflict) return;
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (inputRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
            onCancel();
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showConflict, onCancel]);
    // Real-time validation
    useEffect(() => {
        let active = true;
        setAssignmentConflict(null);
        setActionError(null);
        setChecking(Boolean(value && value !== normalizedInitialValue));
        const timer = setTimeout(async () => {
            const fullVal = normalizeShortcutTrigger(value || '');
            const initialNormalized = normalizeShortcutTrigger(initialValue || '');
            if (fullVal && fullVal !== initialNormalized) {
                const res = await validateShortcut(fullVal, itemId);
                if (!active || valueRef.current !== value)
                    return;
                setError(res.errorMessage);
                setConflictId(res.conflictId);
                setAssignmentConflict(res.assignmentConflict ? { value, approval: res.assignmentConflict } : null);
            }
            else {
                setError(null);
                setConflictId(null);
            }
            if (active)
                setChecking(false);
        }, 200);
        return () => { active = false; clearTimeout(timer); };
    }, [value, itemId, initialValue, validateShortcut]);
    const handleFinish = () => {
        if (checking || saving || error || conflictId)
            return false;
        onSave(normalizeShortcutTrigger(value || ''));
        return true;
    };
    const chooseAssignment = async (mode: 'add' | 'overwrite') => {
        if (!assignmentConflict || assignmentConflict.value !== value || checking || saving)
            return;
        setSaving(true);
        try {
            await resolveShortcutAssignmentChoice(itemId, value, { ...assignmentConflict.approval, mode });
            onSave(value);
            onCommit?.();
        }
        catch (failure) {
            setActionError(failure instanceof Error ? failure.message : String(failure));
            const draft = value;
            const refreshed = await validateShortcut(draft, itemId);
            if (valueRef.current === draft) {
                setAssignmentConflict(refreshed.assignmentConflict ? { value: draft, approval: refreshed.assignmentConflict } : null);
                setConflictId(refreshed.conflictId);
            }
        }
        finally {
            setSaving(false);
        }
    };
    const ownerDisplay = showConflict ? getShortcutConflictOwnerRows(assignmentConflict.approval) : { count: 0, rows: [] };
    return (<div className="relative flex min-h-[40px] w-full items-center">
      <div className={clsx('flex items-center justify-start px-2 w-full grow cursor-pointer py-1 gap-0.5 rounded transition-all', 'hover:bg-[var(--color-hoverBg)]', showConflict && 'ring-1 ring-[var(--color-warning)]', error && !showConflict && 'ring-1 ring-[var(--color-danger)]')} onClick={() => inputRef.current?.focus()}>
        <div className={clsx('flex items-center w-full font-medium text-[11px] max-w-full overflow-hidden', 'text-[var(--color-textPrimary)]')}>
          <input ref={inputRef} type="text" value={value} autoFocus aria-invalid={Boolean(error && !showConflict)} aria-describedby={showFeedback ? `command-feedback-${itemId}` : undefined} onChange={e => { setValue(normalizeShortcutTrigger(e.target.value)); setAssignmentConflict(null); setChecking(true); setError(null); setActionError(null); setConflictId(null); }} onBlur={() => {
            if (!error)
                handleFinish();
            else if (!assignmentConflict)
                onCancel();
        }} onKeyDown={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            const arrowDeltas: Record<string, [
                number,
                number
            ]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
            };
            const arrowDelta = arrowDeltas[e.key];
            if (navigateOnCleanArrow &&
                arrowDelta &&
                normalizeShortcutTrigger(value || '') === normalizeShortcutTrigger(initialValue || '') &&
                onNavigateFromCleanEdit) {
                e.preventDefault();
                onNavigateFromCleanEdit(...arrowDelta);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (handleFinish())
                    onCommit?.();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
            if (e.key === 'Tab' && showConflict) {
                e.preventDefault();
                popoverRef.current?.querySelector('button')?.focus();
                return;
            }
            if (e.key === 'Tab' && !navigateOnCleanArrow && onNavigateFromCleanEdit) {
                e.preventDefault();
                if (handleFinish())
                    onNavigateFromCleanEdit(0, e.shiftKey ? -1 : 1);
            }
        }} onKeyUp={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }} onKeyPress={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }} placeholder="cmd" className={clsx('bg-transparent outline-none border-none focus:ring-0 p-0 min-w-[30px] w-full max-w-full text-left', 'text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)]')}/>
        </div>
      </div>

      {showFeedback && typeof document !== 'undefined' && createPortal(<div ref={popoverRef} id={`command-feedback-${itemId}`} role={showConflict ? 'group' : 'alert'} aria-label={showConflict ? 'Text command assignment choices' : 'Text command error'} data-ignore-grid-nav="true" data-todo-local-escape="true" onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => event.stopPropagation()} onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
          if (event.key === 'Tab') {
            const buttons = Array.from(popoverRef.current?.querySelectorAll('button:not(:disabled)') || []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if ((event.shiftKey && current === 0) || (!event.shiftKey && current === buttons.length - 1)) {
              event.preventDefault();
              inputRef.current?.focus();
            }
          }
        }} style={{ position: 'fixed', ...popoverPosition, maxHeight: `calc(100vh - ${commandPopoverGap * 2}px)`, overflowY: 'auto', zIndex: 99999, ...popoverTheme }} className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-3 text-left text-[var(--color-textPrimary)] shadow-2xl">
        {showConflict ? <>
          <div className="text-xs font-semibold text-[var(--color-danger)]">Command already assigned</div>
          <div className="mt-1 text-xs leading-relaxed text-[var(--color-textSecondary)]"><span className="font-medium text-[var(--color-textPrimary)]">c_{normalizeShortcutTrigger(value)}</span> is already assigned to:</div>
          <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs text-[var(--color-textPrimary)]">
            {ownerDisplay.rows.map(owner => <li key={`${owner.label}-${owner.type}`} className="truncate" title={owner.label}>{owner.label}<span className="text-[var(--color-textSecondary)]">{owner.type ? ` · ${owner.type}` : ''}{owner.count > 1 ? ` ×${owner.count}` : ''}</span></li>)}
          </ul>
          {actionError && <p className="mt-2 text-xs text-[var(--color-danger)]" role="alert">{actionError}</p>}
          <div className="mt-3 space-y-1.5">
            {assignmentConflict.approval.canShare && <button type="button" disabled={saving || checking} onClick={() => void chooseAssignment('add')} className="w-full rounded-md border border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] px-2.5 py-2 text-left text-xs hover:bg-[var(--color-selectedBg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><span className="block font-semibold">Assign to this item too</span><span className="block font-normal text-[var(--color-textSecondary)]">Keep existing assignments and add this item. You can then choose which item to open.</span></button>}
            <button type="button" disabled={saving || checking} onClick={() => void chooseAssignment('overwrite')} className="w-full rounded-md border border-[var(--color-warning)] px-2.5 py-2 text-left text-xs hover:bg-[var(--color-hoverBg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><span className="block font-semibold">Overwrite</span><span className="block font-normal text-[var(--color-textSecondary)]">Remove {ownerDisplay.count === 1 ? 'the existing assignment' : `all ${ownerDisplay.count} existing assignments`} and assign the command here.</span></button>
          </div>
          <button type="button" disabled={saving} onClick={onCancel} className="mt-2 rounded px-2 py-1 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Cancel</button>
        </> : <p className="text-xs leading-relaxed text-[var(--color-danger)]">{error}</p>}
      </div>, document.body)}
    </div>);
};

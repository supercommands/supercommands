import * as React from 'react';
import { CUnderscoreIcon } from '../icons/cUnderscoreIcon';
import { useShortcutValidation } from '../shortcuts/hooks/useShortcutValidation';
import { getAllUserShortcuts, normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { extractSnippetIdFromCompoundId } from '../utils/idGenerator';
import type { ShortcutAssignmentApproval } from '../shortcuts/core/shortcutAssignmentTypes';
import { getShortcutConflictOwnerRows } from '../shortcuts/ui/shortcutConflictDisplay';
export interface EditorTitleShortcutInputProps {
    title: string;
    setTitle: (val: string) => void;
    shortcut?: string;
    setShortcut?: (val: string) => void;
    showShortcut?: boolean;
    titlePlaceholder?: string;
    shortcutPlaceholder?: string;
    shortcutLabel?: string;
    titleRef?: React.RefObject<HTMLInputElement | null>;
    shortcutRef?: React.RefObject<HTMLInputElement | null>;
    titleLeadingElement?: React.ReactNode;
    onTitleBlur?: () => void;
    onShortcutBlur?: () => void;
    onTitleEnter?: (shiftKey?: boolean, event?: React.KeyboardEvent<HTMLInputElement>) => void;
    onShortcutEnter?: () => void;
    onArrowDownPress?: () => void;
    onCopyTitleToShortcut?: () => void;
    onOverrideShortcut?: () => void;
    isOverrideable?: boolean;
    shortcutReferenceId?: string;
    onResolveShortcut?: (approval: ShortcutAssignmentApproval) => Promise<void>;
    readShortcuts?: () => Promise<Record<string, string>>;
    titleError?: string | boolean | null;
    shortcutError?: string | null;
    layout?: 'row' | 'column';
}
export const EditorTitleShortcutInput: React.FC<EditorTitleShortcutInputProps> = ({ title, setTitle, shortcut = '', setShortcut, showShortcut = true, titlePlaceholder = 'Title', shortcutPlaceholder = 'Command Shortcut', shortcutLabel = 'Command Shortcut', titleRef, shortcutRef, titleLeadingElement, onTitleBlur, onShortcutBlur, onTitleEnter, onShortcutEnter, onArrowDownPress, onCopyTitleToShortcut, onOverrideShortcut, isOverrideable, shortcutReferenceId = 'new', onResolveShortcut, readShortcuts, titleError, shortcutError, layout = 'row', }) => {
    const { validateShortcut } = useShortcutValidation({ readShortcuts });
    const [check, setCheck] = React.useState<{
        value: string;
        conflict?: ShortcutAssignmentApproval;
        error: string | null;
    } | null>(null);
    const [pending, setPending] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    React.useEffect(() => {
        let active = true;
        setCheck(null);
        setSaveError(null);
        if (!onResolveShortcut)
            return;
        void validateShortcut(shortcut, shortcutReferenceId).then(result => {
            if (active)
                setCheck({ value: shortcut, conflict: result.assignmentConflict, error: result.errorMessage });
        });
        return () => { active = false; };
    }, [shortcut, shortcutReferenceId, validateShortcut, Boolean(onResolveShortcut)]);
    const currentCheck = check?.value === shortcut ? check : null;
    const conflict = currentCheck?.conflict;
    const shownError = onResolveShortcut ? saveError || currentCheck?.error : shortcutError;
    const resolveShortcut = async (mode: 'add' | 'overwrite') => {
        if (!conflict || !onResolveShortcut || pending)
            return;
        setPending(true);
        setSaveError(null);
        try {
            await onResolveShortcut({ ...conflict, mode });
            const result = await validateShortcut(shortcut, shortcutReferenceId);
            setCheck({ value: shortcut, conflict: result.assignmentConflict, error: result.errorMessage });
        }
        catch (failure) {
            setSaveError(failure instanceof Error ? failure.message : String(failure));
            const result = await validateShortcut(shortcut, shortcutReferenceId);
            setCheck({ value: shortcut, conflict: result.assignmentConflict, error: result.errorMessage });
        }
        finally {
            setPending(false);
        }
    };
    const cancelShortcut = async () => {
        setPending(true);
        try {
            const entries = readShortcuts ? Object.entries(await readShortcuts())
                : (await getAllUserShortcuts()).map(record => [record.referenceId, record.trigger]);
            const original = entries.find(([reference]) => extractSnippetIdFromCompoundId(reference) === extractSnippetIdFromCompoundId(shortcutReferenceId));
            setShortcut?.((original?.[1] || '').replace(/^\/+/, ''));
        }
        catch (failure) {
            setSaveError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            setPending(false);
        }
    };
    const conflictOwners = conflict ? getShortcutConflictOwnerRows(conflict) : null;
    const shortcutErrorContent = shownError ? (<>
      {conflict && onResolveShortcut ? <div className="min-w-0 text-left text-xs leading-relaxed">
        <div className="font-semibold text-[var(--color-danger)]">Command already assigned</div>
        <div className="text-[var(--color-textSecondary)]">c_{normalizeShortcutTrigger(shortcut)} is already assigned to:</div>
        <div className="text-[var(--color-textPrimary)]">{conflictOwners?.rows.map(owner => `${owner.label}${owner.type ? ` · ${owner.type}` : ''}${owner.count > 1 ? ` ×${owner.count}` : ''}`).join(', ')}</div>
        {saveError && <div className="mt-1 text-[var(--color-danger)]" role="alert">{saveError}</div>}
      </div> : <span className="min-w-0 text-left text-xs leading-snug text-[var(--color-danger)] break-words" role="alert">{shownError}</span>}
      {conflict && onResolveShortcut ? <div className="flex flex-wrap items-start gap-2">
        {(['cancel', ...(conflict.canShare ? ['add'] : []), 'overwrite'] as const).map(mode => <button key={mode} type="button" disabled={pending} onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (mode === 'cancel')
                        void cancelShortcut();
                    else
                        void resolveShortcut(mode as 'add' | 'overwrite');
                }} className={`cursor-pointer select-none rounded-md border bg-[var(--color-hoverBg)] px-2 py-1 text-left text-xs text-[var(--color-textPrimary)] transition-all disabled:opacity-50 ${mode === 'overwrite' ? 'border-[var(--color-warning)]' : 'border-[var(--color-borderDefault)]'}`}>
            <span className="block font-semibold">{mode === 'cancel' ? 'Cancel' : mode === 'add' ? 'Assign to this item too' : 'Overwrite'}</span>
            {mode !== 'cancel' && <span className="block font-normal text-[var(--color-textSecondary)]">{mode === 'add' ? 'Keep existing assignments and add this item. You can then choose which item to open.' : 'Remove existing assignments and use this command here.'}</span>}
          </button>)}
      </div> : isOverrideable && onOverrideShortcut && !onResolveShortcut && (<button type="button" onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }} onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOverrideShortcut();
            }} className="shrink-0 cursor-pointer select-none rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-all" title="Reassign shortcut to this item">
          Overwrite
        </button>)}
    </>) : null;
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;
            if (isCmdOrCtrl && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (onTitleEnter) {
                    onTitleEnter(true, e);
                }
            }
            else if (!isCmdOrCtrl) {
                e.preventDefault();
                e.stopPropagation();
                if (onTitleEnter) {
                    onTitleEnter(false, e);
                }
            }
        }
        else if (e.key === 'ArrowRight' && showShortcut) {
            const el = titleRef?.current;
            if (el && el.selectionStart === el.value.length) {
                shortcutRef?.current?.focus();
                setTimeout(() => {
                    if (shortcutRef?.current) {
                        const len = shortcutRef.current.value.length;
                        shortcutRef.current.setSelectionRange(len, len);
                    }
                }, 0);
            }
        }
        else if (e.key === 'ArrowDown') {
            if (onArrowDownPress) {
                e.preventDefault();
                onArrowDownPress();
            }
        }
    };
    const handleShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (onResolveShortcut && (pending || !currentCheck || shownError))
                return;
            if (onShortcutEnter) {
                onShortcutEnter();
            }
        }
        else if (e.key === 'ArrowLeft') {
            const el = shortcutRef?.current;
            if (el && el.selectionStart === 0) {
                titleRef?.current?.focus();
                setTimeout(() => {
                    if (titleRef?.current) {
                        const len = titleRef.current.value.length;
                        titleRef.current.setSelectionRange(len, len);
                    }
                }, 0);
            }
        }
        else if (e.key === 'ArrowDown') {
            if (onArrowDownPress) {
                e.preventDefault();
                onArrowDownPress();
            }
        }
    };
    return (<div className={`flex flex-shrink-0 relative z-10 py-0.5 w-full pb-1.5 ${layout === 'column' ? 'flex-col items-stretch gap-3' : 'items-center gap-4'}`}>
      <div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
        <label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center justify-start gap-2 w-full">
          <div className="flex items-center gap-1 whitespace-nowrap">
            Title <span className="text-red-500">*</span>
          </div>
          {titleError && (<span className="text-[10px] text-red-500 font-medium truncate flex-1 text-left">
              {typeof titleError === 'string' ? titleError : 'Enter the title'}
            </span>)}
        </label>
        <div className="flex-1 relative rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3.5 py-1.5 flex items-center gap-2 shadow-sm">
          {titleLeadingElement}
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={onTitleBlur} onKeyDown={handleTitleKeyDown} type="text" placeholder={titlePlaceholder} className="w-full text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0"/>
        </div>
      </div>

      {showShortcut && setShortcut && (<div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
          {layout === 'column' ? (<div className="flex flex-col gap-1.5 w-full px-3.5">
              <div className="flex items-center justify-start gap-2 w-full min-w-0">
                <label className="text-xs font-semibold text-[var(--color-textSecondary)] whitespace-nowrap shrink-0">
                  {shortcutLabel}
                </label>
                
              </div>
            </div>) : (<label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center justify-start gap-2 w-full min-w-0">
              <span className="whitespace-nowrap shrink-0">{shortcutLabel}</span>
              
            </label>)}
          <div className="flex-1 relative rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3.5 py-1.5 flex items-center shadow-sm">
            <CUnderscoreIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none"/>
            <input ref={shortcutRef} disabled={pending} value={shortcut} onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                setShortcut(val);
            }} onBlur={onShortcutBlur} onKeyDown={handleShortcutKeyDown} type="text" placeholder={shortcutPlaceholder} className="w-full text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0 pl-6"/>
          </div>
          {shortcutErrorContent && <div className="flex flex-col gap-1.5 px-3.5 min-w-0">{shortcutErrorContent}</div>}
        </div>)}
    </div>);
};

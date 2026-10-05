/**
 * @file autoSave.tsx
 * @description Provides the AutoSaveIndicator component, which renders a visual status
 * representation (idle, saving, saved/success, error, or conflict) of the auto-save progress.
 * It shows dynamic relative time updates based on when the document/object was last saved.
 */
import * as React from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import { useRelativeSavedTime } from '../utils';
export interface AutoSaveIndicatorProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'success';
    lastSavedAt: Date | null | undefined;
    saveError?: string | null;
    className?: string;
    isDirty?: boolean;
    activeId?: string | null;
    variant?: 'editor' | 'compact';
}
export function AutoSaveIndicator({ saveStatus, lastSavedAt, saveError, className = '', isDirty = false, activeId, variant = 'editor', }: AutoSaveIndicatorProps) {
    const lastSavedMessage = useRelativeSavedTime(lastSavedAt);
    const [hasChanges, setHasChanges] = React.useState(false);
    const prevIdRef = React.useRef<string | null | undefined>(activeId);
    const [showSaved, setShowSaved] = React.useState(true);
    const compact = variant === 'compact';
    const statusClass = (editorClass: string) => `${compact ? 'auto-save-indicator--compact' : editorClass} ${className}`;
    React.useEffect(() => {
        if (saveStatus === 'saved' || saveStatus === 'success') {
            setShowSaved(true);
            const timer = setTimeout(() => {
                setShowSaved(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
        else {
            setShowSaved(true);
            return undefined;
        }
    }, [saveStatus, lastSavedAt]);
    // Reset change tracker if we switch to a different item
    if (activeId !== prevIdRef.current) {
        const wasExistingItem = prevIdRef.current !== undefined && prevIdRef.current !== null && prevIdRef.current !== '' && prevIdRef.current !== 'new';
        prevIdRef.current = activeId;
        if (wasExistingItem) {
            setHasChanges(false);
        }
    }
    // Set hasChanges to true if item becomes dirty or starts saving
    React.useEffect(() => {
        if (isDirty || saveStatus === 'saving') {
            setHasChanges(true);
        }
    }, [isDirty, saveStatus]);
    // If there's an error, prioritize showing it
    if (saveStatus === 'error') {
        return (<span data-save-status="error" className={statusClass('mr-[calc(theme(spacing.14)+60px)] text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1 whitespace-nowrap')}>
        {saveError || 'Save Failed'} <FaTimes className="opacity-70 text-xs"/>
      </span>);
    }
    if (saveStatus === 'conflict') {
        return (<span data-save-status="conflict" className={statusClass('mr-[calc(theme(spacing.14)+60px)] text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap')}>
        Conflict <FaTimes className="opacity-70 text-xs"/>
      </span>);
    }
    // Handle saving status
    if (saveStatus === 'saving') {
        return (<span data-save-status="saving" className={statusClass('mr-[calc(theme(spacing.14)+60px)] text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap')}>
        Saving...
      </span>);
    }
    // Handle saved status
    if ((saveStatus === 'saved' || saveStatus === 'success') && (hasChanges || compact) && showSaved) {
        return (<span data-save-status="saved" className={statusClass('mr-[calc(theme(spacing.14)+60px)] text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5 whitespace-nowrap')}>
        <FaCheckCircle className={compact ? 'auto-save-indicator__saved-icon' : 'opacity-70 text-xs text-emerald-500'}/> {lastSavedMessage}
      </span>);
    }
    return null;
}

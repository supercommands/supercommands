/**
 * @file autoSave.tsx
 * @description Provides the AutoSaveIndicator component, which renders a visual status
 * representation (idle, saving, saved/success, error, or conflict) of the auto-save progress.
 * It shows dynamic relative time updates based on when the document/object was last saved.
 */

import * as React from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
import { useRelativeSavedTime } from '../utils';

export interface AutoSaveIndicatorProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'success';
  lastSavedAt: Date | null | undefined;
  saveError?: string | null;
  className?: string;
  isDirty?: boolean;
  activeId?: string | null;
}

export function AutoSaveIndicator({
  saveStatus,
  lastSavedAt,
  saveError,
  className = '',
  isDirty = false,
  activeId,
}: AutoSaveIndicatorProps) {
  const lastSavedMessage = useRelativeSavedTime(lastSavedAt);
  const [hasChanges, setHasChanges] = React.useState(false);
  const prevIdRef = React.useRef<string | null | undefined>(activeId);

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
    return (
      <span className={`text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1 whitespace-nowrap ${className}`}>
        {saveError || 'Save Failed'} <FaTimes className="opacity-70 text-xs" />
      </span>
    );
  }

  if (saveStatus === 'conflict') {
    return (
      <span className={`text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap ${className}`}>
        Conflict <FaTimes className="opacity-70 text-xs" />
      </span>
    );
  }

  // Handle saving status
  if (saveStatus === 'saving') {
    return (
      <span className={`text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap ${className}`}>
        <FiLoader className="animate-spin text-xs opacity-70" /> Saving...
      </span>
    );
  }



  // Handle saved status
  if ((saveStatus === 'saved' || saveStatus === 'success') && hasChanges) {
    return (
      <span className={`text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5 whitespace-nowrap ${className}`}>
        <FaCheckCircle className="opacity-70 text-xs text-emerald-500" /> {lastSavedMessage}
      </span>
    );
  }

  return null;
}

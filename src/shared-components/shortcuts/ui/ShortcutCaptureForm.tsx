import React, { useRef, useEffect } from 'react';
import { FiLoader, FiCheck, FiZap, FiZapOff } from 'react-icons/fi';
import { normalizeShortcutTrigger } from '../core/shortcutDbData';

export interface ShortcutCaptureFormProps {
  shortcutInput: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
    isUpdating?: boolean;
    isClearing?: boolean;
    onClear?: () => void;
    onOverwrite?: (conflictId: string) => void;
    showSuccess?: string | null;
  };
  error?: string;
  conflictId?: string;
}

const ShortcutCaptureForm: React.FC<ShortcutCaptureFormProps> = ({
  shortcutInput,
  error,
  conflictId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when component mounts
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  return (
    <div className="px-3 pb-3 flex flex-col h-full justify-between">
      <div className="flex flex-col gap-3">
        {/* True Unified Card (Big & Clean - Transparent) */}
        <div
          className={`flex flex-col rounded-lg overflow-hidden border transition-all duration-200 ${
            error
              ? 'border-red-500/50 dark:border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] animate-shake'
              : 'border-[var(--color-borderDefault)] focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accentBg)]'
          }`}>
          {/* Header with Clear Button */}
          <div className="px-1 py-1.5 border-b border-[var(--color-borderDefault)] flex items-center justify-between overflow-hidden">
            <div className="text-[10px] font-bold tracking-wider text-[var(--color-textPrimary)] truncate pr-2">
              {shortcutInput.value
                ? `Assign a Text Shortcut (${normalizeShortcutTrigger(shortcutInput.value)})`
                : 'Assign a Text Shortcut (command)'}
            </div>
            {shortcutInput.value && shortcutInput.onClear && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  shortcutInput.onClear?.();
                }}
                disabled={shortcutInput.isSaving}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1 rounded-md hover:bg-red-500/10 flex items-center gap-1.5 text-[10px] font-medium"
                title="Clear Text Shortcut">
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
            )}
          </div>

          {/* Body (Input - Big & Clean) */}
          <div className="relative min-h-[85px] flex items-center justify-center overflow-hidden transition-all duration-200 bg-[var(--color-panelBg)] p-3">
            <div className="flex items-center w-full max-w-[200px] border-b-2 focus-within:border-[var(--color-accent)] border-[var(--color-borderDefault)] pb-1 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={normalizeShortcutTrigger(shortcutInput.value)}
                onChange={shortcutInput.onChange}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (error && conflictId && shortcutInput.onOverwrite) {
                      shortcutInput.onOverwrite(conflictId);
                    } else if (!error) {
                      shortcutInput.onSave();
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    shortcutInput.onCancel();
                  }
                }}
                placeholder="type shortcut..."
                className="w-full bg-transparent border-none outline-none text-lg font-medium text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)]"
              />
            </div>
          </div>

          {/* Footer (Error & Link - Minimalist) */}
          {error && (
            <div className="px-3 py-2 border-t border-red-500/20 flex flex-col gap-1 bg-red-500/5">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <FiZap size={12} className="shrink-0 mt-0.5" />
                <div className="text-[11px] font-medium leading-tight flex flex-wrap gap-x-1">
                  <span className="text-[var(--color-textSecondary)]">Conflict:</span>
                  {(() => {
                    const parts = error.split('"');
                    if (parts.length >= 5) {
                      const hotkeyValue = parts[1];
                      const isAlreadyAssigned = parts[2];
                      const itemName = parts[3];
                      return (
                        <>
                          <span className="text-red-600 dark:text-red-400 font-bold">"{hotkeyValue}"</span>
                          <span className="text-[var(--color-textSecondary)]">{isAlreadyAssigned}</span>
                          <span className="text-red-600 dark:text-red-400 font-bold">"{itemName}"</span>
                        </>
                      );
                    }
                    return <span className="text-[var(--color-textSecondary)]">{error}</span>;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save / Actions Footer */}
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
              <FiLoader size={12} className="animate-spin text-[var(--color-accent)]" />
              <span className="text-[10px] font-medium text-[var(--color-accent)] whitespace-nowrap">
                {shortcutInput.isClearing ? 'Clearing...' : shortcutInput.isUpdating ? 'Updating...' : 'Saving...'}
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
            className="rounded-xl border border-transparent hover:bg-[var(--color-panelBg)] px-1 py-0.5 text-xs font-medium text-[var(--color-textSecondary)] transition-colors"
            title="Cancel">
            Cancel
          </button>
          {error && shortcutInput.onOverwrite && conflictId !== 'extension-reserved' ? (
            <button
              onClick={e => {
                e.stopPropagation();
                if (conflictId) shortcutInput.onOverwrite?.(conflictId);
              }}
              className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-accent)] px-2 py-1 text-xs font-medium shadow-sm transition-colors"
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
              className={`rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-accent)] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${
                error ? 'opacity-50 cursor-not-allowed grayscale' : ''
              }`}
              title="Save">
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export { ShortcutCaptureForm };

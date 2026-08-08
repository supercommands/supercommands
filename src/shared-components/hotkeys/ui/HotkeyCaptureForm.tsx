import * as React from 'react';
import { useRef, useEffect } from 'react';
import { FiLoader, FiCheck, FiZap, FiZapOff } from 'react-icons/fi';
import { VisualKeyDisplay } from './VisualKeyDisplay';

export interface HotkeyCaptureFormProps {
  hotkeyInput: {
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
  isMac: boolean;
  error?: string;
  conflictId?: string;
}

export const HotkeyCaptureForm: React.FC<HotkeyCaptureFormProps> = ({
  hotkeyInput,
  isMac,
  error,
  conflictId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when component mounts or value changes
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [hotkeyInput.value]);

  return (
    <div className="px-3 pb-3 flex flex-col h-full justify-between">
      <div className="flex flex-col gap-3">
        {/* True Unified Card (Big & Clean - Transparent) */}
        <div
          className={`flex flex-col rounded-lg overflow-hidden border transition-all duration-200 ${error
              ? 'border-[var(--color-danger)] shadow-[0_0_0_1px_var(--color-dangerBg)] animate-shake'
              : 'border-[var(--color-borderDefault)] focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accentBg)]'
            }`}>
          {/* Header with Clear Button */}
          <div className="px-1 py-1.5 border-b border-[var(--color-borderDefault)] flex items-center justify-between overflow-hidden">
            <div className="text-[10px] font-bold tracking-wider text-[var(--color-textPrimary)] truncate pr-2">
              {hotkeyInput.value
                ? `Assign a Keyboard Shortcut (${hotkeyInput.value})`
                : isMac
                  ? 'Assign a Keyboard Shortcut (Meta / Ctrl + Key)'
                  : 'Assign a Keyboard Shortcut (Alt / Ctrl + Key)'}
            </div>
            {hotkeyInput.value && hotkeyInput.onClear && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  hotkeyInput.onClear?.();
                }}
                disabled={hotkeyInput.isSaving}
                className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1.5 text-[10px] font-medium"
                title="Clear Keyboard Shortcut">
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
            )}
          </div>

          {/* Body (Input - Big & Clean) */}
          <div className="relative min-h-[85px] flex items-center justify-center overflow-hidden transition-all duration-200">
            <input
              ref={inputRef}
              type="text"
              data-is-hotkey-input="true"
              value={hotkeyInput.value}
              readOnly
              onKeyDown={hotkeyInput.onChange}
              autoFocus
              className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
            />

            {/* Visual Content */}
            <div className="relative z-0 pointer-events-none flex items-center justify-center p-3 whitespace-nowrap flex-nowrap overflow-visible">
              {!hotkeyInput.value ? (
                <span className="text-[var(--color-textPlaceholder)] font-medium text-sm">
                  {isMac ? 'Press Meta / Ctrl + Key...' : 'Press Alt / Ctrl + Key...'}
                </span>
              ) : (
                <VisualKeyDisplay hotkey={hotkeyInput.value} size="lg" />
              )}
            </div>
          </div>

          {/* Footer (Error & Link - Minimalist) */}
          {error && (
            <div className="px-3 py-2 border-t border-[var(--color-dangerBg)] flex flex-col gap-1">
              <div className="flex items-start gap-2 text-[var(--color-danger)]">
                <FiZap size={12} className="shrink-0 mt-0.5" />
                <div className="text-[11px] font-medium leading-tight flex flex-wrap gap-x-1">
                  <span className="text-[var(--color-textSecondary)]">Conflict:</span>
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
                      else if (typeRaw === 'snippet') typeDisplay = 'Text Expander';
                      else if (false) typeDisplay = 'Tab Session';
                     
                      else if (typeRaw === 'command') typeDisplay = 'Command';
                      else if (typeRaw) typeDisplay = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1);

                      return (
                        <>
                          <span className="text-[var(--color-danger)] font-bold">"{hotkeyValue}"</span>
                          <span className="text-[var(--color-textSecondary)]">{isAlreadyAssigned}</span>
                          <span className="text-[var(--color-danger)] font-bold">"{itemName}"</span>
                        </>
                      );
                    }
                    return <span className="text-[var(--color-textSecondary)]">{error}</span>;
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
            className="rounded-xl border border-transparent hover:bg-[var(--color-panelBg)] px-1 py-0.5 text-xs font-medium text-[var(--color-textSecondary)] transition-colors"
            title="Cancel">
            Cancel
          </button>
          {error && hotkeyInput.onOverwrite && !conflictId?.endsWith('-reserved') ? (
            <button
              onClick={e => {
                e.stopPropagation();
                if (conflictId) hotkeyInput.onOverwrite?.(conflictId);
              }}
              className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-accent)] px-2 py-1 text-xs font-medium shadow-sm transition-colors"
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
              className={`rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] text-[var(--color-textPrimary)] hover:border-[var(--color-accent)] px-2 py-1 text-xs font-medium shadow-sm transition-colors ${error ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
              title="Save">
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
};

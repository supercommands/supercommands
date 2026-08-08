import type * as React from 'react';
import { useAppearance } from '@extension/ui';
import { useEffect, useState, useRef } from 'react';
import { useKeystrokeRecording } from '../../../shared-components/hotkeys';
import { useHotkeyValidation } from '../../../shared-components/hotkeys';
import { useShortcutValidation } from '../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../shared-components/shortcuts/core/shortcutDbData';
import { VisualKeyDisplay } from '../../../shared-components/hotkeys';
import { FiZapOff } from 'react-icons/fi';

import clsx from 'clsx';

interface GridInputProps {
  itemId: string;
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  onOverwrite: (value: string, conflictId: string) => void;
}

export const GridHotkeyInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite }) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { theme } = useAppearance();
    const { hotkey, setHotkey, captureHotkey } = useKeystrokeRecording(initialValue, isMac);
  const { validateHotkey } = useHotkeyValidation();
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Real-time validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (hotkey && hotkey !== initialValue) {
        const res = await validateHotkey(hotkey, itemId);
        setError(res.errorMessage);
        setConflictId(res.conflictId);
      } else {
        setError(null);
        setConflictId(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hotkey, itemId, initialValue, validateHotkey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      if (conflictId) {
        if (conflictId.endsWith('-reserved')) return;
        onOverwrite(hotkey, conflictId);
      } else {
        onSave(hotkey);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    captureHotkey(e);
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center relative transition-all duration-200',
        error ? 'min-h-[80px] py-2' : 'min-h-[40px]',
      )}>
      <input
        ref={inputRef}
        type="text"
        data-is-hotkey-input="true"
        readOnly
        onKeyDown={handleKeyDown}
        onKeyUp={e => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        onKeyPress={e => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        onBlur={() => {
          if (!error) onSave(hotkey);
          else onCancel();
        }}
        className="absolute opacity-0 pointer-events-none"
      />
      <div
        className={clsx(
          'flex items-center justify-start px-2 w-full grow cursor-pointer py-1 ring-emerald-500/30 focus-within:ring-2 rounded',
          'hover:bg-white/5',
        )}
        onClick={() => inputRef.current?.focus()}>
        {hotkey ? (
          <VisualKeyDisplay hotkey={hotkey} variant="text" />
        ) : (
          <span
            className={clsx(
              'text-[11px] font-bold tracking-wider px-2 py-0.5 rounded transition-all shadow-sm',
              'bg-emerald-500/20 text-emerald-400',
            )}>
            Set
          </span>
        )}
      </div>

      {error && (
        <div
          className={clsx(
            'w-full px-2 mt-1.5 py-1.5 flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1 rounded border-2 z-50',
            'bg-red-500/5 border-red-500/30',
          )}>
          <div className="flex items-start gap-1 justify-center max-w-full">
            <FiZapOff size={11} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[10px] font-bold leading-tight text-center break-words">
              {(() => {
                const parts = error.split('"');
                if (parts.length >= 5) {
                  return (
                    <span className={clsx('font-medium', 'text-neutral-300')}>
                      {parts[0]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[1]}"</span>
                      {parts[2]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[3]}"</span>
                      {parts[4]}
                    </span>
                  );
                }
                return <span className="text-red-500 font-medium">{error}</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const GridCommandInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite }) => {
  const { theme } = useAppearance();
  const normalizedInitialValue = normalizeShortcutTrigger(initialValue || '');
  const [value, setValue] = useState(normalizedInitialValue);
  const { validateShortcut } = useShortcutValidation();
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Real-time validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      const fullVal = normalizeShortcutTrigger(value || '');
      const initialNormalized = normalizeShortcutTrigger(initialValue || '');

      if (fullVal && fullVal !== initialNormalized) {
        const res = await validateShortcut(fullVal, itemId);
        setError(res.errorMessage);
        setConflictId(res.conflictId);
      } else {
        setError(null);
        setConflictId(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [value, itemId, initialValue, validateShortcut]);

  const handleFinish = () => {
    const finalVal = normalizeShortcutTrigger(value || '');
    if (error && !conflictId) return;
    if (conflictId) {
      if (conflictId.endsWith('-reserved')) return;
      onOverwrite(finalVal, conflictId);
    } else {
      onSave(finalVal);
    }
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center relative transition-all duration-200',
        error ? 'min-h-[80px] py-2' : 'min-h-[40px]',
      )}>
      <div
        className={clsx(
          'flex items-center justify-start px-2 w-full grow cursor-pointer py-1 gap-0.5 rounded transition-all ring-blue-500/30 focus-within:ring-2',
          'hover:bg-white/5',
        )}
        onClick={() => inputRef.current?.focus()}>
      <div
        className={clsx(
          'flex items-center w-full font-medium text-[11px] max-w-full overflow-hidden',
          'text-neutral-300',
        )}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            autoFocus
            onChange={e => setValue(normalizeShortcutTrigger(e.target.value))}
            onBlur={() => {
              if (!error) handleFinish();
              else onCancel();
            }}
            onKeyDown={e => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFinish();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            onKeyUp={e => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onKeyPress={e => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            placeholder="cmd"
            className={clsx(
              'bg-transparent outline-none border-none focus:ring-0 p-0 min-w-[30px] w-full max-w-full text-left',
              'text-white placeholder:text-neutral-600',
            )}
          />
        </div>
      </div>

      {error && (
        <div
          className={clsx(
            'w-full px-2 mt-1.5 py-1.5 flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1 rounded border-2 z-50',
            'bg-red-500/5 border-red-500/30',
          )}>
          <div className="flex items-start gap-1 justify-center max-w-full">
            <FiZapOff size={11} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[10px] font-bold leading-tight text-center break-words">
              {(() => {
                const parts = error.split('"');
                if (parts.length >= 5) {
                  return (
                    <span className={clsx('font-medium', 'text-neutral-300')}>
                      {parts[0]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[1]}"</span>
                      {parts[2]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[3]}"</span>
                      {parts[4]}
                    </span>
                  );
                }
                return <span className="text-red-500 font-medium">{error}</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { FaKeyboard } from 'react-icons/fa';
import { FiCopy } from 'react-icons/fi';

export interface EditorTitleShortcutInputProps {
  title: string;
  setTitle: (val: string) => void;
  shortcut?: string;
  setShortcut?: (val: string) => void;
  showShortcut?: boolean;

  titlePlaceholder?: string;
  shortcutPlaceholder?: string;

  titleRef?: React.RefObject<HTMLInputElement | null>;
  shortcutRef?: React.RefObject<HTMLInputElement | null>;

  onTitleBlur?: () => void;
  onShortcutBlur?: () => void;

  onTitleEnter?: (shiftKey: boolean, event?: React.KeyboardEvent<HTMLInputElement>) => void;
  onShortcutEnter?: () => void;

  onArrowDownPress?: () => void;
  onCopyTitleToShortcut?: () => void;
  onOverrideShortcut?: () => void;
  isOverrideable?: boolean;

  titleError?: string | boolean | null;
  shortcutError?: string | null;
}

export const EditorTitleShortcutInput: React.FC<EditorTitleShortcutInputProps> = ({
  title,
  setTitle,
  shortcut = '',
  setShortcut,
  showShortcut = true,
  titlePlaceholder = 'Title',
  shortcutPlaceholder = 'Shortcut',
  titleRef,
  shortcutRef,
  onTitleBlur,
  onShortcutBlur,
  onTitleEnter,
  onShortcutEnter,
  onArrowDownPress,
  onCopyTitleToShortcut,
  onOverrideShortcut,
  isOverrideable,
  titleError,
  shortcutError,
}) => {
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (onTitleEnter) {
          onTitleEnter(true, e);
        }
      } else if (!isCmdOrCtrl) {
        e.preventDefault();
        e.stopPropagation();
        if (onTitleEnter) {
          onTitleEnter(e.shiftKey, e);
        }
      }
    } else if (e.key === 'ArrowRight') {
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
    } else if (e.key === 'ArrowDown') {
      if (onArrowDownPress) {
        e.preventDefault();
        onArrowDownPress();
      }
    }
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey && onCopyTitleToShortcut && !shortcut && title.trim().length > 0) {
        onCopyTitleToShortcut();
      } else if (onShortcutEnter) {
        onShortcutEnter();
      }
    } else if (e.key === 'ArrowLeft') {
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
    } else if (e.key === 'ArrowDown') {
      if (onArrowDownPress) {
        e.preventDefault();
        onArrowDownPress();
      }
    }
  };

  return (
    <div className="flex items-center gap-4 flex-shrink-0 relative z-10 py-0.5 w-full pb-1.5">
      <div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
        <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-3.5 flex items-center justify-start gap-2 w-full">
          <div className="flex items-center gap-1 whitespace-nowrap">
            Title <span className="text-red-500">*</span>
          </div>
          {titleError && (
            <span className="text-[10px] text-red-500 font-medium truncate flex-1 text-left">
              {typeof titleError === 'string' ? titleError : 'Enter the title'}
            </span>
          )}
        </label>
        <div className="flex-1 relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-3.5 py-1.5 flex items-center">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={onTitleBlur}
            onKeyDown={handleTitleKeyDown}
            type="text"
            placeholder={titlePlaceholder}
            className="w-full text-sm font-medium text-neutral-700 dark:text-neutral-300 placeholder-black/35 dark:placeholder-white/35 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0"
          />
        </div>
      </div>

      {showShortcut && setShortcut && (
        <div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
          <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-3.5 flex items-center justify-start gap-2 w-full">
            <span className="whitespace-nowrap">Shortcut</span>
            {shortcutError && (
              <div className="flex items-center justify-start gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] text-red-500 font-medium truncate text-left">
                  {shortcutError}
                </span>
                {isOverrideable && onOverrideShortcut && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[ShortcutDebug] USER CLICKED OVERRIDE BUTTON for shortcut:', shortcut);
                      onOverrideShortcut();
                    }}
                    className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-300 border border-black/10 dark:border-white/10 text-[10px] font-semibold transition-all cursor-pointer shrink-0 select-none"
                    title="Reassign shortcut to this item"
                  >
                    Override
                  </button>
                )}
              </div>
            )}
          </label>
          <div className="flex-1 relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-3.5 py-1.5 flex items-center">
            <FaKeyboard className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" size={14} />
            <input
              ref={shortcutRef}
              value={shortcut}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                setShortcut(val);
              }}
              onBlur={onShortcutBlur}
              onKeyDown={handleShortcutKeyDown}
              type="text"
              placeholder={shortcutPlaceholder}
              className={`w-full text-sm font-medium text-neutral-700 dark:text-neutral-300 placeholder-black/35 dark:placeholder-white/35 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0 pl-5 ${!shortcut ? 'pr-28' : ''}`}
            />
            {!shortcut && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCopyTitleToShortcut) {
                    onCopyTitleToShortcut();
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCopyTitleToShortcut) {
                    onCopyTitleToShortcut();
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded border border-black/10 dark:border-white/10 transition-all cursor-pointer select-none"
                title="Copy Title to Shortcut (Shift+Enter)"
              >
                <FiCopy size={11} className="shrink-0" />
                <span>Shift + Enter</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

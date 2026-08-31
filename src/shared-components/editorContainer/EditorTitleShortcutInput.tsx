import * as React from 'react';
import { CUnderscoreIcon } from '../icons/cUnderscoreIcon';

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

  titleError?: string | boolean | null;
  shortcutError?: string | null;
  layout?: 'row' | 'column';
}

export const EditorTitleShortcutInput: React.FC<EditorTitleShortcutInputProps> = ({
  title,
  setTitle,
  shortcut = '',
  setShortcut,
  showShortcut = true,
  titlePlaceholder = 'Title',
  shortcutPlaceholder = 'Command Shortcut',
  shortcutLabel = 'Command Shortcut',
  titleRef,
  shortcutRef,
  titleLeadingElement,
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
  layout = 'row',
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
          onTitleEnter(false, e);
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
      if (onShortcutEnter) {
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
    <div className={`flex flex-shrink-0 relative z-10 py-0.5 w-full pb-1.5 ${layout === 'column' ? 'flex-col items-stretch gap-3' : 'items-center gap-4'}`}>
      <div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
        <label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center justify-start gap-2 w-full">
          <div className="flex items-center gap-1 whitespace-nowrap">
            Title <span className="text-red-500">*</span>
          </div>
          {titleError && (
            <span className="text-[10px] text-red-500 font-medium truncate flex-1 text-left">
              {typeof titleError === 'string' ? titleError : 'Enter the title'}
            </span>
          )}
        </label>
        <div className="flex-1 relative rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3.5 py-1.5 flex items-center gap-2 shadow-sm">
          {titleLeadingElement}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={onTitleBlur}
            onKeyDown={handleTitleKeyDown}
            type="text"
            placeholder={titlePlaceholder}
            className="w-full text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0"
          />
        </div>
      </div>

      {showShortcut && setShortcut && (
        <div className="flex-1 flex flex-col relative z-10 gap-1 min-w-0">
          {layout === 'column' ? (
            <div className="flex flex-col gap-1.5 w-full px-3.5">
              <div className="flex items-center justify-between w-full">
                <label className="text-xs font-semibold text-[var(--color-textSecondary)] whitespace-nowrap">
                  {shortcutLabel}
                </label>
                {shortcutError && isOverrideable && onOverrideShortcut && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOverrideShortcut();
                    }}
                    className="px-2 py-0.5 rounded-md bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderDefault)] text-[10px] font-semibold transition-all cursor-pointer shrink-0 select-none"
                    title="Reassign shortcut to this item"
                  >
                    Override
                  </button>
                )}
              </div>
              {shortcutError && (
                <span className="text-[10.5px] text-red-500 font-medium text-left leading-snug">
                  {shortcutError}
                </span>
              )}
            </div>
          ) : (
            <label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center justify-start gap-2 w-full">
              <span className="whitespace-nowrap">{shortcutLabel}</span>
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
                        onOverrideShortcut();
                      }}
                      className="px-2 py-0.5 rounded-md bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderDefault)] text-[10px] font-semibold transition-all cursor-pointer shrink-0 select-none"
                      title="Reassign shortcut to this item"
                    >
                      Override
                    </button>
                  )}
                </div>
              )}
            </label>
          )}
          <div className="flex-1 relative rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3.5 py-1.5 flex items-center shadow-sm">
            <CUnderscoreIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none" />
            <input
              ref={shortcutRef}
              value={shortcut}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                setShortcut(val);
              }}
              onBlur={onShortcutBlur}
              onKeyDown={handleShortcutKeyDown}
              type="text"
              placeholder={shortcutPlaceholder}
              className="w-full text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 p-0 pl-6"
            />
          </div>
        </div>
      )}
    </div>
  );
};

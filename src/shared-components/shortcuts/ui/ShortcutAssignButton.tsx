import type React from 'react';
import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { FaEllipsisV } from 'react-icons/fa';
import { useShortcutValidation } from '../hooks/useShortcutValidation';
import { normalizeShortcutTrigger } from '../core/shortcutDbData';
import { UnifiedContextMenu } from '../../ui/UnifiedContextMenu';
import { CUnderscoreIcon } from '../../icons/cUnderscoreIcon';

export interface ShortcutAssignButtonProps {
  itemId?: string;
  currentShortcut?: string;
  onShortcutChange?: (shortcut: string) => void;
  disabled?: boolean;
  className?: string;
  onOverwriteShortcut?: (conflictId: string, newValue: string) => Promise<void>;
  defaultName?: string;
  isNewAgent?: boolean;
  useEllipsis?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onClose?: () => void;
  isShortcutLoading?: boolean;
  sidebarMode?: boolean;
  openToLeft?: boolean;
  openToBottom?: boolean;
  title?: string;
}

export const ShortcutAssignButton = forwardRef<HTMLButtonElement, ShortcutAssignButtonProps>(
  ({
    itemId = '',
    currentShortcut = '',
    onShortcutChange,
    disabled = false,
    className = '',
    onOverwriteShortcut,
    useEllipsis = false,
    onKeyDown,
    onClose,
    isShortcutLoading = false,
    sidebarMode = false,
    openToLeft = false,
    openToBottom = false,
    title,
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [shortcutValue, setShortcutValue] = useState(currentShortcut);
    const [isSaving, setIsSaving] = useState(false);
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);
    const normalizedShortcut = normalizeShortcutTrigger(currentShortcut);

    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const wasOpenRef = useRef(false);
    const openTimerRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

    const { validateShortcut } = useShortcutValidation();

    // Cleanup timers on unmount
    useEffect(() => () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);

    const computePosition = useCallback(() => {
      const buttonEl = (ref as any)?.current ?? internalButtonRef.current;
      if (!buttonEl) return null;
      const rect = buttonEl.getBoundingClientRect();
      if (openToBottom) {
        const toolbarEl = buttonEl.closest('[data-shared-toolbar="true"]');
        if (toolbarEl) {
          const toolbarRect = toolbarEl.getBoundingClientRect();
          return { x: toolbarRect.right - 260, y: rect.bottom + 4 };
        }
        return { x: rect.left, y: rect.bottom + 4 };
      }
      return sidebarMode
        ? { x: openToLeft ? rect.left - 244 : rect.right + 12, y: rect.top }
        : { x: rect.left, y: rect.bottom + 4 };
    }, [ref, sidebarMode, openToLeft, openToBottom]);

    const openMenu = useCallback(() => {
      if (disabled) return;
      setShortcutValue(normalizedShortcut);
      setSaveError(null);
      setConflictId(null);
      setPopupPosition(computePosition());
      setIsOpen(true);
    }, [disabled, normalizedShortcut, computePosition]);

    const closeMenu = useCallback(() => setIsOpen(false), []);

    const handleMouseEnter = () => {
      if (disabled) return;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      openTimerRef.current = setTimeout(() => {
        openMenu();
      }, 150);
    };

    const handleMouseLeave = () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeMenu();
      }, 200);
    };

    // Reset state on close, fire onClose callback
    useEffect(() => {
      if (!isOpen) {
        setShortcutValue(normalizedShortcut);
        setSaveError(null);
        setConflictId(null);
        if (wasOpenRef.current) onClose?.();
      }
      wasOpenRef.current = isOpen;
    }, [isOpen, normalizedShortcut, onClose]);

    // Real-time validation when popup is open (300ms debounce)
    useEffect(() => {
      if (!isOpen) return;
      const timer = setTimeout(async () => {
        let error: string | null = null;
        let conflict: string | null = null;
        
        if (shortcutValue && shortcutValue !== normalizedShortcut) {
          const res = await validateShortcut(shortcutValue, itemId);
          if (res.errorMessage) { error = res.errorMessage; conflict = res.conflictId; }
        }
        
        setSaveError(error);
        setConflictId(conflict);
      }, 300);
      return () => clearTimeout(timer);
    }, [isOpen, shortcutValue, itemId, normalizedShortcut, validateShortcut]);

    const handleSaveShortcut = useCallback(() => {
      if (saveError) return;
      onShortcutChange?.(normalizeShortcutTrigger(shortcutValue));
      closeMenu();
    }, [shortcutValue, onShortcutChange, saveError, closeMenu]);

    const handleClearShortcut = useCallback(() => {
      setShortcutValue('');
      onShortcutChange?.('');
      closeMenu();
    }, [onShortcutChange, closeMenu]);

    const handleOverwriteShortcut = useCallback(async (cId: string) => {
      if (!onOverwriteShortcut) return;
      setIsSaving(true);
      try { await onOverwriteShortcut(cId, normalizeShortcutTrigger(shortcutValue)); closeMenu(); }
      catch (e) { console.error('Failed to overwrite shortcut:', e); }
      finally { setIsSaving(false); }
    }, [onOverwriteShortcut, shortcutValue, closeMenu]);

    // Shared popup props
    const popupProps = {
      shortcutInput: {
        value: shortcutValue,
        onChange: setShortcutValue,
        onSave: handleSaveShortcut,
        onCancel: closeMenu,
        isSaving,
        isUpdating: !!normalizedShortcut,
        onClear: handleClearShortcut,
        onOverwrite: conflictId ? handleOverwriteShortcut : undefined,
        showSuccess: null,
      },
      error: saveError ?? undefined,
      conflictId: conflictId ?? undefined,
    };

    const isLoading = isShortcutLoading;

    const buttonContent = sidebarMode ? (
      <div className="flex items-center justify-center relative">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <CUnderscoreIcon size={20} />}
      </div>
    ) : useEllipsis ? (
      <FaEllipsisV size={11} />
    ) : normalizedShortcut ? (
      <div className="flex items-center divide-x border-[var(--color-borderDefault)] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--color-panelBg)]/50 flex items-center justify-center rounded-lg z-10">
            <div className="w-3 h-3 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        )}
        <div className="flex items-center divide-x border-[var(--color-borderDefault)]">
          <span className="text-[10px] font-mono font-bold px-1.5 whitespace-nowrap text-[var(--color-accent)]">{normalizedShortcut}</span>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-center relative min-w-[20px] px-1.5">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <span className="text-[10px] font-mono font-bold whitespace-nowrap text-[var(--color-textSecondary)] hover:text-[var(--color-accent)] transition-colors">cmd</span>}
      </div>
    );

    const buttonClassName = sidebarMode ? className : `flex items-center justify-center transition-all ${
      useEllipsis
        ? 'p-1 bg-transparent border-none text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
        : normalizedShortcut
          ? 'p-1.5 rounded-lg border bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'p-1.5 rounded-lg border bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : !useEllipsis ? 'hover:border-[var(--color-accent)] cursor-pointer' : 'cursor-pointer'} ${className}`;

    return (
      <div
        className="relative flex items-center justify-center"
      >
        <button
          ref={ref || internalButtonRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); openMenu(); }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          title={title || (sidebarMode ? '' : normalizedShortcut ? `Shortcut: ${normalizedShortcut}` : 'Assign a Text Shortcut')}
          className={buttonClassName}
        >
          {buttonContent}
        </button>

        {isOpen && popupPosition && (
          <UnifiedContextMenu
            x={popupPosition.x}
            y={popupPosition.y}
            onClose={closeMenu}
            {...popupProps}
          />
        )}
      </div>
    );
  },
);

ShortcutAssignButton.displayName = 'ShortcutAssignButton';

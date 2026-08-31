import type * as React from 'react';
import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { FaStar, FaEllipsisV } from 'react-icons/fa';
import { FiStar } from 'react-icons/fi';
import { BsKeyboard } from 'react-icons/bs';
import { useKeystrokeRecording } from '../hooks/useKeystrokeRecording';
import { useHotkeyValidation } from '../hooks/useHotkeyValidation';
import { UnifiedContextMenu } from '../../ui/UnifiedContextMenu';

export interface HotkeyAssignButtonProps {
  itemId?: string;
  currentHotkey?: string;
  onHotkeyChange?: (hotkey: string) => void;
  isMac?: boolean;
  disabled?: boolean;
  className?: string;
  onOverwriteHotkey?: (conflictId: string, newValue: string) => Promise<void>;
  useEllipsis?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClose?: () => void;
  showFavorite?: boolean;
  isFavLoading?: boolean;
  isHotkeyLoading?: boolean;
  sidebarMode?: boolean;
  openToLeft?: boolean;
  openToBottom?: boolean;
  title?: string;
  portalContainer?: HTMLElement | null;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
}

export const HotkeyAssignButton = forwardRef<HTMLButtonElement, HotkeyAssignButtonProps>(
  ({
    itemId = '',
    currentHotkey = '',
    onHotkeyChange,
    isMac = false,
    disabled = false,
    className = '',
    onOverwriteHotkey,
    useEllipsis = false,
    onKeyDown,
    isFavorite = false,
    onToggleFavorite,
    onClose,
    showFavorite = false,
    isFavLoading = false,
    isHotkeyLoading = false,
    sidebarMode = false,
    openToLeft = false,
    openToBottom = false,
    title,
    portalContainer,
    appearanceScope = 'default',
    appearanceTokens,
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editValue, setEditValue] = useState(currentHotkey);
    const [isSaving, setIsSaving] = useState(false);
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);

    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const wasOpenRef = useRef(false);
    const openTimerRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

    const { captureHotkey } = useKeystrokeRecording(editValue, isMac);
    const { validateHotkey } = useHotkeyValidation();

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
      setEditValue(currentHotkey);
      setSaveError(null);
      setConflictId(null);
      setPopupPosition(computePosition());
      setIsOpen(true);
    }, [disabled, currentHotkey, computePosition]);

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
        setEditValue(currentHotkey);
        setSaveError(null);
        setConflictId(null);
        if (wasOpenRef.current) onClose?.();
      }
      wasOpenRef.current = isOpen;
    }, [isOpen, currentHotkey, onClose]);

    // Real-time validation when popup is open (300ms debounce)
    useEffect(() => {
      if (!isOpen) return;
      const timer = setTimeout(async () => {
        let error: string | null = null;
        let conflict: string | null = null;
        if (editValue && editValue !== currentHotkey) {
          const res = await validateHotkey(editValue, itemId);
          if (res.errorMessage) { error = res.errorMessage; conflict = res.conflictId; }
        }
        setSaveError(error);
        setConflictId(conflict);
      }, 300);
      return () => clearTimeout(timer);
    }, [isOpen, editValue, itemId, currentHotkey, validateHotkey]);

    const handleHotkeyCapture = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      const result = captureHotkey(e);
      if (result === 'CANCEL') setEditValue(currentHotkey);
      else if (result) setEditValue(result);
    }, [captureHotkey, currentHotkey]);

    const handleSaveHotkey = useCallback(() => {
      if (saveError) return;
      onHotkeyChange?.(editValue);
      closeMenu();
    }, [editValue, onHotkeyChange, saveError, closeMenu]);

    const handleClearHotkey = useCallback(() => {
      setEditValue('');
      onHotkeyChange?.('');
      closeMenu();
    }, [onHotkeyChange, closeMenu]);

    const handleOverwriteHotkey = useCallback(async (cId: string) => {
      if (!onOverwriteHotkey) return;
      setIsSaving(true);
      try { await onOverwriteHotkey(cId, editValue); closeMenu(); }
      catch (e) { console.error('Failed to overwrite hotkey:', e); }
      finally { setIsSaving(false); }
    }, [onOverwriteHotkey, editValue, closeMenu]);

    // Shared popup props
    const popupProps = {
      hotkeyInput: {
        value: editValue,
        onChange: handleHotkeyCapture,
        onSave: handleSaveHotkey,
        onCancel: closeMenu,
        isSaving,
        isUpdating: !!currentHotkey,
        onClear: handleClearHotkey,
        onOverwrite: conflictId ? handleOverwriteHotkey : undefined,
        showSuccess: null,
      },
      error: saveError ?? undefined,
      conflictId: conflictId ?? undefined,
    };

    const isLoading = isHotkeyLoading;

    // Button inner content
    const buttonContent = sidebarMode ? (
      <div className="flex items-center justify-center relative">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <BsKeyboard size={20} />}
      </div>
    ) : useEllipsis ? (
      <FaEllipsisV size={11} />
    ) : currentHotkey ? (
      <div className="flex items-center divide-x border-[var(--color-borderDefault)] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--color-panelBg)]/50 flex items-center justify-center rounded-lg z-10">
            <div className="w-3 h-3 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        )}
        <div className="flex items-center divide-x border-[var(--color-borderDefault)]">
          {currentHotkey && <span className="text-[10px] font-mono font-bold px-1.5 whitespace-nowrap text-[var(--color-accent)]">{currentHotkey}</span>}
        </div>
      </div>
    ) : showFavorite ? (
      <div className="flex items-center justify-center min-w-[20px] relative" onClick={onToggleFavorite}>
        {isFavLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-favorite)]/30 border-t-[var(--color-favorite)] rounded-full animate-spin" />
          : isFavorite ? <FaStar size={12} className="text-[var(--color-favorite)]" /> : <FiStar size={12} />}
      </div>
    ) : (
      <div className="flex items-center justify-center relative min-w-[20px]">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <BsKeyboard size={14} />}
      </div>
    );

    const buttonClassName = sidebarMode ? className : `flex items-center justify-center transition-all ${
      useEllipsis
        ? 'p-1 bg-transparent border-none text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
        : currentHotkey
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
          title={title || (sidebarMode ? '' : currentHotkey ? `Hotkey: ${currentHotkey}` : 'Assign a Keyboard Shortcut')}
          className={buttonClassName}
        >
          {buttonContent}
        </button>

        {isOpen && popupPosition && (
          <UnifiedContextMenu
            x={popupPosition.x}
            y={popupPosition.y}
            onClose={closeMenu}
            portalContainer={portalContainer}
            appearanceScope={appearanceScope}
            appearanceTokens={appearanceTokens}
            {...popupProps}
          />
        )}
      </div>
    );
  },
);

HotkeyAssignButton.displayName = 'HotkeyAssignButton';

import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { LuClock, LuSearch, LuX, LuCheck } from 'react-icons/lu';

export interface TimeZoneOption {
  id: string;
  label: string;
  timeZone: string;
}

export interface TimeWidgetSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  popoverPos: { top: number; left: number };
  popoverRef: React.RefObject<HTMLDivElement | null>;
  triggerBtnRef: React.RefObject<HTMLButtonElement | null>;
  options: TimeZoneOption[];
  selectedTimeZoneIds: string[];
  onToggleTimeZone: (timeZoneId: string) => void;
}

export const TimeWidgetSettingsPopover: React.FC<TimeWidgetSettingsPopoverProps> = ({
  isOpen,
  onClose,
  popoverPos,
  popoverRef,
  triggerBtnRef,
  options,
  selectedTimeZoneIds,
  onToggleTimeZone,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedSearchTerm
        ? options.filter(option =>
            `${option.label} ${option.timeZone}`.toLowerCase().includes(normalizedSearchTerm),
          )
        : options,
    [normalizedSearchTerm, options],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerBtnRef.current &&
        !triggerBtnRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, popoverRef, triggerBtnRef]);

  if (!isOpen) return null;

  const isMaxSelected = selectedTimeZoneIds.length >= 3;

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      data-no-widget-drag="true"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      className="fixed z-[999999] w-[320px] max-w-[calc(100vw-24px)] flex flex-col overflow-hidden rounded-xl border shadow-2xl p-3.5 gap-2.5 text-xs animate-in fade-in duration-100"
      style={{
        top: `${popoverPos.top}px`,
        left: `${popoverPos.left}px`,
        backgroundColor: 'var(--color-contextMenuBg, var(--color-editorBg, var(--color-cardBg)))',
        borderColor: 'var(--color-borderDefault)',
        color: 'var(--color-textPrimary)',
        boxShadow: '0 12px 32px var(--color-popupShadow, var(--color-shadow, rgba(0,0,0,0.35)))',
      }}>
      {/* Header */}
      <div className="flex items-center justify-between font-bold border-b pb-2 border-[var(--color-borderDefault)] shrink-0">
        <span className="flex items-center gap-2 text-xs text-[var(--color-textPrimary)]">
          <LuClock size={14} className="text-[var(--color-iconDefault,var(--color-textPrimary))]" />
          World clocks
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close time zone settings"
          className="p-1 rounded-md hover:bg-[var(--color-hoverBg,var(--color-bgHover))] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] cursor-pointer transition-colors">
          <LuX size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="relative flex items-center w-full rounded-xl border border-[var(--color-borderDefault)] bg-transparent px-3 py-1.5 focus-within:border-[var(--color-borderActive)] transition-colors shrink-0">
        <LuSearch size={14} className="text-[var(--color-textMuted)] shrink-0 mr-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search locations..."
          aria-label="Search time zone locations"
          className="w-full border-0 bg-transparent text-xs text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] outline-none focus:outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="p-0.5 rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer shrink-0 transition-colors"
            aria-label="Clear location search">
            <LuX size={13} />
          </button>
        )}
      </div>

      {/* Subtitle & Selection Counter */}
      <div className="flex items-center justify-between text-[11px] text-[var(--color-textMuted)] shrink-0">
        <span>Choose up to 3 locations</span>
        <span className="font-semibold text-[var(--color-textPrimary)]">
          {selectedTimeZoneIds.length}/3 selected
        </span>
      </div>

      {/* Scrollable Location List */}
      <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto widget-settings-thin-scrollbar pr-0.5 min-h-0">
        {filteredOptions.length === 0 ? (
          <div className="p-3 text-center text-xs text-[var(--color-textMuted)]">
            No matching locations found.
          </div>
        ) : filteredOptions.map(option => {
          const isSelected = selectedTimeZoneIds.includes(option.id);
          const isDisabled = !isSelected && isMaxSelected;

          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  onToggleTimeZone(option.id);
                }
              }}
              className={`w-full flex items-center justify-between gap-3 p-2 rounded-lg text-left transition-colors select-none group border border-transparent ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isSelected
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-medium cursor-pointer'
                    : 'hover:bg-[var(--color-hoverBg,var(--color-bgHover))] text-[var(--color-textPrimary)] cursor-pointer'
              }`}>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-xs font-semibold text-[var(--color-textPrimary)]">
                  {option.label}
                </span>
                <span className="truncate text-[10px] text-[var(--color-textMuted)]">
                  {option.timeZone}
                </span>
              </div>
              <div
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs'
                    : 'border border-[var(--color-borderDefault)] text-transparent group-hover:border-[var(--color-borderActive)]'
                }`}>
                {isSelected && <LuCheck size={12} className="stroke-[2.5]" />}
              </div>
            </button>
          );
        })}
      </div>

      {isMaxSelected && (
        <div className="text-[10px] text-center text-[var(--color-textMuted)] pt-1 border-t border-[var(--color-borderDefault)] shrink-0">
          You can select up to 3 locations.
        </div>
      )}
    </div>,
    document.body,
  );
};

export default TimeWidgetSettingsPopover;

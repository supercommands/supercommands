import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { FaRegCalendarAlt } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';
import {
  parseDueDateInput,
  formatLocalISODate,
  displayDateFormatted,
  DueDateValue,
} from '../utils/dueDateParser';

export type DueDateOption = {
  id: string;
  type: 'custom' | 'preset' | 'parsed' | 'invalid';
  label: string;
  secondary?: string;
  value?: DueDateValue;
  disabled?: boolean;
};

interface NewDueDateDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: { date: string; time: string | null; isAnytime: boolean }) => void;
  onOpenCustomNativePicker?: () => void;
  currentTime?: string;
  currentDate?: string;
  initialQuery?: string;
  onBackspaceEmpty?: () => boolean;
  rootDataAttributes?: Record<string, string>;
  rootStyle?: React.CSSProperties;
  positionClassName?: string;
  closeOnSelect?: boolean;
}

export const NewDueDateDropdown: React.FC<NewDueDateDropdownProps> = ({
  isOpen,
  onClose,
  onSelect,
  onOpenCustomNativePicker,
  currentTime,
  currentDate,
  initialQuery = '',
  onBackspaceEmpty,
  rootDataAttributes,
  rootStyle,
  positionClassName = 'absolute bottom-full mb-2 left-0',
  closeOnSelect = true,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showCustomPanel, setShowCustomPanel] = useState(false);

  // Custom panel inputs
  const [customDateVal, setCustomDateVal] = useState(currentDate || formatLocalISODate(new Date()));
  const [customTimeVal, setCustomTimeVal] = useState(currentTime || '09:00');
  const [isCustomAnytime, setIsCustomAnytime] = useState(true);

  // Auto focus input on open with initial activeIndex = -1
  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    setActiveIndex(-1);
    setShowCustomPanel(false);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    searchInputRef.current?.focus();

    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
    return () => clearTimeout(timer);
  }, [initialQuery, isOpen]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const path = e.composedPath();
      const insideDropdown = path.some(node => {
        if (!(node instanceof Node)) return false;
        return node === containerRef.current || Boolean(containerRef.current?.contains(node));
      });
      if (containerRef.current && !insideDropdown) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Scroll highlighted item into view on keyboard navigation
  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Derived options based on query
  const options: DueDateOption[] = useMemo(() => {
    const trimmed = query.trim();
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    if (!trimmed) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const inOneWeek = new Date(now);
      inOneWeek.setDate(inOneWeek.getDate() + 7);

      return [
        {
          id: 'tomorrow',
          type: 'preset',
          label: 'Tomorrow',
          secondary: displayDateFormatted(tomorrow),
          value: {
            date: formatLocalISODate(tomorrow),
            time: null,
            timezone,
          },
        },
        {
          id: 'in-one-week',
          type: 'preset',
          label: 'In one week',
          secondary: displayDateFormatted(inOneWeek),
          value: {
            date: formatLocalISODate(inOneWeek),
            time: null,
            timezone,
          },
        },
      ];
    }

    const parsed = parseDueDateInput(trimmed, { now });
    if (parsed.valid) {
      return [
        {
          id: 'parsed',
          type: 'parsed',
          label: parsed.label,
          secondary: parsed.secondaryLabel || undefined,
          value: parsed.value,
        },
      ];
    }

    return [
      {
        id: 'invalid',
        type: 'invalid',
        label: 'No matching date',
        secondary: '',
        disabled: true,
      },
    ];
  }, [query]);

  const handleSelectOption = (option: DueDateOption) => {
    if (option.disabled) return;

    if (option.type === 'custom') {
      if (onOpenCustomNativePicker) {
        onOpenCustomNativePicker();
        onClose();
      } else {
        setShowCustomPanel(true);
      }
      return;
    }

    if (option.value) {
      const val = option.value;
      onSelect({
        date: val.date,
        time: val.time,
        isAnytime: val.time === null,
      });
      if (closeOnSelect) {
        onClose();
      }
    }
  };

  // Global capture phase keydown listener to guarantee priority over any parent listeners
  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      if (e.key === 'ArrowDown') {
        setActiveIndex(prev => {
          const enabledIndexes = options
            .map((option, index) => (option.disabled ? -1 : index))
            .filter(index => index >= 0);
          if (enabledIndexes.length === 0) return -1;
          const currentEnabledIndex = enabledIndexes.indexOf(prev);
          return enabledIndexes[currentEnabledIndex >= 0 ? (currentEnabledIndex + 1) % enabledIndexes.length : 0];
        });
      } else if (e.key === 'ArrowUp') {
        setActiveIndex(prev => {
          const enabledIndexes = options
            .map((option, index) => (option.disabled ? -1 : index))
            .filter(index => index >= 0);
          if (enabledIndexes.length === 0) return -1;
          const currentEnabledIndex = enabledIndexes.indexOf(prev);
          return enabledIndexes[
            currentEnabledIndex >= 0
              ? (currentEnabledIndex - 1 + enabledIndexes.length) % enabledIndexes.length
              : enabledIndexes.length - 1
          ];
        });
      } else if (e.key === 'Enter') {
        const highlightedOption = activeIndex >= 0 ? options[activeIndex] : null;
        const firstEnabledOption = options.find(option => !option.disabled);
        const optionToSelect = highlightedOption && !highlightedOption.disabled ? highlightedOption : firstEnabledOption;
        if (optionToSelect) handleSelectOption(optionToSelect);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [activeIndex, closeOnSelect, isOpen, options, onClose]);

  if (!isOpen) return null;

  const activeOption = activeIndex >= 0 && activeIndex < options.length ? options[activeIndex] : null;
  const activeDescendantId = activeOption ? `due-option-${activeOption.id}` : undefined;

  return (
    <div
      ref={containerRef}
      {...rootDataAttributes}
      style={rootStyle}
      className={`${positionClassName} w-[240px] rounded-xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] overflow-hidden p-1 flex flex-col gap-1 text-[var(--color-textPrimary)] font-sans`}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
      {/* Search Input */}
      <div className="relative flex items-center px-2 py-1.5 border-b border-[var(--color-borderDefault)]">
        <FiSearch size={14} className="text-[var(--color-iconDefault)] mr-2 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="due-date-options"
          aria-autocomplete="list"
          aria-activedescendant={activeDescendantId}
          placeholder="time and date: eg:10 am tomorrow"
          value={query}
          onKeyDown={e => {
            if (e.key === 'Backspace' && query === '' && onBackspaceEmpty?.()) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onChange={e => {
            const val = e.target.value;
            setQuery(val);
            setActiveIndex(-1);
            setShowCustomPanel(false);
          }}
          className="w-full bg-transparent text-xs text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none border-none focus:ring-0 p-0"
        />
      </div>

      {/* Options List */}
      {!showCustomPanel && (
        <div id="due-date-options" role="listbox" className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
          {options.map((opt, idx) => {
            const isHighlighted = activeIndex === idx;

            if (opt.disabled) {
              return (
                <div
                  key={opt.id}
                  id={`due-option-${opt.id}`}
                  role="option"
                  aria-disabled="true"
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] opacity-40 text-[var(--color-textMuted)] cursor-not-allowed">
                  <span>{opt.label}</span>
                </div>
              );
            }

            return (
              <button
                key={opt.id}
                id={`due-option-${opt.id}`}
                role="option"
                aria-selected={isHighlighted}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleSelectOption(opt);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[12.5px] font-medium transition-colors cursor-pointer ${isHighlighted ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]' : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
                  }`}>
                <div className="flex items-center gap-2">
                  <FaRegCalendarAlt size={12} className="text-[var(--color-iconDefault)] shrink-0" />
                  <span className="truncate max-w-[130px]">{opt.label}</span>
                </div>
                {opt.secondary && <span className="text-[11px] text-[var(--color-textSecondary)] font-normal">{opt.secondary}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

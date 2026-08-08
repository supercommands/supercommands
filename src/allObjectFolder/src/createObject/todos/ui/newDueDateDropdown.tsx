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
  positionClassName?: string;
}

export const NewDueDateDropdown: React.FC<NewDueDateDropdownProps> = ({
  isOpen,
  onClose,
  onSelect,
  onOpenCustomNativePicker,
  currentTime,
  currentDate,
  positionClassName = 'absolute bottom-full mb-2 left-0',
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
    setQuery('');
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
  }, [isOpen]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      onClose();
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
          let next = prev;
          do {
            next += 1;
          } while (next < options.length && options[next].disabled);
          return next < options.length ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        setActiveIndex(prev => {
          let next = prev;
          do {
            next -= 1;
          } while (next >= 0 && options[next].disabled);
          return next >= 0 ? next : -1;
        });
      } else if (e.key === 'Enter') {
        setActiveIndex(currentActiveIndex => {
          if (currentActiveIndex >= 0 && currentActiveIndex < options.length) {
            if (!options[currentActiveIndex].disabled) {
              handleSelectOption(options[currentActiveIndex]);
            }
          } else if (currentActiveIndex === -1) {
            if (options.length > 0 && !options[0].disabled && options[0].type === 'parsed') {
              handleSelectOption(options[0]);
            }
          }
          return currentActiveIndex;
        });
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [isOpen, options, onClose]);

  if (!isOpen) return null;

  const activeOption = activeIndex >= 0 && activeIndex < options.length ? options[activeIndex] : null;
  const activeDescendantId = activeOption ? `due-option-${activeOption.id}` : undefined;

  return (
    <div
      ref={containerRef}
      className={`${positionClassName} w-[240px] rounded-xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] overflow-hidden p-1 flex flex-col gap-1 text-[var(--color-textPrimary)] font-sans`}
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
          placeholder="Try: 24h, 7 days, Feb 9"
          value={query}
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
                onClick={e => {
                  e.stopPropagation();
                  handleSelectOption(opt);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[12.5px] font-medium transition-colors cursor-pointer ${
                  isHighlighted ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]' : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
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

import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { FaRegCalendarAlt } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';
import { parseDueDateInput, isPastDueDateInput, formatLocalISODate, displayDateFormatted, DueDateValue, } from '../utils/dueDateParser';
const DUE_DATE_PLACEHOLDERS = [
    'type: 5 days from now',
    'type: 76 hours from now',
    'type: 2026 Oct 5',
    'type: Thursday 5 PM',
    'type: Nov 25th',
    'type: tomorrow 10 AM',
    'type: next Monday',
    'type: in 30 minutes',
    'type: 5 PM Thursday',
    'type: 10 min later',
    'type: 25th Oct 2026'
];
export type DueDateOption = {
    id: string;
    type: 'custom' | 'preset' | 'parsed' | 'invalid';
    label: string;
    secondary?: string;
    value?: DueDateValue;
    disabled?: boolean;
};
type TimeParts = {
    hour: string;
    minute: string;
    meridiem: 'AM' | 'PM';
};
const getTimeParts = (time?: string): TimeParts => {
    const [rawHour, rawMinute] = (time || '').split(':').map(Number);
    const date = Number.isFinite(rawHour) && Number.isFinite(rawMinute) ? new Date(2000, 0, 1, rawHour, rawMinute) : new Date();
    const hours = date.getHours();
    return {
        hour: String(hours % 12 || 12),
        minute: String(date.getMinutes()).padStart(2, '0'),
        meridiem: hours >= 12 ? 'PM' : 'AM',
    };
};
const getTwentyFourHourTime = ({ hour, minute, meridiem }: TimeParts) => {
    const parsedHour = Number.parseInt(hour, 10);
    const parsedMinute = Number.parseInt(minute, 10);
    if (!Number.isInteger(parsedHour) || parsedHour < 1 || parsedHour > 12)
        return null;
    if (!Number.isInteger(parsedMinute) || parsedMinute < 0 || parsedMinute > 59)
        return null;
    const hour24 = (parsedHour % 12) + (meridiem === 'PM' ? 12 : 0);
    return `${String(hour24).padStart(2, '0')}:${String(parsedMinute).padStart(2, '0')}`;
};
interface NewDueDateDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selection: {
        date: string;
        time: string | null;
        isAnytime: boolean;
    }) => void;
    currentTime?: string;
    currentDate?: string;
    initialQuery?: string;
    onBackspaceEmpty?: () => boolean;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
    rootDataAttributes?: Record<string, string>;
    rootStyle?: React.CSSProperties;
    positionClassName?: string;
    closeOnSelect?: boolean;
}
export const NewDueDateDropdown: React.FC<NewDueDateDropdownProps> = ({ isOpen, onClose, onSelect, currentTime, currentDate, initialQuery = '', onBackspaceEmpty, onNavigateFromCleanEdit, rootDataAttributes, rootStyle, positionClassName = 'absolute bottom-full mb-2 left-0', closeOnSelect = true, }) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const nativeDateInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hourInputRef = useRef<HTMLInputElement>(null);
    const minuteInputRef = useRef<HTMLInputElement>(null);
    const meridiemSelectRef = useRef<HTMLSelectElement>(null);
    const setTimeButtonRef = useRef<HTMLButtonElement>(null);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [nativeDateValue, setNativeDateValue] = useState(currentDate || formatLocalISODate(new Date()));
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
    const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
    const [timeParts, setTimeParts] = useState<TimeParts>(() => getTimeParts(currentTime));
    // Auto focus input on open with initial activeIndex = -1
    useEffect(() => {
        if (!isOpen)
            return;
        setQuery(initialQuery);
        setActiveIndex(-1);
        setPlaceholderIndex(prev => (prev + 1) % DUE_DATE_PLACEHOLDERS.length);
        setNativeDateValue(currentDate || formatLocalISODate(new Date()));
        setSelectedCalendarDate(null);
        setIsTimePickerOpen(false);
        setTimeParts(getTimeParts(currentTime));
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        searchInputRef.current?.focus();
        const timer = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 10);
        return () => clearTimeout(timer);
    }, [currentDate, currentTime, initialQuery, isOpen]);
    useEffect(() => {
        if (!isTimePickerOpen)
            return;
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
    }, [isTimePickerOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const intervalId = window.setInterval(() => {
            setPlaceholderIndex(prev => (prev + 1) % DUE_DATE_PLACEHOLDERS.length);
        }, 3000);
        return () => window.clearInterval(intervalId);
    }, [isOpen]);
    // Handle outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const path = e.composedPath();
            const insideDropdown = path.some(node => {
                if (!(node instanceof Node))
                    return false;
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
                }
            ];
        }
        const parsed = parseDueDateInput(trimmed, { now });
        if (parsed.valid) {
            return [
                {
                    id: 'parsed',
                    type: 'parsed',
                    label: parsed.label,
                    secondary: parsed.secondaryLabel,
                    value: parsed.value,
                }
            ];
        }
        const invalidLabel = parsed.reason === 'past' || isPastDueDateInput(trimmed, now)
            ? 'Do You Have A Time Machine?'
            : "Sorry, I couldn't understand. Click the calendar icon to select a date.";
        return [
            {
                id: 'invalid',
                type: 'invalid',
                label: invalidLabel,
                secondary: '',
                disabled: true,
            }
        ];
    }, [query]);
    const handleOpenCalendarPicker = React.useCallback(() => {
        const input = nativeDateInputRef.current;
        if (!input)
            return;
        const inputWithPicker = input as HTMLInputElement & {
            showPicker?: () => void;
        };
        if (inputWithPicker.showPicker) {
            inputWithPicker.showPicker();
            return;
        }
        input.click();
    }, []);
    const handleNativeDateChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = e.target.value;
        setNativeDateValue(selectedDate);
        if (!selectedDate)
            return;
        setSelectedCalendarDate(selectedDate);
        setTimeParts(getTimeParts(currentTime));
        setIsTimePickerOpen(true);
    }, [currentTime]);
    const completeTimeSelection = React.useCallback(() => {
        if (!selectedCalendarDate)
            return;
        const time = getTwentyFourHourTime(timeParts);
        if (!time)
            return;
        onSelect({ date: selectedCalendarDate, time, isAnytime: false });
        if (closeOnSelect) {
            onClose();
            return;
        }
        setSelectedCalendarDate(null);
        setIsTimePickerOpen(false);
        requestAnimationFrame(() => searchInputRef.current?.focus());
    }, [closeOnSelect, onClose, onSelect, selectedCalendarDate, timeParts]);
    const handleSelectOption = (option: DueDateOption) => {
        if (option.disabled)
            return;
        if (option.type === 'custom') {
            handleOpenCalendarPicker();
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
        if (!isOpen)
            return;
        function handleGlobalKeyDown(e: KeyboardEvent) {
            const target = e.target instanceof Node ? e.target : null;
            if (target && !containerRef.current?.contains(target) && document.activeElement !== nativeDateInputRef.current) {
                return;
            }
            if (isTimePickerOpen) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const controls = [hourInputRef.current, minuteInputRef.current, meridiemSelectRef.current];
                    const currentIndex = controls.findIndex(control => control === document.activeElement);
                    const nextIndex = currentIndex + (e.key === 'ArrowRight' ? 1 : -1);
                    controls[nextIndex]?.focus();
                    return;
                }
                if (e.key === 'ArrowDown') {
                    setTimeButtonRef.current?.focus();
                    return;
                }
                if (e.key === 'Escape') {
                    setIsTimePickerOpen(false);
                    handleOpenCalendarPicker();
                }
                return;
            }
            if (e.key === 'Tab') {
                onClose();
                if (onNavigateFromCleanEdit) {
                    e.preventDefault();
                    onNavigateFromCleanEdit(0, e.shiftKey ? -1 : 1);
                }
                return;
            }
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
                onNavigateFromCleanEdit &&
                !query.trim() &&
                activeIndex === -1) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                onNavigateFromCleanEdit?.(0, e.key === 'ArrowLeft' ? -1 : 1);
                return;
            }
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
                    if (enabledIndexes.length === 0)
                        return -1;
                    const currentEnabledIndex = enabledIndexes.indexOf(prev);
                    return enabledIndexes[currentEnabledIndex >= 0 ? (currentEnabledIndex + 1) % enabledIndexes.length : 0];
                });
            }
            else if (e.key === 'ArrowUp') {
                setActiveIndex(prev => {
                    const enabledIndexes = options
                        .map((option, index) => (option.disabled ? -1 : index))
                        .filter(index => index >= 0);
                    if (enabledIndexes.length === 0)
                        return -1;
                    const currentEnabledIndex = enabledIndexes.indexOf(prev);
                    return enabledIndexes[currentEnabledIndex >= 0
                        ? (currentEnabledIndex - 1 + enabledIndexes.length) % enabledIndexes.length
                        : enabledIndexes.length - 1];
                });
            }
            else if (e.key === 'Enter') {
                const currentInput = searchInputRef.current?.value?.trim() || query.trim();
                const freshParsed = currentInput ? parseDueDateInput(currentInput, { now: new Date() }) : null;
                if (freshParsed?.valid) {
                    onSelect({
                        date: freshParsed.value.date,
                        time: freshParsed.value.time,
                        isAnytime: freshParsed.value.time === null,
                    });
                    if (closeOnSelect) {
                        onClose();
                    }
                    return;
                }
                const highlightedOption = activeIndex >= 0 ? options[activeIndex] : null;
                const optionToSelect = highlightedOption && !highlightedOption.disabled ? highlightedOption : null;
                if (optionToSelect)
                    handleSelectOption(optionToSelect);
            }
            else if (e.key === 'Escape') {
                onClose();
            }
        }
        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    }, [
        activeIndex,
        closeOnSelect,
        handleOpenCalendarPicker,
        isOpen,
        isTimePickerOpen,
        onClose,
        onNavigateFromCleanEdit,
        onSelect,
        options,
        query
    ]);
    if (!isOpen)
        return null;
    const activeOption = activeIndex >= 0 && activeIndex < options.length ? options[activeIndex] : null;
    const activeDescendantId = activeOption ? `due-option-${activeOption.id}` : undefined;
    return (<div ref={containerRef} {...rootDataAttributes} data-todo-local-escape="true" style={rootStyle} className={`new-due-date-dropdown ${positionClassName} w-[240px] rounded-xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] overflow-hidden p-1 flex flex-col gap-1 text-[var(--color-textPrimary)] font-sans`} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <input ref={nativeDateInputRef} type="date" value={nativeDateValue} min={formatLocalISODate(new Date())} onChange={handleNativeDateChange} tabIndex={-1} aria-hidden="true" className="absolute h-px w-px opacity-0 pointer-events-none"/>
      {isTimePickerOpen && selectedCalendarDate ? (<div className="flex flex-col gap-3 p-2">
          <div className="flex items-start gap-2 border-b border-[var(--color-borderDefault)] pb-2">
            <FaRegCalendarAlt size={13} className="mt-0.5 shrink-0 text-[var(--color-iconDefault)]"/>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--color-textPrimary)]">Select time</div>
              <div className="truncate text-[11px] text-[var(--color-textSecondary)]">
                {displayDateFormatted(new Date(`${selectedCalendarDate}T12:00:00`))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr] gap-1.5" aria-label="Time selection">
            <label className="flex min-w-0 flex-col gap-1 text-[10px] font-medium text-[var(--color-textMuted)]">
              Hours
              <input ref={hourInputRef} type="text" inputMode="numeric" maxLength={2} value={timeParts.hour} onChange={event => setTimeParts(parts => ({ ...parts, hour: event.target.value.replace(/\D/g, '').slice(0, 2) }))} className="h-8 w-full rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-center text-[12px] text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-borderActive)]" aria-label="Hours"/>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[10px] font-medium text-[var(--color-textMuted)]">
              Minutes
              <input ref={minuteInputRef} type="text" inputMode="numeric" maxLength={2} value={timeParts.minute} onChange={event => setTimeParts(parts => ({ ...parts, minute: event.target.value.replace(/\D/g, '').slice(0, 2) }))} className="h-8 w-full rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-center text-[12px] text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-borderActive)]" aria-label="Minutes"/>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[10px] font-medium text-[var(--color-textMuted)]">
              AM / PM
              <select ref={meridiemSelectRef} value={timeParts.meridiem} onChange={event => setTimeParts(parts => ({ ...parts, meridiem: event.target.value as TimeParts['meridiem'] }))} className="h-8 w-full rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-1 text-center text-[12px] text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-borderActive)]" aria-label="AM or PM">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end border-t border-[var(--color-borderDefault)] pt-2">
            <button ref={setTimeButtonRef} type="button" onClick={completeTimeSelection} className="rounded-md bg-[var(--color-hoverBg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-selectedBg)]">
              Set time
            </button>
          </div>
        </div>) : (<>
      {/* Search Input */}
      <div className="relative flex items-center px-2 py-1.5 border-b border-[var(--color-borderDefault)]">
        <FiSearch size={14} className="text-[var(--color-iconDefault)] mr-2 shrink-0"/>
        <input ref={searchInputRef} type="text" role="combobox" aria-expanded={isOpen} aria-controls="due-date-options" aria-autocomplete="list" aria-activedescendant={activeDescendantId} placeholder={DUE_DATE_PLACEHOLDERS[placeholderIndex]} value={query} onKeyDown={e => {
                if (e.key === 'Backspace' && query === '' && onBackspaceEmpty?.()) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }} onChange={e => {
                const val = e.target.value;
                setQuery(val);
                setActiveIndex(-1);
            }} className="min-w-0 flex-1 bg-transparent text-xs text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none border-none focus:ring-0 p-0"/>
        <button type="button" aria-label="Pick date and time from calendar" title="Pick date and time from calendar" tabIndex={-1} onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
            }} onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }} onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenCalendarPicker();
                searchInputRef.current?.focus();
            }} className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-altsIconTileActionBg)] bg-[var(--color-altsIconTileActionBg)] text-[var(--color-altsIconTileActionFg)] transition-colors hover:border-[var(--color-altsIconTileActionSelectedBg)] hover:bg-[var(--color-altsIconTileActionSelectedBg)] hover:text-[var(--color-altsIconTileActionSelectedFg)]">
          <FaRegCalendarAlt size={13}/>
        </button>
      </div>

      {/* Options List */}
      <div id="due-date-options" role="listbox" className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
        {options.map((opt, idx) => {
                const isHighlighted = activeIndex === idx;
                if (opt.disabled) {
                    return (<div key={opt.id} id={`due-option-${opt.id}`} role="option" aria-disabled="true" className="w-full flex items-start justify-between px-2.5 py-2 rounded-lg text-[12.5px] leading-snug opacity-70 text-[var(--color-textMuted)] cursor-not-allowed">
                <span className="whitespace-normal text-left">{opt.label}</span>
              </div>);
                }
                return (<button key={opt.id} id={`due-option-${opt.id}`} role="option" aria-selected={isHighlighted} type="button" onMouseEnter={() => setActiveIndex(idx)} onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                    }} onClick={e => {
                        e.stopPropagation();
                        handleSelectOption(opt);
                    }} className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[12.5px] font-medium transition-colors cursor-pointer ${isHighlighted ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]' : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'}`}>
              <div className="flex items-center gap-2">
                <FaRegCalendarAlt size={12} className="text-[var(--color-iconDefault)] shrink-0"/>
                <span className="truncate max-w-[130px]">{opt.label}</span>
              </div>
              {opt.secondary && <span className="text-[11px] text-[var(--color-textSecondary)] font-normal">{opt.secondary}</span>}
            </button>);
            })}
      </div>
        </>)}
    </div>);
};

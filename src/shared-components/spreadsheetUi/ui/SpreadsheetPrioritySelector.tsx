import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { FiAlertOctagon, FiCheck, FiCheckCircle, FiClock, FiFlag, FiLoader, FiPlayCircle, FiX } from 'react-icons/fi';
export interface SpreadsheetPrioritySelectorProps {
    cellElement: HTMLElement | null;
    initialPriority?: string;
    onSave: (priority: string) => void;
    onCancel: () => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
    onCommit?: () => void;
}
const DEFAULT_PRIORITIES = ['Critical', 'Urgent', 'In Progress', 'Done', 'Backlog'];
const getPriorityIcon = (priority: string) => {
    const normalizedPriority = priority.trim().toLowerCase();
    if (normalizedPriority === 'critical') {
        return <FiAlertOctagon size={13} className="shrink-0 text-[var(--color-error)]"/>;
    }
    if (normalizedPriority === 'urgent') {
        return <FiClock size={13} className="shrink-0 text-[var(--color-warning)]"/>;
    }
    if (normalizedPriority === 'in progress') {
        return <FiPlayCircle size={13} className="shrink-0 text-[var(--color-accent)]"/>;
    }
    if (normalizedPriority === 'done') {
        return <FiCheckCircle size={13} className="shrink-0 text-[var(--color-success)]"/>;
    }
    if (normalizedPriority === 'backlog') {
        return <FiLoader size={13} className="shrink-0 text-[var(--color-textMuted)]"/>;
    }
    return <FiFlag size={13} className="shrink-0 text-[var(--color-textSecondary)]"/>;
};
const computePosition = (cellElement: HTMLElement | null) => {
    if (!cellElement) {
        return { top: 100, left: 100, width: 240 };
    }
    const rect = cellElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const popoverHeight = 236;
    const placeAbove = rect.bottom + popoverHeight > viewportHeight && rect.top > popoverHeight;
    return {
        top: placeAbove
            ? Math.max(8, rect.top - popoverHeight - 4)
            : Math.min(viewportHeight - popoverHeight - 8, rect.bottom + 4),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 250)),
        width: Math.max(220, rect.width),
    };
};
const getCellThemeVars = (cellElement: HTMLElement | null): React.CSSProperties => {
    if (!cellElement || typeof window === 'undefined')
        return {};
    const computed = window.getComputedStyle(cellElement);
    const variableNames = [
        '--color-popupBg',
        '--color-inputBg',
        '--color-selectedBg',
        '--color-hoverBg',
        '--color-textPrimary',
        '--color-textSecondary',
        '--color-textPlaceholder',
        '--color-borderDefault',
        '--color-borderActive'
    ];
    return variableNames.reduce<React.CSSProperties>((style, variableName) => {
        const value = computed.getPropertyValue(variableName).trim();
        if (value) {
            (style as Record<string, string>)[variableName] = value;
        }
        return style;
    }, {});
};
export const SpreadsheetPrioritySelector: React.FC<SpreadsheetPrioritySelectorProps> = ({ cellElement, initialPriority = '', onSave, onCancel, onNavigateFromCleanEdit, onCommit, }) => {
    const [selectedPriority, setSelectedPriority] = useState(initialPriority);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [position, setPosition] = useState(() => computePosition(cellElement));
    const [themeVars, setThemeVars] = useState<React.CSSProperties>(() => getCellThemeVars(cellElement));
    useLayoutEffect(() => {
        setPosition(computePosition(cellElement));
        setThemeVars(getCellThemeVars(cellElement));
    }, [cellElement]);
    useLayoutEffect(() => {
        searchInputRef.current?.focus();
    }, []);
    const priorityOptions = React.useMemo(() => {
        const trimmedInitial = initialPriority.trim();
        const options = trimmedInitial && !DEFAULT_PRIORITIES.includes(trimmedInitial)
            ? [trimmedInitial, ...DEFAULT_PRIORITIES]
            : DEFAULT_PRIORITIES;
        const term = searchTerm.toLowerCase().trim();
        if (!term)
            return options;
        return options.filter(priority => priority.toLowerCase().includes(term));
    }, [initialPriority, searchTerm]);
    const canCreatePriority = React.useMemo(() => {
        const trimmed = searchTerm.trim();
        return Boolean(trimmed) && !priorityOptions.some(priority => priority.toLowerCase() === trimmed.toLowerCase());
    }, [priorityOptions, searchTerm]);
    const visibleOptions = React.useMemo(() => (canCreatePriority ? [`Create "${searchTerm.trim()}"`, ...priorityOptions] : priorityOptions), [canCreatePriority, priorityOptions, searchTerm]);
    useEffect(() => {
        setFocusedIndex(0);
    }, [searchTerm]);
    useEffect(() => {
        if (optionRefs.current.some(option => option === document.activeElement))
            optionRefs.current[focusedIndex]?.focus();
    }, [focusedIndex, visibleOptions]);
    useEffect(() => {
        const handlePriorityArrowKey = (event: KeyboardEvent) => {
            const target = event.target as Node | null;
            if (!target || !popoverRef.current?.contains(target))
                return;
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
                return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (target === searchInputRef.current) {
                const nextIndex = event.key === 'ArrowDown' ? 0 : visibleOptions.length - 1;
                if (nextIndex >= 0) {
                    setFocusedIndex(nextIndex);
                    optionRefs.current[nextIndex]?.focus();
                }
                return;
            }
            setFocusedIndex(currentIndex => {
                if (visibleOptions.length === 0)
                    return 0;
                return event.key === 'ArrowDown'
                    ? (currentIndex + 1) % visibleOptions.length
                    : (currentIndex - 1 + visibleOptions.length) % visibleOptions.length;
            });
        };
        window.addEventListener('keydown', handlePriorityArrowKey, true);
        return () => window.removeEventListener('keydown', handlePriorityArrowKey, true);
    }, [visibleOptions.length]);
    useEffect(() => {
        let isReady = false;
        const readyTimer = setTimeout(() => {
            isReady = true;
        }, 100);
        const handleOutsideClick = (event: MouseEvent) => {
            if (!isReady)
                return;
            const target = event.target as Node | null;
            if (!target || !document.body.contains(target))
                return;
            if (popoverRef.current?.contains(target) || (target as HTMLElement).closest?.('[data-ignore-grid-nav="true"]')) {
                return;
            }
            if (cellElement?.contains(target))
                return;
            onCancel();
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            clearTimeout(readyTimer);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [cellElement, onCancel]);
    const savePriority = (priority: string) => {
        onSave(priority.trim());
    };
    const handleOptionSelect = (option: string) => {
        if (canCreatePriority && option.startsWith('Create "')) {
            savePriority(searchTerm);
            return;
        }
        savePriority(option);
    };
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
        }
        if (event.key === 'Tab' && onNavigateFromCleanEdit) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            onNavigateFromCleanEdit(0, event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setFocusedIndex(prev => (visibleOptions.length > 0 ? (prev + 1) % visibleOptions.length : 0));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setFocusedIndex(prev => visibleOptions.length > 0 ? (prev - 1 + visibleOptions.length) % visibleOptions.length : 0);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const option = visibleOptions[focusedIndex];
            if (option) {
                handleOptionSelect(option);
                onCommit?.();
                return;
            }
            savePriority(searchTerm);
        }
    };
    const popoverContent = (<div ref={popoverRef} data-ignore-grid-nav="true" data-todo-local-escape="true" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown} style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            zIndex: 99999,
            ...themeVars,
        }} className={clsx('flex select-none flex-col gap-2 rounded-lg border p-2.5 shadow-2xl', 'border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] text-[var(--color-textPrimary)]')}>
      <div className="-mx-2.5 -mt-2.5 flex items-center border-b border-[var(--color-borderDefault)] px-3 py-2.5 focus-within:border-[var(--color-borderActive)]">
        <input ref={searchInputRef} type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} aria-label="Search or create priority" placeholder="Search or create priority..." className="min-w-0 flex-1 border-none bg-transparent text-[12px] font-medium text-[var(--color-textPrimary)] caret-[var(--color-accent)] outline-none placeholder:text-[var(--color-textPlaceholder)]"/>
        {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} className="rounded p-0.5 text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]">
            <FiX size={12}/>
          </button>)}
      </div>

      <div className="max-h-[160px] space-y-0.5 overflow-y-auto pr-0.5">
        {visibleOptions.length === 0 ? (<div className="flex flex-col items-center gap-1 py-4 text-center text-[11px] font-medium text-[var(--color-textSecondary)]">
            <FiFlag size={16} className="opacity-50"/>
            <span>No matching priorities</span>
          </div>) : (visibleOptions.map((option, index) => {
            const priorityValue = canCreatePriority && option.startsWith('Create "') ? searchTerm.trim() : option;
            const isChecked = selectedPriority === priorityValue;
            const isFocused = index === focusedIndex;
            return (<button key={`${option}-${index}`} type="button" ref={element => {
                    optionRefs.current[index] = element;
                }} tabIndex={isFocused ? 0 : -1} onFocus={() => setFocusedIndex(index)} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedPriority(priorityValue);
                    handleOptionSelect(option);
                }} onMouseEnter={() => setFocusedIndex(index)} className={clsx('flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] transition-colors', isChecked
                    ? 'bg-[var(--color-selectedBg)] font-medium text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]', isFocused && 'ring-1 ring-[var(--color-borderActive)] ring-inset')}>
                <span className="flex min-w-0 items-center gap-2">
                  {getPriorityIcon(priorityValue)}
                  <span className="truncate">{option}</span>
                </span>
                {isChecked && <FiCheck size={13} className="shrink-0 text-[var(--color-textPrimary)]"/>}
              </button>);
        }))}
      </div>

      <div className="mt-0.5 flex items-center justify-between border-t border-[var(--color-borderDefault)] pt-2">
        <button type="button" onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            savePriority('');
        }} className="rounded border border-[var(--color-borderDefault)] px-2 py-1 text-[11px] font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
          Clear
        </button>
        <button type="button" onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        }} className="rounded border border-[var(--color-borderDefault)] px-2 py-1 text-[11px] font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
          Cancel
        </button>
      </div>
    </div>);
    return createPortal(popoverContent, document.body);
};

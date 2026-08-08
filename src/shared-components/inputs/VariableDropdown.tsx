import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUIStore } from '../uiStateManager';

interface VariableOption {
  label: string;
  value: string;
}

interface VariableDropdownProps {
  position: { top: number; left: number };
onSelect: (value: string) => void;
  onClose: () => void;
  highlightIndex: number;
  setHighlightIndex: (index: number) => void;
}

// Date options shown in submenu
const DATE_OPTIONS: VariableOption[] = [
  { label: 'Current Date', value: '{{current_date}}' },
  { label: 'Next Day', value: '{{next_day}}' },
  { label: 'Next Week', value: '{{next_week}}' },
  { label: 'Current Time', value: '{{current_time}}' },
  { label: 'Current Year', value: '{{current_year}}' },
  { label: 'Current Month', value: '{{current_month}}' },
  { label: 'Next Month', value: '{{next_month}}' },
];

// For keyboard navigation - flat list of all selectable items
export const VARIABLE_OPTIONS: VariableOption[] = [{ label: 'Custom Variable', value: 'custom' }, ...DATE_OPTIONS];

const VariableDropdown: React.FC<VariableDropdownProps> = ({
  position,
  onSelect,
  onClose,
  highlightIndex,
  setHighlightIndex,
}) => {
  const [datesExpanded, setDatesExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [adjustedTop, setAdjustedTop] = useState<number>(position.top);

  // Height constants
  const COLLAPSED_HEIGHT = 32 + 32 + 16; // Custom Variable + Dates Header + padding = ~80px
  const EXPANDED_HEIGHT = 32 + 32 + DATE_OPTIONS.length * 28 + 16; // Full height with all date options = ~276px
  const BOTTOM_MARGIN = 80; // Buffer to account for footer and trigger flip sooner

  // Two-phase positioning: calculate based on current state (collapsed or expanded)
  useLayoutEffect(() => {
    const viewportHeight = window.innerHeight;
    const currentHeight = datesExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
    const dropdownBottom = position.top + currentHeight + BOTTOM_MARGIN;

    // Check if dropdown would overflow the bottom of the viewport (with margin buffer)
    if (dropdownBottom > viewportHeight) {
      // Flip/lift upward: position dropdown above the trigger point
      const flippedTop = Math.max(0, position.top - currentHeight - 20);
      setAdjustedTop(flippedTop);
    } else {
      setAdjustedTop(position.top);
    }
  }, [position.top, datesExpanded]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        // If dates not expanded and we're on Custom, just go to Dates
        if (highlightIndex === 0) {
          setHighlightIndex(1);
        } else if (highlightIndex === 1 && !datesExpanded) {
          // Do nothing if on Dates and closed - user must press Enter
        } else if (datesExpanded) {
          setHighlightIndex(Math.min(highlightIndex + 1, VARIABLE_OPTIONS.length - 1));
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        if (highlightIndex <= 1) {
          setHighlightIndex(0);
          // Don't auto-collapse on up, let user decide or use Backspace/Left
        } else {
          setHighlightIndex(highlightIndex - 1);
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        // If on Dates header, toggle expansion
        if (highlightIndex === 0) {
          onSelect(VARIABLE_OPTIONS[0].value);
        } else if (highlightIndex === 1) {
          // Dates header selected
          setDatesExpanded(prev => !prev);
        } else if (datesExpanded && highlightIndex > 1) {
          onSelect(VARIABLE_OPTIONS[highlightIndex].value);
        }
      } else if (event.key === 'Backspace') {
        if (datesExpanded) {
          event.preventDefault();
          event.stopPropagation();
          setDatesExpanded(false);
          setHighlightIndex(1); // Go back to Dates header
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [highlightIndex, onSelect, onClose, setHighlightIndex, datesExpanded]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-[var(--color-popupBg)] border border-white/10 rounded-lg shadow-lg py-1"
      style={{
        top: adjustedTop,
        left: position.left,
        width: '180px',
      }}
      onMouseDown={e => e.stopPropagation()}>
      {/* Custom Variable Option */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          onSelect('custom');
        }}
        onMouseEnter={() => setHighlightIndex(0)}
        className={`px-3 py-1.5 text-sm cursor-pointer transition-colors font-medium ${
          highlightIndex === 0
            ? 'bg-[var(--color-activeBg)] text-[var(--color-textPrimary)]'
            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)]'
        }`}>
        Custom Variable
      </div>

      {/* Dates Header */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          setDatesExpanded(!datesExpanded);
        }}
        onMouseEnter={() => setHighlightIndex(1)}
        className={`px-3 py-1.5 text-sm cursor-pointer transition-colors font-medium flex items-center justify-between ${
          highlightIndex === 1
            ? 'bg-[var(--color-activeBg)] text-[var(--color-textPrimary)]'
            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)]'
        }`}>
        <span> Dates</span>
        <span className="text-[10px] opacity-60">{datesExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Dates Submenu */}
      {datesExpanded && (
        <div className="pl-3 mt-0.5">
          {DATE_OPTIONS.map(({ label, value }, index) => {
            const flatIndex = index + 1; // +1 because Custom is at 0
            return (
              <div
                key={value}
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(value);
                }}
                onMouseEnter={() => setHighlightIndex(flatIndex)}
                className={`px-2 py-1 text-xs cursor-pointer transition-colors rounded ${
                  highlightIndex === flatIndex
                    ? 'bg-[var(--color-activeBg)] text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                }`}>
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VariableDropdown;


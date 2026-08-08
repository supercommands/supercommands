import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaEdit, FaTimes } from 'react-icons/fa';
import { useUIStore } from '../../../../../shared-components/uiStateManager';

export type AutomationSuggestionsListItem = {
  id: string;
  label: string;
  value: string;
  kind?: 'option' | 'history';
};

interface AutomationSuggestionsListProps {
  items: AutomationSuggestionsListItem[];
  query: string;
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  onEdit?: () => void;
}

const AutomationSuggestionsList: React.FC<AutomationSuggestionsListProps> = ({
  items,
  query,
  selectedValue,
  onSelect,
  onClose,
  onEdit,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    // If the query is empty OR exactly matches the selected value, show all items
    // (This allows showing all alternatives when focusing a pre-populated field)
    if (!trimmed || (selectedValue && trimmed === selectedValue.toLowerCase())) {
      return items;
    }
    return items.filter(item => {
      const labelMatch = item.label.toLowerCase().includes(trimmed);
      const valueMatch = item.value.toLowerCase().includes(trimmed);
      return labelMatch || valueMatch;
    });
  }, [items, query, selectedValue]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      onClose();
    }
  }, [filteredItems.length, onClose]);

  useEffect(() => {
    setActiveIndex(prev => {
      if (filteredItems.length === 0) return -1;
      if (prev < 0) return 0;
      if (prev > filteredItems.length - 1) return filteredItems.length - 1;
      return prev;
    });
  }, [filteredItems]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(prev => {
          if (filteredItems.length === 0) return -1;
          const next = prev + 1;
          return next > filteredItems.length - 1 ? 0 : next;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(prev => {
          if (filteredItems.length === 0) return -1;
          const next = prev - 1;
          return next < 0 ? filteredItems.length - 1 : next;
        });
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (activeIndex >= 0 && filteredItems[activeIndex]) {
          onSelect(filteredItems[activeIndex].value);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filteredItems, activeIndex, onClose, onSelect]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div className="py-1 min-w-[320px]">
      <div className="grid grid-cols-[1.2fr_1fr] px-3 py-1 text-[10px] font-bold text-neutral-400 border-y border-neutral-100 dark:border-neutral-800">
        <div className="pr-2">Name</div>
        <div className="pl-2 border-l border-neutral-200 dark:border-neutral-700">Value</div>
      </div>
      <div className="max-h-48 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item, index) => {
          const isSelected = selectedValue === item.value;
          const isActive = index === activeIndex;
          return (
            <button
              key={item.id}
              ref={el => {
                itemRefs.current[index] = el;
              }}
              onClick={() => onSelect(item.value)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full grid grid-cols-[1.2fr_1fr] items-center px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              } ${isActive && !isSelected ? 'bg-neutral-50 dark:bg-neutral-800/70' : ''}`}>
              <span className="truncate pr-2 text-left">{item.label}</span>
              <span className="truncate pl-2 border-l border-neutral-200 dark:border-neutral-700 text-left">
                {item.value || '-'}
              </span>
              {isSelected && <FaCheck size={8} className="text-neutral-500 absolute right-3" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-2 py-1 border-t border-neutral-100 dark:border-neutral-800">
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Edit dropdown options">
            <FaEdit size={10} />
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Close menu">
          <FaTimes size={10} />
        </button>
      </div>
    </div>
  );
};

export default AutomationSuggestionsList;

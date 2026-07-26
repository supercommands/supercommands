import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaTimes } from 'react-icons/fa';

interface FieldOptionsDropdownProps {
  options: string[];
  onSelect: (value: string) => void;
  className?: string;
}

const FieldOptionsDropdown: React.FC<FieldOptionsDropdownProps> = ({ options, onSelect, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!options || options.length === 0) return null;

  return (
    <div className={`relative ${className || ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors text-neutral-500 dark:text-neutral-400"
        title="Show Options">
        <FaChevronDown size={10} />
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Select Option
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
              <FaTimes size={10} />
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                }}
                className="text-left px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs rounded transition-colors truncate"
                title={opt}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldOptionsDropdown;

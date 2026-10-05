import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { FaSearch, FaBriefcase, FaCheck } from 'react-icons/fa';
// import { FaPlus } from 'react-icons/fa';
import { useDestination, DestinationGroup } from './hooks/useDestination';
import { FiZapOff } from 'react-icons/fi';
interface DestinationPickerProps {
    selectedOrganisationId?: string | null;
    onSelectOrganisation: (organisationId: string) => void;
    onClear?: () => void;
    onClose: () => void;
    className?: string;
}
export const DestinationPicker: React.FC<DestinationPickerProps> = ({ selectedOrganisationId, onSelectOrganisation, onClear, onClose, className = '', }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const { destinations } = useDestination();
    // Auto focus input on mount and reset activeIndex to 0
    useEffect(() => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        searchInputRef.current?.focus();
        const timer = setTimeout(() => searchInputRef.current?.focus(), 10);
        return () => clearTimeout(timer);
    }, []);
    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    // Filter based on search query
    const filteredDestinations = useMemo(() => {
        if (!query.trim())
            return destinations;
        const lowerQuery = query.toLowerCase();
        return destinations
            .map(group => {
            const organisationMatches = group.organisation.organisationName?.toLowerCase().includes(lowerQuery);
            if (organisationMatches) {
                return {
                    ...group,
                } as DestinationGroup;
            }
            return null;
        })
            .filter(Boolean) as DestinationGroup[];
    }, [destinations, query]);
    // Build a flat list of selectable items for keyboard navigation
    type FlatItem = {
        id: string;
        type: 'organisation';
        organisationId: string;
        label: string;
    };
    const flatItems = useMemo(() => {
        const items: FlatItem[] = [];
        filteredDestinations.forEach(group => {
            items.push({
                id: `ws-${group.organisation.id}`,
                type: 'organisation',
                organisationId: group.organisation.id,
                label: group.organisation.organisationName,
            });
        });
        return items;
    }, [filteredDestinations]);
    // Reset activeIndex when query changes
    useEffect(() => {
        setActiveIndex(0);
    }, [query]);
    // Capture-phase keydown listener for strict keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
            }
            if (e.key === 'ArrowDown') {
                setActiveIndex(prev => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
            }
            else if (e.key === 'ArrowUp') {
                setActiveIndex(prev => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
            }
            else if (e.key === 'Enter') {
                const target = flatItems[activeIndex];
                if (target) {
                    onSelectOrganisation(target.organisationId);
                    onClose();
                }
            }
            else if (e.key === 'Escape') {
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [flatItems, activeIndex, onSelectOrganisation, onClose]);
    let flatCounter = 0;
    return (<div ref={containerRef} className={clsx('w-[260px] bg-[var(--color-popupBg)] supports-[backdrop-filter]:bg-[var(--color-popupBg)]/95 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-lg shadow-lg overflow-hidden flex flex-col z-50', className)}>
      {/* Header Bar */}
      <div className="px-2.5 py-1.5 border-b border-[var(--color-borderDefault)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-[var(--color-textMuted)] uppercase">
          {(<span>Select Location</span>)}
        </div>

        <div className="flex items-center gap-1">
          
          

          {(selectedOrganisationId) && onClear && (<button type="button" onClick={e => {
                e.stopPropagation();
                onClear();
                onClose();
            }} className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1 text-[10px] font-medium" title="Clear Location">
              <span>Clear</span>
              <FiZapOff size={11}/>
            </button>)}
        </div>
      </div>

      {/* Main Content Area */}
      
      {(<div className="p-2 space-y-2">
          <div className="relative px-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]" size={12}/>
            <input ref={searchInputRef} className={clsx('w-full pl-8 pr-3 py-1.5 text-[13px] font-medium rounded-lg focus:outline-none transition-all', 'text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] focus:ring-1 focus:ring-[var(--color-borderActive)] placeholder:text-[var(--color-textPlaceholder)] border border-transparent focus:border-[var(--color-borderDefault)]')} placeholder="Find organisation..." value={query} onChange={e => setQuery(e.target.value)}/>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-1 pb-1">
            {filteredDestinations.length === 0 ? (<div className="text-xs px-2 py-6 text-center text-[var(--color-textSecondary)]">
                No destinations found.
              </div>) : (filteredDestinations.map(group => (<div key={group.organisation.id} className="mb-1.5 last:mb-0">
                  {/* Workspace Header (Selectable) */}
                  {(() => {
                    const itemIndex = flatCounter++;
                    const isHighlighted = activeIndex === itemIndex;
                    const isSelected = selectedOrganisationId === group.organisation.id;
                    return (<button type="button" onMouseEnter={() => setActiveIndex(itemIndex)} onClick={() => {
                            onSelectOrganisation(group.organisation.id);
                            onClose();
                        }} className={clsx('w-full group flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer border', isSelected
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border-[var(--color-borderSelected,var(--color-borderDefault))] font-semibold shadow-xs'
                            : isHighlighted
                                ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border-transparent'
                                : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border-transparent')}>
                        <div className={clsx('w-5 h-5 flex items-center justify-center rounded shrink-0', isSelected
                            ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                            : isHighlighted
                                ? 'bg-[var(--color-inputBg)] text-[var(--color-textPrimary)]'
                                : 'bg-[var(--color-inputBg)] text-[var(--color-iconDefault)]')}>
                          <FaBriefcase size={10}/>
                        </div>
                        <span className="text-[13px] font-semibold flex-1 truncate text-[var(--color-textPrimary)]">
                          {group.organisation.organisationName}
                        </span>
                        {isSelected && <FaCheck size={12} className="text-[var(--color-textPrimary)] shrink-0 ml-2"/>}
                      </button>);
                })()}

                  
                </div>)))}
          </div>
        </div>)}
    </div>);
};

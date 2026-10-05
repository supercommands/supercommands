import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';
import { FiPlus } from 'react-icons/fi';
import { WIDGET_CATALOG_CATEGORIES, type WidgetCatalogItem } from '../widgetCatalog';
interface WidgetCatalogGridProps {
    variant?: 'sidebar' | 'compact';
    pendingWidgetIds?: ReadonlySet<string>;
    getWidgetCount?: (widget: WidgetCatalogItem) => number;
    isWidgetDisabled?: (widget: WidgetCatalogItem, count: number) => boolean;
    onSelectWidget: (widget: WidgetCatalogItem) => void;
}
const WidgetCatalogGrid: React.FC<WidgetCatalogGridProps> = ({ variant = 'sidebar', pendingWidgetIds, getWidgetCount, isWidgetDisabled, onSelectWidget, }) => {
    const isCompact = variant === 'compact';
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    useEffect(() => {
        if (isCompact)
            return undefined;
        const frameId = window.requestAnimationFrame(() => searchInputRef.current?.focus());
        return () => window.cancelAnimationFrame(frameId);
    }, [isCompact]);
    const filteredCategories = useMemo(() => WIDGET_CATALOG_CATEGORIES.map(category => ({
        ...category,
        items: category.items.filter(widget => widget.title.toLowerCase().includes(normalizedSearchTerm)),
    })).filter(category => category.items.length > 0), [normalizedSearchTerm]);
    return (<div className={isCompact
            ? 'flex h-full w-full flex-col gap-2 overflow-y-auto py-3.5 pl-3.5 pr-1.5 clean-scrollbar'
            : 'flex w-full flex-col gap-4'}>
      {isCompact ? (<div className="flex shrink-0 items-center justify-between w-full min-h-[32px] mb-0.5 px-0.5">
          {!(isSearchExpanded || searchTerm) ? (<>
              <div className="flex items-center gap-1.5 min-w-0">
                <FiPlus size={14} style={{ color: '#10B981' }} className="shrink-0"/>
                <span className="text-[12px] font-semibold text-[var(--color-textPrimary)] truncate">
                  Select a Widget
                </span>
              </div>
              <button type="button" onClick={() => setIsSearchExpanded(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] bg-transparent px-2 py-1 transition-all duration-150 cursor-pointer hover:border-[var(--color-borderActive)] hover:bg-[var(--color-hoverBg)]">
                <LuSearch size={13} className="shrink-0 text-[var(--color-textMuted)]"/>
                <span className="text-xs text-[var(--color-textPlaceholder,var(--color-textMuted))]">Search...</span>
              </button>
            </>) : (<div className="flex w-full items-center rounded-xl border border-[var(--color-borderActive)] bg-transparent px-2.5 py-1 transition-all duration-150">
              <LuSearch size={13} className="mr-1.5 shrink-0 text-[var(--color-textMuted)]"/>
              <input type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onBlur={() => {
                    if (!searchTerm.trim()) {
                        setIsSearchExpanded(false);
                    }
                }} placeholder="Search widgets..." aria-label="Search widgets" autoFocus className="text-xs min-w-0 flex-1 border-0 bg-transparent text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] focus:outline-none"/>
              <button type="button" onClick={() => {
                    setSearchTerm('');
                    setIsSearchExpanded(false);
                }} aria-label="Clear widget search" className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--color-textMuted)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
                <LuX size={13}/>
              </button>
            </div>)}
        </div>) : (<div className="flex shrink-0 items-center rounded-xl border border-transparent bg-transparent px-3 py-2 transition-colors focus-within:border-[var(--color-borderActive)] w-full">
          <LuSearch size={14} className="mr-2 shrink-0 text-[var(--color-textMuted)]"/>
          <input ref={searchInputRef} type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search widgets..." aria-label="Search widgets" autoFocus className="text-xs min-w-0 flex-1 border-0 bg-transparent text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] focus:outline-none"/>
          {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} aria-label="Clear widget search" className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--color-textMuted)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
              <LuX size={13}/>
            </button>)}
        </div>)}

      {filteredCategories.map((category, categoryIndex) => (<section key={category.id} className={isCompact
                ? `flex w-full flex-col gap-1 ${categoryIndex === 0 ? '' : 'border-t border-[var(--color-borderDefault)] pt-2'}`
                : `flex flex-col gap-2.5 ${categoryIndex === 0 ? '' : 'border-t border-[var(--color-borderDefault)] pt-3'}`}>
          <div className={isCompact
                ? 'px-1 text-xs font-bold tracking-wide text-[var(--color-textPrimary)] flex items-center gap-1'
                : 'px-1 text-xs font-bold tracking-wide text-[var(--color-textPrimary)] flex items-center gap-1.5'}>
            <span>{category.title}</span>
          </div>

          <div className={isCompact ? 'grid w-full grid-cols-4 gap-1.5 items-stretch justify-items-center text-center' : 'grid grid-cols-4 gap-1.5'}>
            {category.items.map(widget => {
                const IconComponent = widget.icon;
                const isPending = pendingWidgetIds?.has(widget.id);
                const count = getWidgetCount?.(widget) || 0;
                const isDisabled = isWidgetDisabled?.(widget, count);
                return (<button key={widget.id} type="button" disabled={isPending || isDisabled} onClick={() => onSelectWidget(widget)} aria-label={widget.isEditorAction ? `Open ${widget.title} editor` : (isDisabled ? `${widget.title} widget is already active in this view.` : `Add ${widget.title} widget.`)} title={widget.isEditorAction ? `Open ${widget.title} editor` : (isDisabled ? `${widget.title} (1 active limit reached)` : `Add ${widget.title}`)} className={`group relative flex w-full flex-col items-center justify-center rounded-lg border border-transparent transition-all duration-150 hover:border-[var(--color-borderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${isCompact ? 'bg-transparent hover:bg-[var(--color-hoverBg)] focus-visible:bg-[var(--color-hoverBg)]' : 'bg-[var(--color-cardBg)] hover:bg-[var(--color-bgHover)]'} ${isCompact ? 'min-h-9 p-1 py-1.5' : 'min-h-[60px] p-1.5 py-2'} ${isPending || isDisabled ? 'pointer-events-none cursor-not-allowed border-dashed opacity-50' : 'cursor-pointer'}`}>
                  <IconComponent size={isCompact ? 14 : 17} className={`${isCompact ? 'mb-0.5' : 'mb-1'} shrink-0 text-[var(--color-iconDefault)] transition-colors group-hover:text-[var(--color-textPrimary)]`}/>
                  <span className={`text-xs ${isCompact ? 'tracking-tight' : ''} line-clamp-2 w-full px-0.5 text-center font-medium leading-tight text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]`}>
                    {widget.title}
                  </span>
                </button>);
            })}
          </div>
        </section>))}

      {filteredCategories.length === 0 && (<div className="rounded-xl border border-dashed border-[var(--color-borderDefault)] p-3 text-center text-[var(--color-textMuted)]">
          <span className="text-xs">No matching widgets found.</span>
        </div>)}
    </div>);
};
export default WidgetCatalogGrid;

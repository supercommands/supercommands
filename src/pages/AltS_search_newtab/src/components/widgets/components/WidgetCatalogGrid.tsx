import type * as React from 'react';
import { useMemo, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';
import { WIDGET_CATALOG_CATEGORIES, type WidgetCatalogItem } from '../widgetCatalog';

interface WidgetCatalogGridProps {
  variant?: 'sidebar' | 'compact';
  pendingWidgetIds?: ReadonlySet<string>;
  getWidgetCount?: (widget: WidgetCatalogItem) => number;
  isWidgetDisabled?: (widget: WidgetCatalogItem, count: number) => boolean;
  onSelectWidget: (widget: WidgetCatalogItem) => void;
}

const WidgetCatalogGrid: React.FC<WidgetCatalogGridProps> = ({
  variant = 'sidebar',
  pendingWidgetIds,
  getWidgetCount,
  isWidgetDisabled,
  onSelectWidget,
}) => {
  const isCompact = variant === 'compact';
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredCategories = useMemo(
    () =>
      WIDGET_CATALOG_CATEGORIES.map(category => ({
        ...category,
        items: category.items.filter(widget =>
          widget.title.toLowerCase().includes(normalizedSearchTerm),
        ),
      })).filter(category => category.items.length > 0),
    [normalizedSearchTerm],
  );

  return (
    <div
      className={
        isCompact
          ? 'flex h-full w-full flex-col gap-1 overflow-y-auto p-2 clean-scrollbar'
          : 'flex w-full flex-col gap-4'
      }>
      <div
        className={`flex shrink-0 items-center rounded-xl border border-transparent bg-[var(--color-cardBg,rgba(255,255,255,0.05))] transition-colors focus-within:border-[var(--color-borderActive)] ${
          isCompact ? 'w-3/5 self-center px-2 py-2' : 'w-full px-3 py-2'
        }`}>
        <LuSearch
          size={isCompact ? 13 : 14}
          className={`${isCompact ? 'mr-1.5' : 'mr-2'} shrink-0 text-[var(--color-textMuted)]`}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder="Search widgets..."
          aria-label="Search widgets"
          className={`${isCompact ? 'text-[9px]' : 'text-xs'} min-w-0 flex-1 border-0 bg-transparent text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] focus:outline-none`}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear widget search"
            className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--color-textMuted)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
            <LuX size={isCompact ? 12 : 13} />
          </button>
        )}
      </div>

      {filteredCategories.map((category, categoryIndex) => (
        <section
          key={category.id}
          className={isCompact ? 'flex flex-col gap-1' : `flex flex-col gap-2.5 ${categoryIndex === 0 ? '' : 'pt-1'}`}>
          <div
            className={
              isCompact
                ? 'px-0.5 text-[9px] font-bold tracking-wide text-[var(--color-textMuted)]'
                : 'px-1 text-[11px] font-bold tracking-wide text-[var(--color-textMuted)]'
            }>
            {category.title}
          </div>

          <div className={isCompact ? 'grid grid-cols-4 gap-1' : 'grid grid-cols-4 gap-1.5'}>
            {category.items.map(widget => {
              const IconComponent = widget.icon;
              const isPending = pendingWidgetIds?.has(widget.id) || false;
              const count = getWidgetCount?.(widget) || 0;
              const isDisabled = isWidgetDisabled?.(widget, count) || false;

              return (
                <button
                  key={widget.id}
                  type="button"
                  disabled={isPending || isDisabled}
                  onClick={() => onSelectWidget(widget)}
                  aria-label={isDisabled ? `${widget.title} widget is already active in this view.` : `Add ${widget.title} widget.`}
                  title={isDisabled ? `${widget.title} (1 active limit reached)` : `Add ${widget.title}`}
                  className={`group relative flex flex-col items-center justify-center rounded-lg border border-transparent transition-all duration-150 hover:border-[var(--color-borderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${
                    isCompact ? 'bg-transparent hover:bg-[var(--color-hoverBg)] focus-visible:bg-[var(--color-hoverBg)]' : 'bg-[var(--color-cardBg)] hover:bg-[var(--color-bgHover)]'
                  } ${
                    isCompact ? 'min-h-9 p-1' : 'min-h-[60px] p-1.5 py-2'
                  } ${isPending || isDisabled ? 'pointer-events-none cursor-not-allowed border-dashed opacity-50' : 'cursor-pointer'}`}>
                  <IconComponent
                    size={isCompact ? 14 : 17}
                    className={`${isCompact ? 'mb-0.5' : 'mb-1'} shrink-0 text-[var(--color-iconDefault)] transition-colors group-hover:text-[var(--color-textPrimary)]`}
                  />
                  <span
                    className={`${isCompact ? 'text-[9px]' : 'text-[9.5px]'} line-clamp-2 w-full px-0.5 text-center font-medium leading-tight text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]`}>
                    {widget.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {filteredCategories.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-borderDefault)] p-3 text-center text-[var(--color-textMuted)]">
          <span className={isCompact ? 'text-[9px]' : 'text-xs'}>No matching widgets found.</span>
        </div>
      )}
    </div>
  );
};

export default WidgetCatalogGrid;

import type * as React from 'react';
import { LuPlus } from 'react-icons/lu';
import type { WidgetCatalogItem } from '../widgetCatalog';
import WidgetCatalogGrid from './WidgetCatalogGrid';

interface AddWidgetSlotProps {
  pendingWidgetIds: ReadonlySet<string>;
  getWidgetCount: (widget: WidgetCatalogItem) => number;
  isWidgetDisabled: (widget: WidgetCatalogItem, count: number) => boolean;
  onSelectWidget: (widget: WidgetCatalogItem) => void;
  autoOpenCatalog?: boolean;
}

const AddWidgetSlot: React.FC<AddWidgetSlotProps> = ({
  pendingWidgetIds,
  getWidgetCount,
  isWidgetDisabled,
  onSelectWidget,
  autoOpenCatalog = false,
}) => (
  <article
    className="group/add-widget relative h-full w-full overflow-hidden rounded-[26px] border border-dashed border-[rgba(15,23,42,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent hover:bg-[var(--color-widgetBg)] hover:border-transparent focus-within:bg-[var(--color-widgetBg)] focus-within:border-transparent text-[var(--color-textPrimary)] focus-within:ring-2 focus-within:ring-[var(--color-focusRing)]"
    data-add-widget-slot="true"
    data-no-widget-drag="true"
    onPointerDown={event => event.stopPropagation()}>
    <div className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-150 group-hover/add-widget:opacity-0 group-focus-within/add-widget:opacity-0 ${autoOpenCatalog ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-borderDefault)] text-[var(--color-iconDefault)]">
        <LuPlus size={17} />
      </div>
      <span className="text-[11px] font-medium text-[var(--color-textSecondary)]">Add Widget</span>
    </div>

    <div className={`absolute inset-0 z-10 transition-opacity duration-150 group-hover/add-widget:opacity-100 group-focus-within/add-widget:opacity-100 ${autoOpenCatalog ? 'opacity-100' : 'opacity-0'}`}>
      <WidgetCatalogGrid
        variant="compact"
        pendingWidgetIds={pendingWidgetIds}
        getWidgetCount={getWidgetCount}
        isWidgetDisabled={isWidgetDisabled}
        onSelectWidget={onSelectWidget}
      />
    </div>
  </article>
);

export default AddWidgetSlot;

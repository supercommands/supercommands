import React, { useState } from 'react';
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
const AddWidgetSlot: React.FC<AddWidgetSlotProps> = ({ pendingWidgetIds, getWidgetCount, isWidgetDisabled, onSelectWidget, autoOpenCatalog = false, }) => {
    const [isOpen, setIsOpen] = useState(false);
    const showCatalog = autoOpenCatalog || isOpen;
    return (<article className="group/add-widget relative h-full w-full overflow-hidden rounded-[26px] border border-dashed border-[rgba(15,23,42,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent hover:bg-[var(--color-widgetBg)] hover:border-transparent focus-within:bg-[var(--color-widgetBg)] focus-within:border-transparent text-[var(--color-textPrimary)] focus-within:ring-2 focus-within:ring-[var(--color-focusRing)]" data-add-widget-slot="true" data-no-widget-drag="true" onPointerDown={event => event.stopPropagation()} onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget))
        setIsOpen(false); }}>
    {!showCatalog && <button type="button" className="absolute inset-0 flex flex-col items-center justify-center gap-2" aria-label="Add widget" onClick={() => setIsOpen(true)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-borderDefault)] text-black dark:text-white">
        <LuPlus size={17}/>
      </div>
      <span className="text-[11px] font-medium text-[var(--color-textSecondary)]">Add Widget</span>
    </button>}

    {showCatalog && <div className="absolute inset-0 z-10 flex flex-col justify-center">
      <WidgetCatalogGrid variant="compact" pendingWidgetIds={pendingWidgetIds} getWidgetCount={getWidgetCount} isWidgetDisabled={isWidgetDisabled} onSelectWidget={onSelectWidget}/>
    </div>}
  </article>);
};
export default AddWidgetSlot;

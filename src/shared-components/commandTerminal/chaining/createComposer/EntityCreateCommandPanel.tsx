import * as React from 'react';
import type { CreateComposerField, CreateComposerFooterAction, CreateComposerProperty, CreateComposerValidationState, } from './CreateComposerTypes';
import { buildCreateComposerLayout, moveCreateComposerSelectedIndex } from './CreateComposerModel';
import { CreateComposerFieldRow, CreateComposerPropertyRow, CreateComposerSection } from './CreateComposerRows';
type EntityCreateCommandPanelProps = {
    id: string;
    requiredFields: readonly CreateComposerField[];
    properties: readonly CreateComposerProperty[];
    expandedSections?: React.ReactNode;
    expandedRowCount?: number;
    showRequiredSection?: boolean;
    showPropertiesSection?: boolean;
    isSelected: boolean;
    selectedIndex: number;
    height: number;
    helperControlSelector: string;
    helperProps?: Record<string, string>;
    shortcutValidationState?: CreateComposerValidationState;
    hotkeyValidationState?: CreateComposerValidationState;
    footerAction: CreateComposerFooterAction;
    onActivate: () => void;
    onSelect: () => void;
    onSelectedIndexChange: (index: number) => void;
    onRequiredFieldActivate: (fieldKey: string) => void;
    onPropertyActivate: (propertyKey: string) => void;
    onShowFooterTooltip?: (element: HTMLElement) => void;
    onHideFooterTooltip?: () => void;
    onComposerKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};
const getFooterStatus = (state?: CreateComposerValidationState, fallback?: string) => {
    if (!state)
        return null;
    if (state.status === 'checking')
        return { text: 'Checking...', tone: 'muted' as const };
    if (state.status === 'available')
        return { text: 'Available', tone: 'success' as const };
    if (state.status === 'conflict')
        return { text: state.message || fallback || 'Already in use', tone: 'error' as const };
    if (state.status === 'error')
        return { text: state.message || fallback || 'Not available', tone: 'error' as const };
    return null;
};
export const EntityCreateCommandPanel: React.FC<EntityCreateCommandPanelProps> = ({ id, requiredFields, properties, expandedSections = null, expandedRowCount = 0, showRequiredSection = true, showPropertiesSection = true, isSelected, selectedIndex, height, helperControlSelector, helperProps = {}, shortcutValidationState, hotkeyValidationState, footerAction, onActivate, onSelect, onSelectedIndexChange, onRequiredFieldActivate, onPropertyActivate, onShowFooterTooltip, onHideFooterTooltip, onComposerKeyDown, }) => {
    void onActivate;
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
    const visibleRequiredFields = showRequiredSection ? requiredFields : [];
    const visibleProperties = showPropertiesSection ? properties : [];
    const layout = React.useMemo(() => buildCreateComposerLayout({
        expandedRowCount,
        requiredFieldCount: visibleRequiredFields.length,
        propertyCount: visibleProperties.length,
    }), [expandedRowCount, visibleProperties.length, visibleRequiredFields.length]);
    const totalRowCount = layout.totalRowCount;
    const visibleSelectedIndex = totalRowCount > 0
        ? Math.max(0, Math.min(selectedIndex, totalRowCount - 1))
        : 0;
    const footerStatus = React.useMemo(() => {
        const states = [
            getFooterStatus(shortcutValidationState, 'Text command is not available'),
            getFooterStatus(hotkeyValidationState, 'Hotkey is not available')
        ].filter(Boolean) as Array<{
            text: string;
            tone: 'muted' | 'success' | 'error';
        }>;
        return (states.find(state => state.tone === 'error') ||
            states.find(state => state.tone === 'muted') ||
            states.find(state => state.tone === 'success'));
    }, [hotkeyValidationState, shortcutValidationState]);
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container)
            return;
        const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-create-composer-row]'));
        const row = rows[visibleSelectedIndex];
        if (!row)
            return;
        const rowTop = row.offsetTop;
        const rowBottom = rowTop + row.offsetHeight;
        const visibleTop = container.scrollTop;
        const visibleBottom = visibleTop + container.clientHeight;
        if (rowTop < visibleTop) {
            container.scrollTop = rowTop;
        }
        else if (rowBottom > visibleBottom) {
            container.scrollTop = rowBottom - container.clientHeight;
        }
    }, [visibleSelectedIndex]);
    const stopFooterActionEvent = (event: React.SyntheticEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        (event.nativeEvent as Event & {
            stopImmediatePropagation?: () => void;
        }).stopImmediatePropagation?.();
        onHideFooterTooltip?.();
    };
    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        onComposerKeyDown?.(event as React.KeyboardEvent<HTMLDivElement>);
        if (event.defaultPrevented)
            return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            onSelectedIndexChange(moveCreateComposerSelectedIndex(visibleSelectedIndex, event.key === 'ArrowDown' ? 1 : -1, totalRowCount));
            return;
        }
        if (event.key !== 'Enter' && event.key !== ' ')
            return;
        if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)
            return;
        event.preventDefault();
        event.stopPropagation();
        const requiredStart = layout.requiredRowOffset;
        const propertyStart = layout.propertyRowOffset;
        if (visibleSelectedIndex >= requiredStart && visibleSelectedIndex < propertyStart) {
            const field = visibleRequiredFields[visibleSelectedIndex - requiredStart];
            if (field)
                onRequiredFieldActivate(field.key);
            return;
        }
        if (visibleSelectedIndex >= propertyStart) {
            const property = visibleProperties[visibleSelectedIndex - propertyStart];
            if (property)
                onPropertyActivate(property.key);
            return;
        }
    };
    return (<div id={id} role="option" tabIndex={-1} aria-selected={isSelected} className="flex w-full min-h-0 flex-col rounded-none border-0 bg-transparent pt-1 pb-0 text-[var(--alts-text-primary)]" style={{ height }} onMouseDown={event => {
            if (event.target instanceof HTMLElement && event.target.closest(helperControlSelector))
                return;
            event.preventDefault();
            event.stopPropagation();
        }} onClick={event => {
            if (event.target instanceof HTMLElement && event.target.closest(helperControlSelector))
                return;
            event.preventDefault();
            event.stopPropagation();
            onSelect();
        }} onKeyDown={handleKeyDown} onMouseEnter={onSelect}>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        {expandedSections}
        {visibleRequiredFields.length > 0 ? (<CreateComposerSection title="Required">
            {visibleRequiredFields.map((field, index) => (<CreateComposerFieldRow key={field.key} field={field} selected={isSelected && visibleSelectedIndex === layout.requiredRowOffset + index} helperProps={helperProps} onSelect={() => onSelectedIndexChange(layout.requiredRowOffset + index)} onActivate={() => onRequiredFieldActivate(field.key)}/>))}
          </CreateComposerSection>) : null}
        {visibleProperties.length > 0 ? (<CreateComposerSection title="Properties">
            {visibleProperties.map((property, index) => (<CreateComposerPropertyRow key={property.key} property={property} selected={isSelected && visibleSelectedIndex === layout.propertyRowOffset + index} helperProps={helperProps} onSelect={() => onSelectedIndexChange(layout.propertyRowOffset + index)} onActivate={() => onPropertyActivate(property.key)}/>))}
          </CreateComposerSection>) : null}
      </div>

      <div className="mt-auto mb-1 flex shrink-0 justify-end px-4">
        {footerStatus ? (<div className="mr-auto flex min-w-0 items-center gap-2 text-[12px] font-semibold leading-5">
            <span className={footerStatus.tone === 'success'
                ? 'text-[var(--color-success)]'
                : footerStatus.tone === 'error'
                    ? 'min-w-0 truncate text-[var(--color-error)]'
                    : 'text-[var(--alts-text-secondary)]'}>
              {footerStatus.text}
            </span>
          </div>) : null}
        <button type="button" {...helperProps} onPointerDown={stopFooterActionEvent} onMouseDown={stopFooterActionEvent} onMouseEnter={event => {
            if (footerAction.label !== 'Overwrite')
                onShowFooterTooltip?.(event.currentTarget);
        }} onMouseLeave={onHideFooterTooltip} onFocus={event => {
            if (footerAction.label !== 'Overwrite')
                onShowFooterTooltip?.(event.currentTarget);
        }} onBlur={onHideFooterTooltip} onClick={event => {
            stopFooterActionEvent(event);
            footerAction.onActivate();
        }} className="relative z-50 flex cursor-pointer select-none items-center gap-1.5 rounded-[6px] border border-[var(--alts-border-color)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--alts-text-primary)] shadow-none outline-none transition-all hover:bg-[var(--alts-row-hover-bg)] active:scale-95">
          {footerAction.label}
        </button>
      </div>
    </div>);
};

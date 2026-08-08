import type * as React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import type { WidgetSizePreset } from '../widgetDashboard.types';

interface WidgetFloatingToolbarProps {
  activePreset: WidgetSizePreset;
  onApplyPreset: (preset: WidgetSizePreset) => void;
  onDelete: () => void;
}

const WidgetSizeIcon: React.FC<{
  size: WidgetSizePreset;
  className?: string;
}> = ({ size, className }) => {
  const dimensions = {
    small: { x: 5, y: 7, width: 14, height: 10 },
    medium: { x: 3, y: 6, width: 18, height: 12 },
    large: { x: 2, y: 5, width: 20, height: 14 },
  }[size];

  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
      focusable="false">
      <rect
        x={dimensions.x}
        y={dimensions.y}
        width={dimensions.width}
        height={dimensions.height}
        rx="2.5"
        fill="currentColor"
      />
    </svg>
  );
};

const presetOptions: WidgetSizePreset[] = ['small', 'medium', 'large'];

const WidgetFloatingToolbar: React.FC<WidgetFloatingToolbarProps> = ({
  activePreset,
  onApplyPreset,
  onDelete,
}) => {
  return (
    <div
      className="widget-toolbar absolute bottom-3 left-1/2 z-[1010] flex -translate-x-1/2 items-center gap-2 transition-all duration-200"
      data-no-widget-drag="true"
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}>
      <button
        type="button"
        className="relative z-[1020] flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:brightness-110 active:scale-95"
        style={{
          backgroundColor: 'var(--color-danger)',
          color: 'var(--color-widgetToolbarText)',
          boxShadow: '0 10px 24px var(--color-widgetToolbarShadow)',
        }}
        title="Delete widget"
        aria-label="Delete widget"
        data-no-widget-drag="true"
        onClick={onDelete}>
        <FiTrash2 size={15} aria-hidden="true" />
      </button>

      <div
        className="relative z-[1020] flex items-center gap-1 rounded-full p-1.5 border"
        style={{
          backgroundColor: 'var(--color-widgetToolbarBg)',
          borderColor: 'var(--color-widgetToolbarBorder)',
          boxShadow: '0 14px 32px var(--color-widgetToolbarShadow)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          color: 'var(--color-widgetToolbarText)',
        }}>
        {presetOptions.map(preset => {
          const isActive = activePreset === preset;

          return (
            <button
              key={preset}
              type="button"
              className="flex h-7 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:brightness-105 active:scale-95"
              style={{
                backgroundColor: isActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarHoverBg)',
                borderColor: isActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarBorder)',
                color: isActive ? 'var(--color-widgetToolbarBg)' : 'var(--color-widgetToolbarText)',
                boxShadow: isActive
                  ? '0 2px 8px var(--color-widgetToolbarShadow)'
                  : 'inset 0 0 0 1px var(--color-widgetToolbarBorder)',
              }}
              title={`Set widget to ${preset} size`}
              aria-label={`Set widget to ${preset} size`}
              data-no-widget-drag="true"
              onClick={() => onApplyPreset(preset)}>
              <WidgetSizeIcon size={preset} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WidgetFloatingToolbar;

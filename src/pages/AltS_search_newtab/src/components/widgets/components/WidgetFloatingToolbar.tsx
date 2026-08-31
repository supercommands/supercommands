import type * as React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import type { WidgetSizePreset } from '../widgetDashboard.types';

interface WidgetFloatingToolbarProps {
  activePreset: WidgetSizePreset;
  allowedPresets?: readonly WidgetSizePreset[];
  isCustomActive: boolean;
  hasCustomSize: boolean;
  onApplyPreset: (preset: WidgetSizePreset) => void;
  onApplyCustom: () => void;
  onDelete: () => void;
}
 
const WidgetSizeIcon: React.FC<{
  size: WidgetSizePreset;
  className?: string;
}> = ({ size, className }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
      focusable="false">
      {size === 'small' && (
        <rect x="8" y="7" width="8" height="10" rx="2" fill="currentColor" />
      )}
      {size === 'medium' && (
        <>
          <rect x="4" y="7" width="7" height="10" rx="2" fill="currentColor" />
          <rect x="13" y="7" width="7" height="10" rx="2" fill="currentColor" />
        </>
      )}
      {size === 'large' && (
        <>
          <rect x="3" y="7" width="5" height="10" rx="1.5" fill="currentColor" />
          <rect x="9.5" y="7" width="5" height="10" rx="1.5" fill="currentColor" />
          <rect x="16" y="7" width="5" height="10" rx="1.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
};

const WidgetCustomSizeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className ?? 'h-4 w-4'}
    aria-hidden="true"
    focusable="false">
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M16 16L19 13M14 16L19 11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const defaultPresetOptions: WidgetSizePreset[] = ['small', 'medium', 'large'];

const presetLabels: Record<WidgetSizePreset, string> = {
  small: 'Single tile layout',
  medium: 'Two tile layout',
  large: 'Three tile layout',
};

const WidgetFloatingToolbar: React.FC<WidgetFloatingToolbarProps> = ({
  activePreset,
  allowedPresets,
  isCustomActive,
  hasCustomSize,
  onApplyPreset,
  onApplyCustom,
  onDelete,
}) => {
  const presetOptionsToRender = allowedPresets ?? defaultPresetOptions;

  return (
    <div
      className="widget-toolbar absolute bottom-3 left-1/2 z-[1010] flex -translate-x-1/2 items-center gap-2 transition-all duration-200"
      data-no-widget-drag="true"
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}>
      <button
        type="button"
        className="relative z-[1020] flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
        style={{
          backgroundColor: 'var(--color-danger)',
          color: 'var(--color-widgetToolbarText)',
          boxShadow: '0 10px 24px var(--color-widgetToolbarShadow)',
        }}
        title="Delete widget"
        aria-label="Delete widget"
        data-no-widget-drag="true"
        onPointerDown={e => {
          e.stopPropagation();
        }}
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}>
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
        {presetOptionsToRender.map(preset => {
          const isActive = !isCustomActive && activePreset === preset;
          const label = presetLabels[preset];

          return (
            <button
              key={preset}
              type="button"
              className="flex h-7 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
              style={{
                backgroundColor: isActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarHoverBg)',
                borderColor: isActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarBorder)',
                color: isActive ? 'var(--color-widgetToolbarBg)' : 'var(--color-widgetToolbarText)',
                boxShadow: isActive
                  ? '0 2px 8px var(--color-widgetToolbarShadow)'
                  : 'inset 0 0 0 1px var(--color-widgetToolbarBorder)',
              }}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              data-no-widget-drag="true"
              onPointerDown={e => {
                e.stopPropagation();
              }}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                onApplyPreset(preset);
              }}>
              <WidgetSizeIcon size={preset} />
            </button>
          );
        })}

        {isCustomActive && (
          <button
            type="button"
            className="flex h-7 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
            style={{
              backgroundColor: isCustomActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarHoverBg)',
              borderColor: isCustomActive ? 'var(--color-widgetToolbarActiveBg)' : 'var(--color-widgetToolbarBorder)',
              color: isCustomActive ? 'var(--color-widgetToolbarBg)' : 'var(--color-widgetToolbarText)',
              boxShadow: isCustomActive
                ? '0 2px 8px var(--color-widgetToolbarShadow)'
                : 'inset 0 0 0 1px var(--color-widgetToolbarBorder)',
            }}
            title="Restore custom size"
            aria-label="Restore custom widget size"
            aria-pressed={isCustomActive}
            data-no-widget-drag="true"
            onPointerDown={e => {
              e.stopPropagation();
            }}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onApplyCustom();
            }}>
            <WidgetCustomSizeIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default WidgetFloatingToolbar;

import type { WidgetCustomSize, WidgetDashboardState, WidgetGridPosition, WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import { generateEntityId } from '../../../../../../shared-components/utils';

export const WIDGET_GRID_COLUMNS = 12;

export const WIDGET_SIZE_PRESETS: Record<WidgetSizePreset, { w: number; h: number }> = {
  small: { w: 4, h: 5 },
  medium: { w: 8, h: 5 },
  large: { w: 12, h: 5 },
};

export const WIDGET_MACRO_ROW_HEIGHT = WIDGET_SIZE_PRESETS.small.h; // 5
export const WIDGET_MIN_HEIGHT = WIDGET_MACRO_ROW_HEIGHT; // 5
export const WIDGET_MAX_HEIGHT = WIDGET_MACRO_ROW_HEIGHT * 3; // 15

export const ALLOWED_MANUAL_WIDTHS = [4, 8, 12];
export const ALLOWED_MANUAL_HEIGHTS = [
  WIDGET_MACRO_ROW_HEIGHT,
  WIDGET_MACRO_ROW_HEIGHT * 2,
  WIDGET_MACRO_ROW_HEIGHT * 3,
];

export const WIDGET_CONSTRAINTS = {
  minW: 4,
  maxW: 12,
  minH: WIDGET_MACRO_ROW_HEIGHT,
  maxH: WIDGET_MAX_HEIGHT,
};

export const getAllowedWidgetSizePresets = (widgetType?: string): readonly WidgetSizePreset[] => {
  if (widgetType === 'session-item') {
    return ['medium', 'large'] as const;
  }
  if (widgetType === 'todo-list') {
    return ['small', 'medium'] as const;
  }
  return ['small', 'medium', 'large'] as const;
};

export const isWidgetSizePresetAllowed = (widgetType: string | undefined, preset: WidgetSizePreset): boolean => {
  const allowed = getAllowedWidgetSizePresets(widgetType);
  return allowed.includes(preset);
};

export const inferPresetFromWidth = (width: number): WidgetSizePreset => {
  if (width <= 4) return 'small';
  if (width <= 8) return 'medium';
  return 'large';
};

export const getAllowedManualWidths = (): number[] => ALLOWED_MANUAL_WIDTHS;
export const getAllowedManualHeights = (): number[] => ALLOWED_MANUAL_HEIGHTS;

export const snapManualWidgetWidth = (rawWidth: number, x = 0): number => {
  const maxAvailableW = Math.max(4, WIDGET_GRID_COLUMNS - Math.max(0, Math.min(x, WIDGET_GRID_COLUMNS - 4)));
  const validWidths = ALLOWED_MANUAL_WIDTHS.filter(w => w <= maxAvailableW);
  if (validWidths.length === 0) return 4;

  let closest = validWidths[0];
  let minDiff = Math.abs(rawWidth - closest);
  for (let i = 1; i < validWidths.length; i += 1) {
    const diff = Math.abs(rawWidth - validWidths[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validWidths[i];
    }
  }
  return closest;
};

export const snapManualWidgetHeight = (rawHeight: number): number => {
  let closest = ALLOWED_MANUAL_HEIGHTS[0];
  let minDiff = Math.abs(rawHeight - closest);
  for (let i = 1; i < ALLOWED_MANUAL_HEIGHTS.length; i += 1) {
    const diff = Math.abs(rawHeight - ALLOWED_MANUAL_HEIGHTS[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ALLOWED_MANUAL_HEIGHTS[i];
    }
  }
  return closest;
};

export const snapManualWidgetSize = (
  rawWidth: number,
  rawHeight: number,
  x = 0,
): WidgetCustomSize => ({
  w: snapManualWidgetWidth(rawWidth, x),
  h: snapManualWidgetHeight(rawHeight),
});

export const normalizeWidgetCustomSize = (value: unknown): WidgetCustomSize | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const rawW = Number(record.w);
  const rawH = Number(record.h);
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH) || rawW <= 0 || rawH <= 0) return undefined;
  return snapManualWidgetSize(rawW, rawH, 0);
};

export const snapToAllowedWidth = (width: number): number => {
  return snapManualWidgetWidth(width, 0);
};

export const getAllowedWidgetColumns = (width: number): number[] => {
  const normWidth = snapToAllowedWidth(width);
  if (normWidth <= 4) return [0, 4, 8];
  if (normWidth <= 8) return [0, 4];
  return [0];
};

export const snapToAllowedColumn = (x: number, width: number): number => {
  const allowed = getAllowedWidgetColumns(width);
  const clampedX = Math.max(0, Math.min(x, WIDGET_GRID_COLUMNS - snapToAllowedWidth(width)));
  let closest = allowed[0];
  let minDiff = Math.abs(clampedX - closest);
  for (let i = 1; i < allowed.length; i += 1) {
    const diff = Math.abs(clampedX - allowed[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = allowed[i];
    }
  }
  return closest;
};

export const getNearestWidgetSizePreset = (
  width: number,
  height: number,
  currentPreset?: WidgetSizePreset,
): WidgetSizePreset => {
  const presets: WidgetSizePreset[] = ['small', 'medium', 'large'];

  let maxW = 0;
  let minW = Infinity;
  let maxH = 0;
  let minH = Infinity;

  presets.forEach(p => {
    const dim = WIDGET_SIZE_PRESETS[p];
    if (dim.w > maxW) maxW = dim.w;
    if (dim.w < minW) minW = dim.w;
    if (dim.h > maxH) maxH = dim.h;
    if (dim.h < minH) minH = dim.h;
  });

  const rangeW = maxW - minW || 1;
  const rangeH = maxH - minH || 1;

  const distances = presets.map(p => {
    const dim = WIDGET_SIZE_PRESETS[p];
    const dW = (width - dim.w) / rangeW;
    const dH = (height - dim.h) / rangeH;
    return {
      preset: p,
      distance: dW * dW + dH * dH,
    };
  });

  let minDistance = Infinity;
  distances.forEach(d => {
    if (d.distance < minDistance) {
      minDistance = d.distance;
    }
  });

  const tied = distances.filter(d => Math.abs(d.distance - minDistance) < 1e-6);

  if (currentPreset && tied.some(d => d.preset === currentPreset)) {
    return currentPreset;
  }

  return tied[0].preset;
};

/**
 * Downgrade grid-v2 (48-column fine grid) positions to coarse (12-column) positions.
 * This is an idempotent backward-compatibility helper for reading stored v2 records.
 */
export const convertFineGridToLegacyPosition = (
  position: WidgetGridPosition,
): WidgetGridPosition => {
  if (position.gridVersion !== 2) return position;

  const fineX = Number.isFinite(position.x) ? position.x : 0;
  const fineY = Number.isFinite(position.y) ? position.y : 0;
  const fineW = Number.isFinite(position.w) && position.w > 0 ? position.w : 16;
  const fineH = Number.isFinite(position.h) && position.h > 0 ? position.h : 22;

  const legacyX = Math.round(fineX / 4);
  const legacyY = Math.round(fineY / 6);
  const legacyW = Math.max(1, Math.round(fineW / 4));
  const legacyH = Math.max(1, Math.round((fineH + 2) / 6));

  const legacyMinW = position.minW ? Math.max(1, Math.round(position.minW / 4)) : WIDGET_CONSTRAINTS.minW;
  const legacyMaxW = position.maxW ? Math.round(position.maxW / 4) : WIDGET_CONSTRAINTS.maxW;
  const legacyMinH = position.minH ? Math.max(1, Math.round((position.minH + 2) / 6)) : WIDGET_CONSTRAINTS.minH;
  const legacyMaxH = position.maxH ? Math.round((position.maxH + 2) / 6) : WIDGET_CONSTRAINTS.maxH;

  const { gridVersion, ...rest } = position;

  return {
    ...rest,
    x: legacyX,
    y: legacyY,
    w: legacyW,
    h: legacyH,
    minW: legacyMinW,
    maxW: legacyMaxW,
    minH: legacyMinH,
    maxH: legacyMaxH,
  };
};

export const createPresetLayout = (
  preset: WidgetSizePreset,
  x = 0,
  y = 0,
): Omit<WidgetGridPosition, 'i' | 'viewId'> => ({
  x,
  y,
  ...WIDGET_SIZE_PRESETS[preset],
  ...WIDGET_CONSTRAINTS,
});

export const DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE = 'Default View';

export const createDefaultWidgetDashboardState = ({ includeStarterWidget = false } = {}): WidgetDashboardState => ({
  ...(() => {
    const now = Date.now();
    const viewId = generateEntityId('dashboardView');
    const widgets: WidgetInstance[] = [];

    return {
      schemaVersion: 2 as const,
      revision: 1,
      activeViewId: viewId,
      views: [
        {
          id: viewId,
          title: DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
          isDefault: true,
          settings: {},
          createdAt: now,
          updatedAt: now,
        },
      ],
      widgets,
      layout: [],
      updatedAt: now,
    };
  })(),
});

export const applyPresetToGridPosition = (
  position: WidgetGridPosition,
  preset: WidgetSizePreset,
): WidgetGridPosition => {
  const currentPos = position.gridVersion === 2 ? convertFineGridToLegacyPosition(position) : position;
  const size = WIDGET_SIZE_PRESETS[preset];
  const w = size.w;
  const h = size.h;
  const snappedX = snapToAllowedColumn(currentPos.x, w);

  return {
    ...currentPos,
    x: snappedX,
    y: Math.max(currentPos.y, 0),
    w,
    h,
    ...WIDGET_CONSTRAINTS,
  };
};

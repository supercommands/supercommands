import type { WidgetDashboardState, WidgetGridPosition, WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import { generateEntityId } from '../../../../../../shared-components/utils';

export const WIDGET_GRID_COLUMNS = 12;
export const WIDGET_MIN_HEIGHT = 3;
export const WIDGET_MAX_HEIGHT = 12;

export const WIDGET_SIZE_PRESETS: Record<WidgetSizePreset, { w: number; h: number }> = {
  small: { w: 3, h: 3 },
  medium: { w: 4, h: 4 },
  large: { w: 6, h: 6 },
};

export const WIDGET_CONSTRAINTS = {
  minW: 3,
  maxW: 12,
  minH: WIDGET_MIN_HEIGHT,
  maxH: WIDGET_MAX_HEIGHT,
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

const createDefaultWidget = (viewId: string, now: number): WidgetInstance => (
  {
    id: generateEntityId('widget'),
    viewId,
    categoryId: 'core-widgets',
    title: 'Default Widget',
    type: 'default-commands',
    sizePreset: 'medium',
    expansionMode: 'preset',
    settings: {},
    createdAt: now,
    updatedAt: now,
  }
);

export const createDefaultWidgetDashboardState = ({ includeStarterWidget = false } = {}): WidgetDashboardState => ({
  ...(() => {
    const now = Date.now();
    const viewId = generateEntityId('dashboardView');
    const defaultWidget = createDefaultWidget(viewId, now);
    const widgets = includeStarterWidget ? [defaultWidget] : [];

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
      layout: includeStarterWidget
        ? [{ i: defaultWidget.id, viewId, categoryId: defaultWidget.categoryId, ...createPresetLayout('medium') }]
        : [],
      updatedAt: now,
    };
  })(),
});

export const applyPresetToGridPosition = (
  position: WidgetGridPosition,
  preset: WidgetSizePreset,
): WidgetGridPosition => {
  const size = WIDGET_SIZE_PRESETS[preset];
  const w = Math.min(Math.max(size.w, WIDGET_CONSTRAINTS.minW), WIDGET_CONSTRAINTS.maxW, WIDGET_GRID_COLUMNS);
  const h = Math.min(Math.max(size.h, WIDGET_CONSTRAINTS.minH), WIDGET_CONSTRAINTS.maxH);

  return {
    ...position,
    x: Math.min(Math.max(position.x, 0), Math.max(WIDGET_GRID_COLUMNS - w, 0)),
    y: Math.max(position.y, 0),
    w,
    h,
    ...WIDGET_CONSTRAINTS,
  };
};

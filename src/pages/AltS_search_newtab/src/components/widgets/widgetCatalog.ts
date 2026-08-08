import type { IconType } from 'react-icons';
import { LuClock3, LuCloudSun, LuGrid2X2, LuFileText, LuQuote, LuStar } from 'react-icons/lu';
import { FiCheckSquare, FiCode, FiGlobe } from 'react-icons/fi';
import { createPresetLayout } from './engine/widgetDashboardData';
import type { WidgetGridPosition, WidgetSizePreset, WidgetType } from './widgetDashboard.types';

export interface WidgetCatalogItem {
  id: string;
  title: string;
  type: WidgetType;
  icon: IconType;
  sizePreset: WidgetSizePreset;
  layout: Omit<WidgetGridPosition, 'i' | 'viewId'>;
  requiresModal?: boolean;
}

export interface WidgetCatalogCategory {
  id: string;
  title: string;
  items: WidgetCatalogItem[];
}

export const WIDGET_CATALOG_CATEGORIES: WidgetCatalogCategory[] = [
  {
    id: 'core-widgets',
    title: 'Core Widgets',
    items: [
      {
        id: 'widget-favorites',
        title: 'Favorites',
        type: 'favorites',
        icon: LuStar,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
      {
        id: 'widget-time',
        title: 'Time',
        type: 'time',
        icon: LuClock3,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
      {
        id: 'widget-notes-catalog',
        title: 'Notes Widget',
        type: 'note-item',
        icon: LuFileText,
        sizePreset: 'small',
        layout: createPresetLayout('small'),
        requiresModal: true,
      },
    ],
  },
  {
    id: 'productivity-widgets',
    title: 'Productivity',
    items: [
      {
        id: 'widget-todos',
        title: 'Todo List',
        type: 'todo-list',
        icon: FiCheckSquare,
        sizePreset: 'large',
        layout: createPresetLayout('large'),
      },
      {
        id: 'widget-quote-of-the-day',
        title: 'Quote of the Day',
        type: 'quote-of-the-day',
        icon: LuQuote,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
    ],
  },
  {
    id: 'external-widgets',
    title: 'External Widgets',
    items: [
      {
        id: 'widget-weather',
        title: 'Weather',
        type: 'weather',
        icon: LuCloudSun,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
      {
        id: 'widget-news',
        title: 'News',
        type: 'news',
        icon: FiGlobe,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
    ],
  },
  {
    id: 'custom-widgets',
    title: 'Custom Widgets',
    items: [
      {
        id: 'widget-html',
        title: 'HTML',
        type: 'html',
        icon: FiCode,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
        requiresModal: true,
      },
    ],
  },
];

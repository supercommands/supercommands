import type { IconType } from 'react-icons';
import { LuClock3, LuCloudSun, LuFileText, LuLayers, LuQuote, LuSparkles, LuStar } from 'react-icons/lu';
import { FiCheckSquare, FiCode, FiGlobe } from 'react-icons/fi';
import { FaCode } from 'react-icons/fa';
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
    title: 'Objects',
    items: [
      {
        id: 'widget-sessions',
        title: 'Session',
        type: 'session-item',
        icon: LuLayers,
        sizePreset: 'large',
        layout: createPresetLayout('large'),
        requiresModal: true,
      },
      {
        id: 'widget-todos',
        title: 'Todo List',
        type: 'todo-list',
        icon: FiCheckSquare,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
      {
        id: 'widget-favorites',
        title: 'Favorites',
        type: 'favorites',
        icon: LuStar,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
      },
      {
        id: 'widget-notes-catalog',
        title: 'Quick Notes',
        type: 'note-item',
        icon: LuFileText,
        sizePreset: 'small',
        layout: createPresetLayout('small'),
        requiresModal: true,
      },
      {
        id: 'widget-notes-library',
        title: 'Notes',
        type: 'note-library',
        icon: LuFileText,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
        requiresModal: false,
      },
      {
        id: 'widget-ai-prompts-library',
        title: 'Chat Agents',
        type: 'ai-prompt-library',
        icon: LuSparkles,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
        requiresModal: true,
      },
      {
        id: 'widget-snippet-library',
        title: 'Text Expanders',
        type: 'snippet-library',
        icon: FaCode,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
        requiresModal: true,
      },
      {
        id: 'widget-links-catalog',
        title: 'Links',
        type: 'link-library',
        icon: FiGlobe,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
        requiresModal: true,
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
      {
        id: 'widget-time',
        title: 'Time',
        type: 'time',
        icon: LuClock3,
        sizePreset: 'medium',
        layout: createPresetLayout('medium'),
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

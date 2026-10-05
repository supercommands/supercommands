import type { IconType } from 'react-icons';
import { LuClock3, LuCloudSun, LuFileText, LuQuote, LuStar } from 'react-icons/lu';
import { FiCheckSquare, FiGlobe } from 'react-icons/fi';
import { createPresetLayout } from './engine/widgetDashboardData';
import type { WidgetGridPosition, WidgetSizePreset, WidgetType } from './widgetDashboard.types';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
export interface WidgetCatalogItem {
    id: string;
    title: string;
    type: WidgetType;
    icon: IconType;
    sizePreset: WidgetSizePreset;
    layout: Omit<WidgetGridPosition, 'i' | 'viewId'>;
    renderMode?: 'lazy' | 'inline';
    requiresModal?: boolean;
    isEditorAction?: boolean;
    editorType?: 'note' | 'link' | 'aiPrompt' | 'snippet' | 'todo';
}
export const openEditorByCatalogType = (editorType: 'note' | 'link' | 'aiPrompt' | 'snippet' | 'todo') => {
    const store = useUIStore.getState();
    store.setView({ type: 'home' });
    switch (editorType) {
        case 'note':
            store.openCreateItem('note', { id: 'new', props: { category: 'note' } });
            break;
        case 'link':
            store.openCreateItem('link', { id: 'new', props: { category: 'link' } });
            break;
        case 'aiPrompt':
            store.openCreateItem('aiPrompt', { id: 'new', props: {} });
            break;
        case 'snippet':
            store.openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
            break;
        case 'todo':
            store.setTodoCreatePrefill({ isCreateModalOnly: true } as any);
            store.openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
            break;
    }
};
export interface WidgetCatalogCategory {
    id: string;
    title: string;
    items: WidgetCatalogItem[];
}
export const WIDGET_CATALOG_CATEGORIES: WidgetCatalogCategory[] = [
    {
        id: 'main-widgets',
        title: 'Main Widgets',
        items: [
            {
                id: 'widget-weather',
                title: 'Weather',
                type: 'weather',
                icon: LuCloudSun,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-news',
                title: 'News',
                type: 'news',
                icon: FiGlobe,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-time',
                title: 'Time',
                type: 'time',
                icon: LuClock3,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
            }
        ],
    },
    {
        id: 'motivation-widgets',
        title: 'Motivation',
        items: [
            {
                id: 'widget-quote-of-the-day',
                title: 'Quote of the Day',
                type: 'quote-of-the-day',
                icon: LuQuote,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-year-progress',
                title: 'Year Progress',
                type: 'year-progress',
                icon: LuClock3,
                sizePreset: 'medium',
                layout: createPresetLayout('medium'),
                renderMode: 'lazy',
            }
        ],
    },
    {
        id: 'data-objects',
        title: 'Data Objects',
        items: [
            {
                id: 'widget-todos',
                title: 'Todo',
                type: 'todo-list',
                icon: FiCheckSquare,
                sizePreset: 'medium',
                layout: createPresetLayout('medium'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-favorites',
                title: 'Favorites',
                type: 'favorites',
                icon: LuStar,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-notes-catalog',
                title: 'Quick Notes',
                type: 'note-item',
                icon: LuFileText,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
                requiresModal: true,
            },
            {
                id: 'widget-notes-library',
                title: 'Notes',
                type: 'note-library',
                icon: LuFileText,
                sizePreset: 'medium',
                layout: createPresetLayout('medium'),
                renderMode: 'lazy',
            },
            {
                id: 'widget-links-catalog',
                title: 'Links',
                type: 'link-library',
                icon: FiGlobe,
                sizePreset: 'small',
                layout: createPresetLayout('small'),
                renderMode: 'lazy',
                requiresModal: true,
            }
        ],
    }
];
const normalizeWidgetType = (type: WidgetType | undefined): WidgetType => {
    if (type === 'daily-quote')
        return 'quote-of-the-day';
    return type || 'generic';
};
const widgetCatalogByType = new Map<WidgetType, WidgetCatalogItem>();
WIDGET_CATALOG_CATEGORIES.forEach(category => {
    category.items.forEach(item => {
        widgetCatalogByType.set(normalizeWidgetType(item.type), item);
    });
});
export const getWidgetCatalogItemByType = (type: WidgetType | undefined): WidgetCatalogItem | undefined => {
    return widgetCatalogByType.get(normalizeWidgetType(type));
};
export const isWidgetLazyRendered = (type: WidgetType | undefined): boolean => {
    return getWidgetCatalogItemByType(type)?.renderMode === 'lazy';
};

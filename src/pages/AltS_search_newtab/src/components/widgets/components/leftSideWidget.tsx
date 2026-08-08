import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import {
  addWidgetInstanceAsync,
  LEGACY_WIDGET_DASHBOARD_STORAGE_KEY,
  loadWidgetDashboardStateAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
  WIDGET_DASHBOARD_STORAGE_KEY,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import {
  deleteHtmlWidgetContentAsync,
  saveHtmlWidgetContentAsync,
} from '../../../../../../storage/localStorage/htmlWidgetContentStorage';
import { createPresetLayout } from '../engine/widgetDashboardData';
import { WIDGET_CATALOG_CATEGORIES } from '../widgetCatalog';
import type { WidgetDashboardState } from '../widgetDashboard.types';
import HtmlWidgetSetupModal, { type ParsedHtmlWidgetContent } from '../modals/HtmlWidgetSetupModal';
import NotePickerModal from '../modals/NotePickerModal';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';

type WidgetCatalogItem = (typeof WIDGET_CATALOG_CATEGORIES)[number]['items'][number];

export function LeftSideWidget() {
  const [pendingWidgetIds, setPendingWidgetIds] = useState<Set<string>>(new Set());
  const [dashboardState, setDashboardState] = useState<WidgetDashboardState | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const noteModalViewIdRef = useRef<string | null>(null);
  const htmlModalViewIdRef = useRef<string | null>(null);

  const syncDashboardState = async () => {
    try {
      const state = await loadWidgetDashboardStateAsync();
      setDashboardState(state);
    } catch (error) {
      console.error('Could not load dashboard views:', error);
    }
  };

  useEffect(() => {
    syncDashboardState();

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => {
      if (
        areaName === 'local' &&
        (changes[WIDGET_DASHBOARD_STORAGE_KEY] || changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY])
      ) {
        syncDashboardState();
      }
    };

    const handleWidgetDashboardChange = () => syncDashboardState();
    const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;

    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);

    if (extensionChrome?.storage?.onChanged) {
      extensionChrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        extensionChrome.storage.onChanged.removeListener(handleStorageChange);
        window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
      };
    }

    return () => window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
  }, []);

  const normalizeWidgetType = (type?: string): string => {
    if (type === 'daily-quote') return 'quote-of-the-day';
    return type || 'generic';
  };

  const activeViewWidgets = useMemo(() => {
    if (!dashboardState || !dashboardState.activeViewId) return [];
    return dashboardState.widgets.filter(widget => widget.viewId === dashboardState.activeViewId);
  }, [dashboardState]);

  const widgetCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const widget of activeViewWidgets) {
      const normType = normalizeWidgetType(widget.type);
      counts[normType] = (counts[normType] || 0) + 1;
    }
    return counts;
  }, [activeViewWidgets]);

  const handleAddWidget = async (catalogItem: WidgetCatalogItem) => {
    const isQuoteWidget = catalogItem.type === 'quote-of-the-day' || catalogItem.type === 'daily-quote';
    if (isQuoteWidget) {
      console.info('[DailyQuoteWidget] Add requested:', {
        id: catalogItem.id,
        type: catalogItem.type,
        sizePreset: catalogItem.sizePreset,
      });
    }

    if (catalogItem.type === 'note-item' && catalogItem.requiresModal) {
      noteModalViewIdRef.current = dashboardState?.activeViewId || null;
      setIsNoteModalOpen(true);
      return;
    }

    if (catalogItem.type === 'html' && catalogItem.requiresModal) {
      htmlModalViewIdRef.current = dashboardState?.activeViewId || null;
      setIsHtmlModalOpen(true);
      return;
    }

    setPendingWidgetIds(prev => new Set([...prev, catalogItem.id]));

    try {
      const { state: nextState, widgetId } = await addWidgetInstanceAsync(
        {
          categoryId: WIDGET_CATALOG_CATEGORIES.find(category =>
            category.items.some(item => item.id === catalogItem.id),
          )?.id,
          title: catalogItem.title,
          type: catalogItem.type,
          settings: {},
          sizePreset: catalogItem.sizePreset,
        },
        catalogItem.layout,
      );
      setDashboardState(nextState);
      if (isQuoteWidget) {
        const savedWidget = nextState.widgets.find(widget => widget.id === widgetId);
        console.info('[DailyQuoteWidget] Add persistence result:', {
          persisted: Boolean(savedWidget),
          savedWidget,
          hasLayout: nextState.layout.some(position => position.i === widgetId),
        });
      }
    } finally {
      setPendingWidgetIds(prev => {
        const next = new Set(prev);
        next.delete(catalogItem.id);
        return next;
      });
    }
  };

  const handleSelectNoteForWidget = async (note: NoteRecord) => {
    const requestedViewId = noteModalViewIdRef.current;
    const { state } = await addWidgetInstanceAsync(
      {
        categoryId: 'core-widgets',
        title: note.title || 'Note Widget',
        type: 'note-item',
        noteId: note.id,
        noteTitle: note.title,
        noteBody: note.body,
        settings: {},
        sizePreset: 'small',
      },
      createPresetLayout('small'),
      requestedViewId || undefined,
    );
    setDashboardState(state);
    noteModalViewIdRef.current = null;
    setIsNoteModalOpen(false);
  };

  const handleSaveHtmlWidget = async (content: ParsedHtmlWidgetContent) => {
    const requestedViewId = htmlModalViewIdRef.current;
    const savedContent = await saveHtmlWidgetContentAsync({
      title: content.title,
      html: content.html,
      css: content.css,
      js: content.js,
      originalSource: content.originalSource,
      warnings: content.warnings,
    });
    let state: WidgetDashboardState;
    try {
      const result = await addWidgetInstanceAsync(
        {
          categoryId: 'custom-widgets',
          title: savedContent.title || 'HTML',
          type: 'html',
          settings: {
            contentId: savedContent.contentId,
            sourceType: content.sourceType || 'paste',
            fileName: content.fileName || '',
            allowScripts: true,
            allowVerticalScroll: true,
          },
          sizePreset: 'medium',
        },
        createPresetLayout('medium'),
        requestedViewId || undefined,
      );
      state = result.state;
    } catch (error) {
      await deleteHtmlWidgetContentAsync(savedContent.contentId);
      throw error;
    }
    setDashboardState(state);
    htmlModalViewIdRef.current = null;
    setIsHtmlModalOpen(false);
  };

  return (
    <>
      <div className="flex w-full select-none flex-col gap-4 overflow-y-auto p-3 clean-scrollbar">
        {WIDGET_CATALOG_CATEGORIES.map((category, index) => {
          const categoryTotalCount = category.items.reduce(
            (sum, item) => sum + (widgetCountMap[normalizeWidgetType(item.type)] || 0),
            0,
          );

          return (
            <section key={category.id} className={`flex flex-col gap-2.5 ${index === 0 ? '' : 'pt-1'}`}>
              <div className="px-1 text-[11px] font-bold tracking-wide text-[var(--color-textMuted)]">
                {category.title} - {categoryTotalCount}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {category.items.map(widget => {
                  const IconComponent = widget.icon;
                  const isPending = pendingWidgetIds.has(widget.id);
                  const count = widgetCountMap[normalizeWidgetType(widget.type)] || 0;

                  return (
                    <button
                      key={widget.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddWidget(widget)}
                      aria-label={`Add ${widget.title} widget. Currently ${count} active.`}
                      title={`Add ${widget.title} (${count} active)`}
                      className={`group relative flex flex-col items-center justify-center p-3 rounded-xl min-h-[76px] transition-all duration-150 border select-none border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] hover:bg-[var(--color-bgHover)] hover:border-[var(--color-borderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${
                        isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      }`}>
                      {/* Hover / Keyboard Focus Count Badge */}
                      <span className="absolute top-1.5 right-1.5 pointer-events-none inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderDefault)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 shadow-sm">
                        {count}
                      </span>

                      {/* Widget Icon */}
                      <IconComponent
                        size={20}
                        className="mb-1.5 shrink-0 text-[var(--color-iconDefault)] transition-colors group-hover:text-[var(--color-textPrimary)]"
                      />

                      {/* Widget Title */}
                      <span className="text-center text-[11px] font-medium leading-tight line-clamp-2 w-full px-1 text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]">
                        {widget.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <NotePickerModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          noteModalViewIdRef.current = null;
          setIsNoteModalOpen(false);
        }}
        onSelectNote={handleSelectNoteForWidget}
      />

      <HtmlWidgetSetupModal
        isOpen={isHtmlModalOpen}
        onClose={() => {
          htmlModalViewIdRef.current = null;
          setIsHtmlModalOpen(false);
        }}
        onSave={handleSaveHtmlWidget}
      />
    </>
  );
}

export default LeftSideWidget;

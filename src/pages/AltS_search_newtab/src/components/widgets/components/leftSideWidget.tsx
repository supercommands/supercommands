import { useEffect, useMemo, useRef, useState } from 'react';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import {
  addWidgetInstanceAsync,
  FIXED_SESSION_STRIP_SESSION_SETTING_KEY,
  isSingleInstanceWidgetType,
  LEGACY_WIDGET_DASHBOARD_STORAGE_KEY,
  WIDGET_DASHBOARD_STORAGE_EVENT,
  WIDGET_DASHBOARD_STORAGE_KEY,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import {
  deleteHtmlWidgetContentAsync,
  saveHtmlWidgetContentAsync,
} from '../../../../../../storage/localStorage/htmlWidgetContentStorage';
import { createPresetLayout } from '../engine/widgetDashboardData';
import { WIDGET_CATALOG_CATEGORIES } from '../widgetCatalog';
import HtmlWidgetSetupModal, { type ParsedHtmlWidgetContent } from '../modals/HtmlWidgetSetupModal';
import NotePickerModal from '../modals/NotePickerModal';
import SessionPickerModal from '../modals/SessionPickerModal';
import LinkLibraryPicker from '../modals/LinkLibraryPicker';
import AiPromptLibraryPicker from '../modals/AiPromptLibraryPicker';
import SnippetLibraryPicker from '../modals/SnippetLibraryPicker';
import type { WidgetDashboardState } from '../widgetDashboard.types';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../../../../allObjectFolder/src/createObject/session/sessionTypes';
import WidgetCatalogGrid from './WidgetCatalogGrid';

type WidgetCatalogItem = (typeof WIDGET_CATALOG_CATEGORIES)[number]['items'][number];

export function LeftSideWidget() {
  const [pendingWidgetIds, setPendingWidgetIds] = useState<Set<string>>(new Set());
  const dashboardState = useWidgetDashboardStore(state => state.state);
  const loadDashboard = useWidgetDashboardStore(state => state.load);
  const refreshDashboard = useWidgetDashboardStore(state => state.refresh);
  const setDashboardState = useWidgetDashboardStore(state => state.setDashboardState);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const noteModalViewIdRef = useRef<string | null>(null);
  const sessionModalViewIdRef = useRef<string | null>(null);
  const [isLinkLibraryModalOpen, setIsLinkLibraryModalOpen] = useState(false);
  const linkLibraryModalViewIdRef = useRef<string | null>(null);
  const [isAiPromptModalOpen, setIsAiPromptModalOpen] = useState(false);
  const aiPromptModalViewIdRef = useRef<string | null>(null);
  const [isSnippetLibraryModalOpen, setIsSnippetLibraryModalOpen] = useState(false);
  const snippetLibraryModalViewIdRef = useRef<string | null>(null);
  const htmlModalViewIdRef = useRef<string | null>(null);

  const workspaces = useDbStore(state => state.workspaces);
  const isStoreInitialized = useDbStore(state => state.isInitialized);
  const sessions = useDbStore(state => state.sessions);
  const activeWorkspaceId = workspaces[0]?.id || 'default';

  const syncDashboardState = async () => {
    try {
      await loadDashboard(activeWorkspaceId, { activeViewOnly: true });
    } catch (error) {
      console.error('Could not load dashboard views:', error);
    }
  };

  useEffect(() => {
    if (!isStoreInitialized) return undefined;
    if (workspaces.length === 0) return undefined;

    syncDashboardState();

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => {
      if (
        areaName === 'local' &&
        (
          changes[WIDGET_DASHBOARD_STORAGE_KEY] ||
          changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY]
        )
      ) {
        void refreshDashboard(activeWorkspaceId, { activeViewOnly: true });
      }
    };

    const handleWidgetDashboardChange = () => {
      void refreshDashboard(activeWorkspaceId, { activeViewOnly: true });
    };
    const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;

    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);

    if (extensionChrome?.storage?.onChanged) {
      extensionChrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        extensionChrome.storage.onChanged.removeListener(handleStorageChange);
        window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
      };
    }

    return () => {
      window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
    };
  }, [activeWorkspaceId, isStoreInitialized, loadDashboard, refreshDashboard, workspaces.length]);

  const normalizeWidgetType = (type?: string): string => {
    if (type === 'daily-quote') return 'quote-of-the-day';
    return type || 'generic';
  };

  const activeViewWidgets = useMemo(() => {
    if (!dashboardState || !dashboardState.activeViewId) return [];
    return (Array.isArray(dashboardState.widgets) ? dashboardState.widgets : []).filter(
      widget => widget.viewId === dashboardState.activeViewId,
    );
  }, [dashboardState]);

  const widgetCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const widget of activeViewWidgets) {
      const normType = normalizeWidgetType(widget.type);
      counts[normType] = (counts[normType] || 0) + 1;
    }
    return counts;
  }, [activeViewWidgets]);

  const linkedSessionIds = useMemo(() => {
    if (!dashboardState) return new Set<string>();
    const ids = new Set<string>();
    (Array.isArray(dashboardState.views) ? dashboardState.views : []).forEach(view => {
      const settingsSessionId = view.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
      if (typeof settingsSessionId === 'string' && settingsSessionId.trim()) {
        ids.add(settingsSessionId);
      }
    });
    (Array.isArray(dashboardState.widgets) ? dashboardState.widgets : []).forEach(w => {
      if (normalizeWidgetType(w.type) === 'session-item') {
        if (w.sessionId) ids.add(w.sessionId);
        if (w.referenceId && w.referenceType === 'session') ids.add(w.referenceId);
      }
    });
    return ids;
  }, [dashboardState]);

  const activeViewFixedSessionId = useMemo(() => {
    if (!dashboardState?.activeViewId) return null;
    const activeView = dashboardState.views.find(view => view.id === dashboardState.activeViewId);
    const settingsSessionId = activeView?.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
    return typeof settingsSessionId === 'string' && settingsSessionId.trim() ? settingsSessionId : null;
  }, [dashboardState]);

  const handleAddWidget = async (catalogItem: WidgetCatalogItem) => {
    const isQuoteWidget = catalogItem.type === 'quote-of-the-day' || catalogItem.type === 'daily-quote';
    if (isQuoteWidget) {
      console.info('[DailyQuoteWidget] Add requested:', {
        id: catalogItem.id,
        type: catalogItem.type,
        sizePreset: catalogItem.sizePreset,
      });
    }

    if (catalogItem.type === 'session-item') {
      const existingWidget = activeViewWidgets.find(w => normalizeWidgetType(w.type) === 'session-item');
      if (existingWidget) {
        const widgetEl = document.querySelector(`[data-widget-id="${existingWidget.id}"]`);
        if (widgetEl) {
          widgetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (activeViewFixedSessionId) {
        const linkedSession = sessions.find(session => session.id === activeViewFixedSessionId);
        const { state } = await addWidgetInstanceAsync(
          {
            categoryId: 'core-widgets',
            title: linkedSession?.title || 'Session Widget',
            type: 'session-item',
            sessionId: activeViewFixedSessionId,
            sessionTitle: linkedSession?.title,
            settings: {},
            sizePreset: 'large',
          },
          catalogItem.layout || createPresetLayout('large'),
          dashboardState?.activeViewId || undefined,
          activeWorkspaceId,
        );
        setDashboardState(state);
        return;
      }

      if (catalogItem.requiresModal) {
        const unlinkedSessions = sessions.filter(s => !linkedSessionIds.has(s.id));
        if (unlinkedSessions.length === 1) {
          sessionModalViewIdRef.current = dashboardState?.activeViewId || null;
          await handleSelectSessionForWidget(unlinkedSessions[0]);
          return;
        }
        if (unlinkedSessions.length > 1) {
          sessionModalViewIdRef.current = dashboardState?.activeViewId || null;
          setIsSessionModalOpen(true);
          return;
        }
      }
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
      const defaultSettings =
        catalogItem.type === 'link-library' ||
        catalogItem.type === 'ai-prompt-library' ||
        catalogItem.type === 'snippet-library' ||
        catalogItem.type === 'note-library'
          ? {
              sourceMode: 'all' as const,
              selectedCollectionIds: [],
              selectedPromptIds: [],
              selectedSnippetIds: [],
              selectedNoteIds: [],
              selectedTagIds: [],
              tagMatchMode: 'any' as const,
              sortBy: 'saved-order' as const,
              enableSearch: false,
            }
          : {};

      const { state: nextState, widgetId } = await addWidgetInstanceAsync(
        {
          categoryId: WIDGET_CATALOG_CATEGORIES.find(category =>
            category.items.some(item => item.id === catalogItem.id),
          )?.id,
          title: catalogItem.title,
          type: catalogItem.type,
          settings: defaultSettings,
          sizePreset: catalogItem.sizePreset,
        },
        catalogItem.layout,
        undefined,
        activeWorkspaceId,
      );
      setDashboardState(nextState, activeWorkspaceId);
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
      activeWorkspaceId,
    );
    setDashboardState(state);
    noteModalViewIdRef.current = null;
    setIsNoteModalOpen(false);
  };

  const handleSelectSessionForWidget = async (session: SessionRecord) => {
    const requestedViewId = sessionModalViewIdRef.current;
    const { state } = await addWidgetInstanceAsync(
      {
        categoryId: 'core-widgets',
        title: session.title || 'Session Widget',
        type: 'session-item',
        sessionId: session.id,
        sessionTitle: session.title,
        settings: {},
        sizePreset: 'large',
      },
      createPresetLayout('large'),
      requestedViewId || undefined,
      activeWorkspaceId,
    );
    setDashboardState(state);
    sessionModalViewIdRef.current = null;
    setIsSessionModalOpen(false);
  };

  const handleConfirmLinkLibrary = async (selectedIds: string[]) => {
    const requestedViewId = linkLibraryModalViewIdRef.current;
    try {
      const { state } = await addWidgetInstanceAsync(
        {
          categoryId: 'core-widgets',
          title: 'Links',
          type: 'link-library',
          settings: {
            sourceMode: 'manual',
            selectedCollectionIds: selectedIds,
            selectedTagIds: [],
            tagMatchMode: 'any',
            sortBy: 'saved-order',
          },
          sizePreset: 'medium',
        },
        createPresetLayout('medium'),
        requestedViewId || undefined,
        activeWorkspaceId,
      );
      setDashboardState(state);
    } finally {
      linkLibraryModalViewIdRef.current = null;
      setIsLinkLibraryModalOpen(false);
    }
  };

  const handleConfirmAiPromptLibrary = async (selectedIds: string[]) => {
    const requestedViewId = aiPromptModalViewIdRef.current;
    try {
      const { state } = await addWidgetInstanceAsync(
        {
          categoryId: 'core-widgets',
          title: 'Chat Agents',
          type: 'ai-prompt-library',
          settings: {
            sourceMode: 'manual',
            selectedPromptIds: selectedIds,
            selectedTagIds: [],
            tagMatchMode: 'any',
            sortBy: 'saved-order',
          },
          sizePreset: 'medium',
        },
        createPresetLayout('medium'),
        requestedViewId || undefined,
        activeWorkspaceId,
      );
      setDashboardState(state);
    } finally {
      aiPromptModalViewIdRef.current = null;
      setIsAiPromptModalOpen(false);
    }
  };

  const handleConfirmSnippetLibrary = async (selectedIds: string[]) => {
    const requestedViewId = snippetLibraryModalViewIdRef.current;
    try {
      const { state } = await addWidgetInstanceAsync(
        {
          categoryId: 'core-widgets',
          title: 'Text Expanders',
          type: 'snippet-library',
          settings: {
            sourceMode: 'manual',
            selectedSnippetIds: selectedIds,
            selectedTagIds: [],
            tagMatchMode: 'any',
            sortBy: 'saved-order',
          },
          sizePreset: 'medium',
        },
        createPresetLayout('medium'),
        requestedViewId || undefined,
        activeWorkspaceId,
      );
      setDashboardState(state);
    } finally {
      snippetLibraryModalViewIdRef.current = null;
      setIsSnippetLibraryModalOpen(false);
    }
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
        activeWorkspaceId,
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
        <WidgetCatalogGrid
          pendingWidgetIds={pendingWidgetIds}
          getWidgetCount={widget => widgetCountMap[normalizeWidgetType(widget.type)] || 0}
          isWidgetDisabled={(widget, count) => isSingleInstanceWidgetType(normalizeWidgetType(widget.type)) && count >= 1}
          onSelectWidget={handleAddWidget}
        />
      </div>

      <NotePickerModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          noteModalViewIdRef.current = null;
          setIsNoteModalOpen(false);
        }}
        onSelectNote={handleSelectNoteForWidget}
      />

      <SessionPickerModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          sessionModalViewIdRef.current = null;
          setIsSessionModalOpen(false);
        }}
        onSelectSession={handleSelectSessionForWidget}
        linkedSessionIds={linkedSessionIds}
      />
    
      <LinkLibraryPicker
        isOpen={isLinkLibraryModalOpen}
        onClose={() => {
          linkLibraryModalViewIdRef.current = null;
          setIsLinkLibraryModalOpen(false);
        }}
        onConfirm={handleConfirmLinkLibrary}
      />

      <AiPromptLibraryPicker
        isOpen={isAiPromptModalOpen}
        onClose={() => {
          aiPromptModalViewIdRef.current = null;
          setIsAiPromptModalOpen(false);
        }}
        onConfirm={handleConfirmAiPromptLibrary}
        isCreationMode={true}
      />

      <SnippetLibraryPicker
        isOpen={isSnippetLibraryModalOpen}
        onClose={() => {
          snippetLibraryModalViewIdRef.current = null;
          setIsSnippetLibraryModalOpen(false);
        }}
        onConfirm={handleConfirmSnippetLibrary}
        isCreationMode={true}
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

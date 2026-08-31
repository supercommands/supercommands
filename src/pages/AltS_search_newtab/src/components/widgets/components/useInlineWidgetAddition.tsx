import { useMemo, useRef, useState } from 'react';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import {
  addWidgetInstanceAsync,
  FIXED_SESSION_STRIP_SESSION_SETTING_KEY,
  isSingleInstanceWidgetType,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import {
  deleteHtmlWidgetContentAsync,
  saveHtmlWidgetContentAsync,
} from '../../../../../../storage/localStorage/htmlWidgetContentStorage';
import {
  createPresetLayout,
  isWidgetSizePresetAllowed,
  WIDGET_MACRO_ROW_HEIGHT,
} from '../engine/widgetDashboardData';
import type { EmptyWidgetSlot } from '../engine/widgetLayoutEngine';
import { WIDGET_CATALOG_CATEGORIES, type WidgetCatalogItem } from '../widgetCatalog';
import type { WidgetDashboardState, WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import HtmlWidgetSetupModal, { type ParsedHtmlWidgetContent } from '../modals/HtmlWidgetSetupModal';
import NotePickerModal from '../modals/NotePickerModal';
import SessionPickerModal from '../modals/SessionPickerModal';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../../../../allObjectFolder/src/createObject/session/sessionTypes';

interface PendingInlineWidgetRequest {
  item: WidgetCatalogItem;
  slot: EmptyWidgetSlot;
  viewId: string;
  nextRowY: number;
}

interface UseInlineWidgetAdditionOptions {
  dashboardState: WidgetDashboardState | null;
  activeWorkspaceId: string;
  onDashboardStateChange: (state: WidgetDashboardState) => void;
}

const normalizeWidgetType = (type?: string): string =>
  type === 'daily-quote' ? 'quote-of-the-day' : type || 'generic';

const getDefaultSettings = (type: string | undefined) =>
  type === 'link-library' ||
  type === 'ai-prompt-library' ||
  type === 'snippet-library' ||
  type === 'note-library'
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

export const useInlineWidgetAddition = ({
  dashboardState,
  activeWorkspaceId,
  onDashboardStateChange,
}: UseInlineWidgetAdditionOptions) => {
  const sessions = useDbStore(state => state.sessions);
  const [pendingWidgetIds, setPendingWidgetIds] = useState<Set<string>>(new Set());
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const pendingRequestRef = useRef<PendingInlineWidgetRequest | null>(null);

  const activeViewWidgets = useMemo(
    () => dashboardState?.widgets.filter(widget => widget.viewId === dashboardState.activeViewId) || [],
    [dashboardState],
  );

  const widgetCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    activeViewWidgets.forEach(widget => {
      const type = normalizeWidgetType(widget.type);
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [activeViewWidgets]);

  const linkedSessionIds = useMemo(() => {
    const ids = new Set<string>();
    dashboardState?.views.forEach(view => {
      const settingsSessionId = view.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
      if (typeof settingsSessionId === 'string' && settingsSessionId.trim()) {
        ids.add(settingsSessionId);
      }
    });
    dashboardState?.widgets.forEach(widget => {
      if (normalizeWidgetType(widget.type) !== 'session-item') return;
      if (widget.sessionId) ids.add(widget.sessionId);
      if (widget.referenceType === 'session' && widget.referenceId) ids.add(widget.referenceId);
    });
    return ids;
  }, [dashboardState]);

  const activeViewFixedSessionId = useMemo(() => {
    if (!dashboardState?.activeViewId) return null;
    const activeView = dashboardState.views.find(view => view.id === dashboardState.activeViewId);
    const settingsSessionId = activeView?.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
    return typeof settingsSessionId === 'string' && settingsSessionId.trim() ? settingsSessionId : null;
  }, [dashboardState]);

  const getPlacement = (request: PendingInlineWidgetRequest) => {
    const { item, slot } = request;
    if (isWidgetSizePresetAllowed(item.type, 'small')) {
      return {
        sizePreset: 'small' as WidgetSizePreset,
        layout: createPresetLayout('small', slot.x, slot.y),
      };
    }

    return {
      sizePreset: item.sizePreset,
      layout: createPresetLayout(item.sizePreset, 0, request.nextRowY),
    };
  };

  const addPreparedWidget = async (
    request: PendingInlineWidgetRequest,
    input: Pick<WidgetInstance, 'title' | 'type'> &
      Partial<Pick<WidgetInstance, 'noteId' | 'noteTitle' | 'noteBody' | 'sessionId' | 'sessionTitle' | 'settings'>>,
  ) => {
    if (!dashboardState) return;
    const { item, viewId } = request;
    const placement = getPlacement(request);
    setPendingWidgetIds(current => new Set(current).add(item.id));
    try {
      const categoryId = WIDGET_CATALOG_CATEGORIES.find(category =>
        category.items.some(categoryItem => categoryItem.id === item.id),
      )?.id;
      const { state } = await addWidgetInstanceAsync(
        {
          categoryId,
          title: input.title,
          type: input.type,
          noteId: input.noteId,
          noteTitle: input.noteTitle,
          noteBody: input.noteBody,
          sessionId: input.sessionId,
          sessionTitle: input.sessionTitle,
          settings: input.settings || {},
          sizePreset: placement.sizePreset,
        },
        placement.layout,
        viewId,
        activeWorkspaceId,
      );
      onDashboardStateChange(state);
    } finally {
      setPendingWidgetIds(current => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleAddWidgetFromSlot = async (item: WidgetCatalogItem, slot: EmptyWidgetSlot) => {
    if (!dashboardState || pendingWidgetIds.has(item.id)) return;
    const request: PendingInlineWidgetRequest = {
      item,
      slot,
      viewId: dashboardState.activeViewId,
      nextRowY:
        Math.ceil(
          Math.max(
            0,
            ...dashboardState.layout
              .filter(position => position.viewId === dashboardState.activeViewId)
              .map(position => position.y + position.h),
          ) / WIDGET_MACRO_ROW_HEIGHT,
        ) * WIDGET_MACRO_ROW_HEIGHT,
    };

    if (item.type === 'session-item') {
      const existingWidget = activeViewWidgets.find(widget => normalizeWidgetType(widget.type) === 'session-item');
      if (existingWidget) {
        document.querySelector(`[data-widget-id="${existingWidget.id}"]`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        return;
      }
      if (activeViewFixedSessionId) {
        const linkedSession = sessions.find(session => session.id === activeViewFixedSessionId);
        await addPreparedWidget(request, {
          title: linkedSession?.title || 'Session Widget',
          type: 'session-item',
          sessionId: activeViewFixedSessionId,
          sessionTitle: linkedSession?.title,
          settings: {},
        });
        return;
      }
      if (item.requiresModal) {
        const unlinkedSessions = sessions.filter(session => !linkedSessionIds.has(session.id));
        if (unlinkedSessions.length === 1) {
          await addPreparedWidget(request, {
            title: unlinkedSessions[0].title || 'Session Widget',
            type: 'session-item',
            sessionId: unlinkedSessions[0].id,
            sessionTitle: unlinkedSessions[0].title,
            settings: {},
          });
          return;
        }
        if (unlinkedSessions.length > 1) {
          pendingRequestRef.current = request;
          setIsSessionModalOpen(true);
          return;
        }
      }
    }

    if (item.type === 'note-item' && item.requiresModal) {
      pendingRequestRef.current = request;
      setIsNoteModalOpen(true);
      return;
    }

    if (item.type === 'html' && item.requiresModal) {
      pendingRequestRef.current = request;
      setIsHtmlModalOpen(true);
      return;
    }

    await addPreparedWidget(
      request,
      {
        title: item.title,
        type: item.type,
        settings: getDefaultSettings(item.type),
      },
    );
  };

  const closePendingModal = () => {
    pendingRequestRef.current = null;
    setIsNoteModalOpen(false);
    setIsSessionModalOpen(false);
    setIsHtmlModalOpen(false);
  };

  const handleSelectNote = async (note: NoteRecord) => {
    const request = pendingRequestRef.current;
    if (!request) return;
    await addPreparedWidget(request, {
      title: note.title || 'Note Widget',
      type: 'note-item',
      noteId: note.id,
      noteTitle: note.title,
      noteBody: note.body,
      settings: {},
    });
    closePendingModal();
  };

  const handleSelectSession = async (session: SessionRecord) => {
    const request = pendingRequestRef.current;
    if (!request) return;
    await addPreparedWidget(request, {
      title: session.title || 'Session Widget',
      type: 'session-item',
      sessionId: session.id,
      sessionTitle: session.title,
      settings: {},
    });
    closePendingModal();
  };

  const handleSaveHtml = async (content: ParsedHtmlWidgetContent) => {
    const request = pendingRequestRef.current;
    if (!request) return;
    const savedContent = await saveHtmlWidgetContentAsync({
      title: content.title,
      html: content.html,
      css: content.css,
      js: content.js,
      originalSource: content.originalSource,
      warnings: content.warnings,
    });
    try {
      await addPreparedWidget(request, {
        title: savedContent.title || 'HTML',
        type: 'html',
        settings: {
          contentId: savedContent.contentId,
          sourceType: content.sourceType || 'paste',
          fileName: content.fileName || '',
          allowScripts: true,
          allowVerticalScroll: true,
        },
      });
    } catch (error) {
      await deleteHtmlWidgetContentAsync(savedContent.contentId);
      throw error;
    }
    closePendingModal();
  };

  return {
    pendingWidgetIds,
    getWidgetCount: (item: WidgetCatalogItem) => widgetCountMap[normalizeWidgetType(item.type)] || 0,
    isWidgetDisabled: (item: WidgetCatalogItem, count: number) =>
      isSingleInstanceWidgetType(normalizeWidgetType(item.type)) && count >= 1,
    handleAddWidgetFromSlot,
    modals: (
      <>
        <NotePickerModal isOpen={isNoteModalOpen} onClose={closePendingModal} onSelectNote={handleSelectNote} />
        <SessionPickerModal
          isOpen={isSessionModalOpen}
          onClose={closePendingModal}
          onSelectSession={handleSelectSession}
          linkedSessionIds={linkedSessionIds}
        />
        <HtmlWidgetSetupModal isOpen={isHtmlModalOpen} onClose={closePendingModal} onSave={handleSaveHtml} />
      </>
    ),
  };
};

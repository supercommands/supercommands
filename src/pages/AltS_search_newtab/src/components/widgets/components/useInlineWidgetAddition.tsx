import { useMemo, useRef, useState } from 'react';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { addWidgetInstanceAsync, isSingleInstanceWidgetType, } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import { deleteHtmlWidgetContentAsync, saveHtmlWidgetContentAsync, } from '../../../../../../storage/localStorage/htmlWidgetContentStorage';
import { createPresetLayout, } from '../engine/widgetDashboardData';
import type { EmptyWidgetSlot } from '../engine/widgetLayoutEngine';
import { WIDGET_CATALOG_CATEGORIES, openEditorByCatalogType, type WidgetCatalogItem } from '../widgetCatalog';
import type { WidgetDashboardState, WidgetInstance } from '../widgetDashboard.types';
import HtmlWidgetSetupModal, { type ParsedHtmlWidgetContent } from '../modals/HtmlWidgetSetupModal';
import NotePickerModal from '../modals/NotePickerModal';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';
interface PendingInlineWidgetRequest {
    item: WidgetCatalogItem;
    slot: EmptyWidgetSlot;
    viewId: string;
}
interface UseInlineWidgetAdditionOptions {
    dashboardState: WidgetDashboardState | null;
    activeOrganisationId: string;
    onDashboardStateChange: (state: WidgetDashboardState) => void;
}
const normalizeWidgetType = (type?: string): string => type === 'daily-quote' ? 'quote-of-the-day' : type || 'generic';
const getDefaultSettings = (type: string | undefined) => type === 'link-library' ||
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
export const useInlineWidgetAddition = ({ dashboardState, activeOrganisationId, onDashboardStateChange, }: UseInlineWidgetAdditionOptions) => {
    const [pendingWidgetIds, setPendingWidgetIds] = useState<Set<string>>(new Set());
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
    const pendingRequestRef = useRef<PendingInlineWidgetRequest | null>(null);
    const activeViewWidgets = useMemo(() => dashboardState?.widgets.filter(widget => widget.viewId === dashboardState.activeViewId) || [], [dashboardState]);
    const widgetCountMap = useMemo(() => {
        const counts: Record<string, number> = {};
        activeViewWidgets.forEach(widget => {
            const type = normalizeWidgetType(widget.type);
            counts[type] = (counts[type] || 0) + 1;
        });
        return counts;
    }, [activeViewWidgets]);
    const getPlacement = (request: PendingInlineWidgetRequest) => {
        const { item, slot } = request;
        return {
            sizePreset: item.sizePreset,
            layout: createPresetLayout(item.sizePreset, slot.x, slot.y),
        };
    };
    const addPreparedWidget = async (request: PendingInlineWidgetRequest, input: Pick<WidgetInstance, 'title' | 'type'> & Partial<Pick<WidgetInstance, 'noteId' | 'noteTitle' | 'noteBody' | 'sessionId' | 'sessionTitle' | 'settings'>>) => {
        if (!dashboardState)
            return;
        const { item, viewId } = request;
        const placement = getPlacement(request);
        setPendingWidgetIds(current => new Set(current).add(item.id));
        try {
            const categoryId = WIDGET_CATALOG_CATEGORIES.find(category => category.items.some(categoryItem => categoryItem.id === item.id))?.id;
            const { state } = await addWidgetInstanceAsync({
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
            }, placement.layout, viewId, activeOrganisationId);
            onDashboardStateChange(state);
        }
        finally {
            setPendingWidgetIds(current => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
        }
    };
    const handleAddWidgetFromSlot = async (item: WidgetCatalogItem, slot: EmptyWidgetSlot) => {
        if (item.isEditorAction && item.editorType) {
            openEditorByCatalogType(item.editorType);
            return;
        }
        if (!dashboardState || pendingWidgetIds.has(item.id))
            return;
        const request: PendingInlineWidgetRequest = {
            item,
            slot,
            viewId: dashboardState.activeViewId,
        };
        if (item.type === 'session-item') throw new Error('Home has no saved-session widgets.');
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
        await addPreparedWidget(request, {
            title: item.title,
            type: item.type,
            settings: getDefaultSettings(item.type),
        });
    };
    const closePendingModal = () => {
        pendingRequestRef.current = null;
        setIsNoteModalOpen(false);
        setIsHtmlModalOpen(false);
    };
    const handleSelectNote = async (note: NoteRecord) => {
        const request = pendingRequestRef.current;
        if (!request)
            return;
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
    const handleSaveHtml = async (content: ParsedHtmlWidgetContent) => {
        const request = pendingRequestRef.current;
        if (!request)
            return;
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
        }
        catch (error) {
            await deleteHtmlWidgetContentAsync(savedContent.contentId);
            throw error;
        }
        closePendingModal();
    };
    return {
        pendingWidgetIds,
        getWidgetCount: (item: WidgetCatalogItem) => widgetCountMap[normalizeWidgetType(item.type)] || 0,
        isWidgetDisabled: (item: WidgetCatalogItem, count: number) => isSingleInstanceWidgetType(normalizeWidgetType(item.type)) && count >= 1,
        handleAddWidgetFromSlot,
        modals: (<>
        <NotePickerModal isOpen={isNoteModalOpen} onClose={closePendingModal} onSelectNote={handleSelectNote}/>
        <></>
        <HtmlWidgetSetupModal isOpen={isHtmlModalOpen} onClose={closePendingModal} onSave={handleSaveHtml}/>
      </>),
    };
};

import { getWebsitePopupClipLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
/** One Collection details owner: capture/autosave, metadata refs, keyboard actions and projections. */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { ExtractedWebScraping } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import type { WebsitePopupCollectionPreviewState } from './WebsitePopupCollectionContentPreview';
import type { WebsitePopupCollectionItemFooterState } from './WebsitePopupCollectionItemStatusFooter';
import { useWebsitePopupCollectionItemAutosave } from './useWebsitePopupCollectionItemAutosave';
import type { CollectionPanelDraft } from './useWebsitePopupCollectionItemAutosave';
import { resolveWebsitePopupCreateKeyboardIntent } from '../interaction/websitePopupKeyboardIntentResolver';
import type { WebsitePopupPresentation } from '../interaction/websitePopupPresentation';
import { useWebsitePopupCollectionItemTags } from './useWebsitePopupCollectionItemTags';
import { findNextSelectableWebsitePopupRowIndex } from '../results/websitePopupResultsNavigation';
import { collectionSourceLabel } from '../../../../shared-components/collections/collectionCaptureSource';
import { useWebsitePopupCollectionProperties } from './useWebsitePopupCollectionProperties';

export type WebsitePopupCollectionItemFormOptions = {
    store: WebsitePopupInteractionStoreApi;
    snapshot: WebsitePopupSearchSnapshot;
    open: boolean;
    initialRecord?: CollectionItemRecord | null;
    webDraft?: ExtractedWebScraping | null;
    onTitleInputRef: (element: HTMLInputElement | null) => void;
    onPreviewChange: (state: WebsitePopupCollectionPreviewState) => void;
    onStatusChange: (state: WebsitePopupCollectionItemFooterState) => void;
    presentation?: WebsitePopupPresentation;
    onEscape?: () => void;
    panelDraft?: CollectionPanelDraft;
};
export type WebsitePopupCollectionEditableField = 'title' | 'author' | 'note';

export function useWebsitePopupCollectionItemForm({ store, snapshot, open, initialRecord = null, webDraft = null,
    onTitleInputRef, onStatusChange, onPreviewChange, presentation = 'inline', onEscape, panelDraft }: WebsitePopupCollectionItemFormOptions) {
    const state = useStore(store, current => current.state);
    const dispatch = useStore(store, current => current.dispatch);
    const session = state.collectionSession;
    const isArticle = session?.captureType === 'article';
    const isScreenshot = session?.captureType === 'screenshot';
    const isWebScraping = session?.captureType === 'web-scraping';
    const itemLabel = getWebsitePopupClipLabel(session?.captureType || 'link');
    const active = open && state.route.kind === 'submode' && state.route.submode.id === 'collection-item-details'
        && (session?.captureType === 'link' || isArticle || isScreenshot || isWebScraping) && Boolean(session?.selectedCollectionId);
    const capture = useWebsitePopupCollectionItemAutosave(snapshot.defaultOrganisationId, session?.selectedCollectionId || null,
        isWebScraping ? 'web-scraping' : isArticle ? 'article' : isScreenshot ? 'screenshot' : 'link', session?.sourceUrl || null, active, initialRecord, webDraft, session?.sourceContext || null, panelDraft);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
    const authorInputRef = useRef<HTMLInputElement | null>(null);
    const tagInputRef = useRef<HTMLInputElement | null>(null);
    const restoringTagFocusRef = useRef(false);
    const revision = session?.captureRevision || 0;
    const tags = useWebsitePopupCollectionItemTags({ snapshot, organisationId: snapshot.defaultOrganisationId || null,
        scopeKey: `${snapshot.defaultOrganisationId}:${session?.selectedCollectionId}:${revision}`, active: active || Boolean(panelDraft && open),
        tagIds: capture.tagIds, onChange: capture.changeTagIds });
    const properties = useWebsitePopupCollectionProperties({ organisationId: snapshot.defaultOrganisationId || null,
        collectionId: session?.selectedCollectionId || null,
        scopeKey: `${snapshot.defaultOrganisationId}:${session?.selectedCollectionId}:${revision}`,
        active: (active || Boolean(panelDraft && open)) && presentation === 'standalone', values: capture.propertyValues,
        onClear: capture.changePropertyValue, flush: capture.flushDetails,
        onNavigateBack: () => tagInputRef.current?.focus({ preventScroll: true }) });
    const fieldOrder = panelDraft ? ['title', ...(isArticle ? ['author'] : []), 'tags', 'note']
        : isArticle ? ['title', 'author', 'note', 'tags'] : ['title', 'note', 'tags'];
    const focusField = (field: string) => {
        const target = field === 'title' ? titleInputRef.current : field === 'author' ? authorInputRef.current
            : field === 'tags' ? tagInputRef.current : noteInputRef.current;
        target?.focus({ preventScroll: true });
    };
    const escape = () => {
        capture.flushDetails();
        if (properties.pickerOpen) { properties.closePicker(); properties.focusPicker(); return; }
        if (tags.pickerOpen) {
            tags.closePicker();
            restoringTagFocusRef.current = true;
            focusField('tags');
            restoringTagFocusRef.current = false;
            return;
        }
        if (presentation === 'standalone' && onEscape) onEscape();
        else dispatch({ type: 'BACK_REQUESTED' });
    };
    const handleEmptyBackspace = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: string, value: string) => {
        if (event.key !== 'Backspace' || value) return;
        const intent = resolveWebsitePopupCreateKeyboardIntent({
            key: event.key, shiftKey: event.shiftKey, field,
            fieldOrder,
            isEmpty: true, hasPropertyFields: false, traverseVisibleFields: true,
            propertyEntryOpen: false, childMode: null,
        });
        if (intent.kind === 'pass-through') return;
        event.preventDefault(); event.stopPropagation(); capture.flushDetails();
        if (intent.kind === 'back-requested') {
            if (presentation !== 'standalone') dispatch({ type: 'BACK_REQUESTED' });
        }
        else if (intent.kind === 'focus-field') {
            focusField(intent.field);
        }
    };
    useEffect(() => {
        if (active) onStatusChange({ revision, status: capture.status, error: capture.error, retry: capture.retry, canRetry: capture.canRetry,
            itemId: capture.record?.id, lastSavedAt: capture.record?.updatedAt,
            ...(isWebScraping && !capture.record && !webDraft ? { message: 'Capture content again to continue.' } : {}) });
    }, [active, capture.canRetry, capture.error, capture.retry, capture.status, capture.record, isWebScraping, onStatusChange, revision, webDraft]);
    useEffect(() => {
        if (active) onPreviewChange({ revision, type: isWebScraping ? 'web-scraping' : isArticle ? 'article' : isScreenshot ? 'screenshot' : 'link',
            title: capture.title, url: capture.record?.url || session?.sourceUrl || null, record: capture.record,
            articleText: capture.articleText, webDraft, status: capture.status });
    }, [active, revision, isWebScraping, isArticle, isScreenshot, capture.title, capture.record, capture.articleText, capture.status, session?.sourceUrl, webDraft, onPreviewChange]);
    const supported = session?.captureType === 'link' || isArticle || isScreenshot || isWebScraping;
    const collectionName = snapshot.newCollections.find(collection => collection.id === session?.selectedCollectionId)?.name
        || session?.selectedCollectionName || 'Web Clip';
    const capturedUrl = capture.record?.url || session?.sourceUrl || (isScreenshot ? null : window.location.href);
    const capturedSite = collectionSourceLabel(capturedUrl || '');
    const handleFieldKeyDown = (field: WebsitePopupCollectionEditableField, event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = capture[field];
        handleEmptyBackspace(event, field, value);
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            escape();
        } else if (event.key === 'Tab' && !panelDraft) {
            capture.flushDetails();
            const next = fieldOrder[fieldOrder.indexOf(field) + (event.shiftKey ? -1 : 1)];
            if (next) {
                event.preventDefault();
                focusField(next);
            }
        }
    };
    const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); escape(); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); event.stopPropagation();
            tags.openPicker();
            const rows = tags.sections.flatMap(section => section.rows);
            if (rows.length) tags.selectIndex(findNextSelectableWebsitePopupRowIndex(rows,
                tags.pickerOpen ? tags.selectedIndex : event.key === 'ArrowDown' ? -1 : 0,
                event.key === 'ArrowDown' ? 'next' : 'previous'));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault(); event.stopPropagation();
            if (!tags.pickerOpen) tags.openPicker();
            else {
                const row = tags.sections.flatMap(section => section.rows)[tags.selectedIndex];
                if (row && !row.disabled) void tags.activate(row.intent);
            }
            return;
        }
        if (event.key === 'Backspace' && !tags.query) {
            event.preventDefault(); event.stopPropagation();
            if (tags.selected.length) tags.removeLast();
            else { tags.closePicker(); capture.flushDetails(); focusField(panelDraft ? isArticle ? 'author' : 'title' : 'note'); }
            return;
        }
        if (event.key === 'Tab') {
            tags.closePicker(); capture.flushDetails();
            if (event.shiftKey && !panelDraft) { event.preventDefault(); event.stopPropagation(); focusField('note'); }
        }
    };
    return {
        supported, capture, tags, properties, itemLabel, isArticle, isScreenshot, collectionName, capturedUrl, capturedSite, panelDraft,
        handleFieldKeyDown, handleTagKeyDown, escape,
        focusMetadata: () => { if (tags.pickerOpen) tags.closePicker(); if (properties.pickerOpen) properties.closePicker(); },
        handlePropertyFocus: () => { tags.closePicker(); properties.openPicker(); },
        handleTagFocus: () => { properties.closePicker(); if (!restoringTagFocusRef.current) tags.openPicker(); },
        focusTags: () => focusField('tags'),
        setTagInput: (element: HTMLInputElement | null) => { tagInputRef.current = element; },
        setTitleInput: (element: HTMLInputElement | null) => { titleInputRef.current = element; onTitleInputRef(element); },
        setAuthorInput: (element: HTMLInputElement | null) => { authorInputRef.current = element; },
        setNoteInput: (element: HTMLTextAreaElement | null) => { noteInputRef.current = element; },
    };
}
export type WebsitePopupCollectionItemForm = ReturnType<typeof useWebsitePopupCollectionItemForm>;

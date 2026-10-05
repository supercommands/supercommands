/** Shared item metadata autosave; Screenshot creation stays in the capture save controller. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CollectionClientError, createCollectionItem, updateCollectionItem, saveCollectionWebScraping, setCollectionItemPropertyValue } from '../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { WebsitePopupCollectionItemFooterState } from './WebsitePopupCollectionItemStatusFooter';
import type { ExtractedWebScraping, ExtractedElementClip } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import { validateElementSnapshotDraft } from '../../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { normalizeCollectionItemTagIds } from '../../../../allObjectFolder/src/createObject/collections/collectionTagValidation';
import { isCollectionSourceUrl, collectionSourceLabel, type CollectionCaptureSource } from '../../../../shared-components/collections/collectionCaptureSource';


export type CollectionCaptureType = 'link' | 'article' | 'screenshot' | 'web-scraping';
export type CollectionPanelDraft = { title: string; note: string; tagIds: string[]; titleEdited: boolean; propertyValues: Record<string, string> };
const pageTitle = () => document.title.trim() || collectionSourceLabel(window.location.href) || 'Untitled Page';
const messageOf = (failure: unknown) => failure instanceof Error ? failure.message : String(failure);
const sameTags = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((id, index) => id === right[index]);

export function useWebsitePopupCollectionItemAutosave(organisationId: string | null | undefined,
    collectionId: string | null, type: CollectionCaptureType, sourceUrl: string | null, active: boolean,
    initialRecord: CollectionItemRecord | null = null, webDraft: ExtractedWebScraping | null = null,
    sourceContext: CollectionCaptureSource | null = null, panelDraft?: CollectionPanelDraft) {
    const [title, setTitle] = useState(() => panelDraft?.title ?? initialRecord?.title ?? webDraft?.title ?? sourceContext?.title ?? pageTitle());
    const [note, setNote] = useState(panelDraft?.note ?? initialRecord?.note ?? '');
    const [author, setAuthor] = useState(initialRecord?.type === 'article' ? initialRecord.data.author || '' : '');
    const [tagIds, setTagIds] = useState(() => normalizeCollectionItemTagIds(panelDraft?.tagIds ?? initialRecord?.tagIds));
    const [articleText, setArticleText] = useState(initialRecord?.type === 'article' ? initialRecord.data.text : '');
    const [record, setRecord] = useState<CollectionItemRecord | null>(initialRecord);
    const [propertyValues, setPropertyValues] = useState({ ...initialRecord?.propertyValues, ...panelDraft?.propertyValues });
    const propertyDrafts = useRef(new Map<string, string>(Object.entries(panelDraft?.propertyValues || {})
        .filter(([id, value]) => value !== initialRecord?.propertyValues[id])));
    const [status, setStatus] = useState<WebsitePopupCollectionItemFooterState['status']>(initialRecord ? 'saved' : type === 'screenshot' && !panelDraft ? 'error' : 'waiting');
    const [error, setError] = useState<string | null>(type === 'screenshot' && !initialRecord && !panelDraft ? 'Reopen the saved Screenshot from its Collection to edit it.' : null);
    const [canRetry, setCanRetry] = useState(type !== 'screenshot' || Boolean(initialRecord));
    const [retryRevision, setRetryRevision] = useState(0);
    const draftRef = useRef({ title, note, author, tagIds });
    const savedRef = useRef(initialRecord ? { title: initialRecord.title, note: initialRecord.note || '', author, tagIds: initialRecord.tagIds } : { title, note, author, tagIds });
    const editedRef = useRef({ title: panelDraft?.titleEdited || false, author: false });
    const recordRef = useRef<CollectionItemRecord | null>(initialRecord);
    const conflictRef = useRef(false);
    const attemptRef = useRef<{ key: string; cancelled: boolean; startedCreate: boolean } | null>(null);
    const timerRef = useRef<number | null>(null);
    const queueRef = useRef<Promise<void>>(Promise.resolve());
    const mountedRef = useRef(true);
    const savingRef = useRef(false);
    const unknownSaveRef = useRef(false);
    const webAutoAttemptRef = useRef<string | null>(null);
    useEffect(() => {
        if (type !== 'web-scraping' || !webDraft || recordRef.current) return;
        webAutoAttemptRef.current = null; // A newly confirmed capture may replace a failed unsaved draft.
        if (!editedRef.current.title) { draftRef.current.title = webDraft.title; setTitle(webDraft.title); }

    }, [type, webDraft]);

    const flushDetails = useCallback(() => {
        if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
        if (!recordRef.current || conflictRef.current) return;
        queueRef.current = queueRef.current.then(async () => {
            const current = recordRef.current;
            if (!current || conflictRef.current) return;
            const next = { ...draftRef.current, title: draftRef.current.title.trim(), author: draftRef.current.author.trim() };
            if (!next.title) throw new Error('Title is required.');
            const metadataChanged = next.title !== savedRef.current.title || next.note !== savedRef.current.note
                || next.author !== savedRef.current.author || !sameTags(next.tagIds, savedRef.current.tagIds);
            if (!metadataChanged && !propertyDrafts.current.size) {
                if (mountedRef.current) { setStatus('saved'); setError(null); }
                return;
            }
            if (mountedRef.current) { setStatus('saving-details'); setError(null); }
            const common = { title: next.title, note: next.note.trim() ? next.note : null, expectedUpdatedAt: current.updatedAt,
                ...(!sameTags(next.tagIds, savedRef.current.tagIds) ? { tagIds: next.tagIds } : {}) };
            let updated = metadataChanged ? await updateCollectionItem(current.organisationId, current.id, current.type === 'article'
                ? { ...common, type: 'article', ...(next.author !== savedRef.current.author
                    ? { data: { text: current.data.text, ...(next.author ? { author: next.author } : {}) } } : {}) }
                : current.type === 'screenshot' ? { ...common, type: 'screenshot' }
                    : current.type === 'web-scraping' ? { ...common, type: 'web-scraping' }
                    : { ...common, type: 'link' }) : current;
            recordRef.current = updated;
            savedRef.current = { ...next, tagIds: updated.tagIds };
            if (mountedRef.current) setRecord(updated);
            for (const [propertyId, value] of [...propertyDrafts.current]) {
                updated = await setCollectionItemPropertyValue(updated.organisationId, updated.id,
                    { propertyId, value: value === '' ? null : value, expectedUpdatedAt: updated.updatedAt });
                recordRef.current = updated;
                if (propertyDrafts.current.get(propertyId) === value) propertyDrafts.current.delete(propertyId);
                if (mountedRef.current) {
                    setRecord(updated);
                    setPropertyValues({ ...updated.propertyValues, ...Object.fromEntries(propertyDrafts.current) });
                }
            }
            if (mountedRef.current) {
                setRecord(updated);
                setStatus(draftRef.current.title.trim() === next.title && draftRef.current.note === next.note
                    && draftRef.current.author.trim() === next.author && sameTags(draftRef.current.tagIds, updated.tagIds) && !propertyDrafts.current.size
                    ? 'saved' : 'saving-details');
            }
        }).catch(failure => {
            const conflict = failure instanceof CollectionClientError && failure.code === 'CONFLICT';
            if (conflict) conflictRef.current = true;
            if (mountedRef.current) {
                setStatus('error'); setCanRetry(!conflict);
                setError(conflict ? 'This item changed elsewhere. Your latest edits were not saved.' : messageOf(failure));
            }
        });
    }, []);

    // The unified panel stays mounted during capture. Adopt the screenshot receipt once,
    // then apply the metadata the user entered before selecting the capture area.
    useEffect(() => {
        if (!panelDraft || !initialRecord || recordRef.current) return;
        recordRef.current = initialRecord;
        savedRef.current = { title: initialRecord.title, note: initialRecord.note || '', author: '', tagIds: initialRecord.tagIds };
        setRecord(initialRecord); setError(null); setCanRetry(true);
        flushDetails();
    }, [initialRecord, flushDetails]);
    useEffect(() => { if (panelDraft && initialRecord) flushDetails(); }, [flushDetails]);

    useEffect(() => {
        if (!active || type === 'screenshot' || type === 'web-scraping' || !organisationId || !collectionId || recordRef.current) return;
        const key = `${organisationId}:${collectionId}:${type}:${retryRevision}`;
        if (attemptRef.current?.key === key && !attemptRef.current.cancelled) return;
        // An already dispatched create must never be repeated on an effect remount.
        if (attemptRef.current?.key === key && attemptRef.current.startedCreate) return;
        const attempt = { key, cancelled: false, startedCreate: false };
        attemptRef.current = attempt;
        setError(null); setCanRetry(true);
        void (async () => {
            const url = new URL(sourceContext?.url || sourceUrl || window.location.href);
            if (!isCollectionSourceUrl(url.href)) throw new Error('Capture requires a website or this extension’s New Tab page.');
            if (window.location.href !== url.href) throw new Error('The page changed. Start capture again.');
            let initialTitle = sourceContext?.title || pageTitle();
            let initialAuthor = '';
            let text = '';
            if (type === 'article') {
                setStatus('extracting');
                const { extractArticleFromDocument } = await import('../../../../shared-components/pageExtraction/article/extractArticleFromDocument');
                if (attempt.cancelled) return;
                const article = await extractArticleFromDocument(document, url.href, sourceContext?.title);
                if (attempt.cancelled) return;
                initialTitle = article.title; initialAuthor = article.author; text = article.text;
                setArticleText(article.text);
            }
            if (attempt.cancelled) return;
            if (window.location.href !== url.href) throw new Error('The page changed. Start capture again.');
            if (!editedRef.current.title) { draftRef.current.title = initialTitle; setTitle(initialTitle); }
            if (!editedRef.current.author) { draftRef.current.author = initialAuthor; setAuthor(initialAuthor); }
            // Keep a valid captured title when a temporary empty edit occurs during extraction.
            const createTitle = draftRef.current.title.trim() || initialTitle;
            const createAuthor = draftRef.current.author.trim();
            const createNote = draftRef.current.note;
            const createTagIds = [...draftRef.current.tagIds];
            setStatus('creating');
            attempt.startedCreate = true;
            const common = { organisationId, collectionId, title: createTitle, url: url.href, tagIds: createTagIds,
                ...(createNote.trim() ? { note: createNote } : {}) };
            const item = await createCollectionItem(type === 'article'
                ? { ...common, type: 'article', data: { text, ...(createAuthor ? { author: createAuthor } : {}) } }
                : { ...common, type: 'link', data: {} });
            recordRef.current = item;
            if (mountedRef.current) setPropertyValues({ ...item.propertyValues, ...Object.fromEntries(propertyDrafts.current) });
            savedRef.current = { title: createTitle, note: createNote, author: createAuthor, tagIds: item.tagIds };
            if (mountedRef.current) { setRecord(item); setStatus('saved'); }
            flushDetails();
        })().catch(failure => {
            if (!mountedRef.current || (attempt.cancelled && !attempt.startedCreate)) return;
            const unknownSave = attempt.startedCreate && failure instanceof CollectionClientError && failure.code === 'TRANSPORT_ERROR';
            setStatus('error');
            setCanRetry(!unknownSave);
            setError(unknownSave ? 'Could not confirm the save. Check this Collection before capturing again.' : messageOf(failure));
        });
        return () => { attempt.cancelled = true; };
    }, [active, collectionId, flushDetails, organisationId, retryRevision, sourceUrl, sourceContext, type]);

    useEffect(() => {
        mountedRef.current = true;
        return () => { flushDetails(); mountedRef.current = false; };
    }, [flushDetails]);
    useEffect(() => { if (!active) flushDetails(); }, [active, flushDetails]);

    const scheduleDetailsSave = useCallback(() => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        if (recordRef.current) {
            if (!conflictRef.current) {
                setStatus('saving-details'); setError(null);
                timerRef.current = window.setTimeout(flushDetails, 400);
            }
        }
    }, [flushDetails]);
    const change = useCallback((field: 'title' | 'note' | 'author', value: string) => {
        draftRef.current[field] = value;
        if (field === 'title') { editedRef.current.title = true; setTitle(value); }
        else if (field === 'author') { editedRef.current.author = true; setAuthor(value); }
        else setNote(value);
        scheduleDetailsSave();
    }, [scheduleDetailsSave]);
    const changeTagIds = useCallback((value: readonly string[]) => {
        const next = normalizeCollectionItemTagIds(value);
        if (sameTags(next, draftRef.current.tagIds)) return;
        draftRef.current.tagIds = next;
        setTagIds(next);
        scheduleDetailsSave();
    }, [scheduleDetailsSave]);
    const changePropertyValue = useCallback((propertyId: string, value: string) => {
        if (!recordRef.current && !panelDraft) return;
        propertyDrafts.current.set(propertyId, value);
        setPropertyValues(previous => ({ ...previous, [propertyId]: value }));
        scheduleDetailsSave();
    }, [scheduleDetailsSave, Boolean(panelDraft)]);
    const saveWebScraping = useCallback(async () => {
        if (!active || type !== 'web-scraping' || !webDraft || !organisationId || !collectionId
            || recordRef.current || savingRef.current || unknownSaveRef.current) return;
        savingRef.current = true;
        let submitted = false;
        try {
            const next = { ...draftRef.current, title: draftRef.current.title.trim() };
            if (!next.title) throw new Error('Title is required.');
            if (window.location.href !== webDraft.url) throw new Error('The page changed. Capture its content again.');
            const elementDraft = webDraft as ExtractedElementClip;
            validateElementSnapshotDraft(elementDraft.snapshot);
            if (!Array.isArray(elementDraft.snapshotImages)) throw new Error('Capture the element again to include its appearance.');
            setStatus('creating'); setError(null);
            submitted = true;
            const result = await saveCollectionWebScraping({ organisationId, collectionId, title: next.title, tagIds: next.tagIds, draft: elementDraft,
                ...(next.note.trim() ? { note: next.note } : {}) });
            if (result.status === 'skipped') {
                if (mountedRef.current) { setStatus('skipped'); setError(null); setCanRetry(false); }
                return;
            }
            const item = result.item;
            if (item.type !== 'web-scraping' || !item.data.snapshotId || item.organisationId !== organisationId || item.collectionId !== collectionId || item.url !== webDraft.url) {
                throw new CollectionClientError('TRANSPORT_ERROR', 'Could not verify the saved capture.');
            }
            recordRef.current = item; savedRef.current = { ...next, tagIds: item.tagIds };
            if (mountedRef.current) setPropertyValues({ ...item.propertyValues, ...Object.fromEntries(propertyDrafts.current) });
            if (mountedRef.current) { setRecord(item); setStatus('saved'); }
            flushDetails();
        } catch (failure) {
            const unknown = submitted && failure instanceof CollectionClientError && failure.code === 'TRANSPORT_ERROR';
            if (unknown) unknownSaveRef.current = true;
            if (mountedRef.current) {
                setStatus('error'); setCanRetry(!unknown);
                setError(unknown ? 'Could not confirm the save. Check this Collection before capturing again.' : messageOf(failure));
            }
        } finally { savingRef.current = false; }
    }, [active, collectionId, flushDetails, organisationId, type, webDraft]);
    useEffect(() => {
        if (!active || type !== 'web-scraping' || !webDraft || !organisationId || !collectionId
            || !title.trim() || recordRef.current || unknownSaveRef.current) return;
        const key = `${organisationId}:${collectionId}:${retryRevision}`;
        // Mark before dispatch: effect replay or refreshed draft metadata must not create a second item.
        if (webAutoAttemptRef.current === key) return;
        webAutoAttemptRef.current = key;
        void saveWebScraping();
    }, [active, collectionId, organisationId, retryRevision, saveWebScraping, title, type, webDraft]);
    const retry = useCallback(() => {
        if (!canRetry) return;
        if (recordRef.current) flushDetails();
        else if (type === 'web-scraping') void saveWebScraping();
        else setRetryRevision(value => value + 1);
    }, [canRetry, flushDetails, saveWebScraping, type]);
    return { record, title, note, author, tagIds, changeTagIds, propertyValues, changePropertyValue, articleText, status, error, canRetry, retry, flushDetails,
        getPanelDraft: (): CollectionPanelDraft => ({ title: draftRef.current.title, note: draftRef.current.note,
            tagIds: [...draftRef.current.tagIds], titleEdited: editedRef.current.title,
            propertyValues: { ...recordRef.current?.propertyValues, ...Object.fromEntries(propertyDrafts.current) } }),
        changeTitle: (value: string) => change('title', value),
        changeNote: (value: string) => change('note', value),
        changeAuthor: (value: string) => change('author', value) };
}

import { getWebsitePopupClipLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
/** One capture panel for website and New Tab popup. Extraction and persistence owners stay shared. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { FiArrowLeft, FiX, FiCheck, FiLink, FiFileText, FiCamera, FiMousePointer, FiChevronDown } from 'react-icons/fi';
import { FaFolder } from 'react-icons/fa';
import { captureCollectionSource } from '../../../../shared-components/collections/collectionCaptureSource';
import { CollectionClientError, createCollection } from '../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { ExtractedWebScraping } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import type { WebsitePopupScreenshotCaptureController } from '../runtime/WebsitePopupScreenshotCaptureController';
import { WebsitePopupFormPanel } from '../display/WebsitePopupFormPanel';
import { WebsitePopupResults } from '../display/WebsitePopupResults';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupCollectionItemFields } from './WebsitePopupCollectionItemFields';
import { useWebsitePopupCollectionItemForm } from './useWebsitePopupCollectionItemForm';
import type { CollectionCaptureType, CollectionPanelDraft } from './useWebsitePopupCollectionItemAutosave';
import { WebsitePopupCollectionTagSuggestions, WEBSITE_POPUP_COLLECTION_TAG_FIELD } from './WebsitePopupCollectionTagPicker';
import { WebsitePopupCollectionPropertySuggestions } from './WebsitePopupCollectionCustomProperties';
import { COLLECTION_PROPERTY_PICKER_FIELD } from './useWebsitePopupCollectionProperties';
import { WebsitePopupCollectionItemStatusFooter } from './WebsitePopupCollectionItemStatusFooter';
import { WebsitePopupCollectionContentPreview } from './WebsitePopupCollectionContentPreview';
import { WebsitePopupScreenshotModeChooser } from './WebsitePopupScreenshotModeChooser';
import { ConnectedWebsitePopupScreenshotStatusFooter } from './ConnectedWebsitePopupScreenshotStatusFooter';

const formats = [
  { type: 'link', label: getWebsitePopupClipLabel('link'), icon: FiLink },
  { type: 'article', label: getWebsitePopupClipLabel('article'), icon: FiFileText },
  { type: 'screenshot', label: getWebsitePopupClipLabel('screenshot'), icon: FiCamera },
  { type: 'web-scraping', label: getWebsitePopupClipLabel('web-scraping'), icon: FiMousePointer },
] as const;
const ignoreProjection = () => {};
type Props = {
  store: WebsitePopupInteractionStoreApi;
  snapshot: WebsitePopupSearchSnapshot;
  open: boolean;
  savedScreenshot: CollectionItemRecord | null;
  webDraft: ExtractedWebScraping | null;
  webError: string | null;
  onSelectElement: () => void;
  controller: WebsitePopupScreenshotCaptureController | null;
  onTitleInputRef: (element: HTMLInputElement | null) => void;
  onClose: () => void;
};
type Retained = { draft: CollectionPanelDraft; record: CollectionItemRecord | null };
const captureKey = (type: string, collectionId: string | null) => `${type}:${collectionId || ''}`;

export function WebsitePopupCollectionCapturePanel(props: Props) {
  const session = useStore(props.store, value => value.state.collectionSession);
  const shared = useRef<CollectionPanelDraft>({ title: document.title.trim() || 'Untitled Page', note: '', tagIds: [], titleEdited: false, propertyValues: {} });
  const records = useRef(new Map<string, Retained>());
  const propertyDrafts = useRef(new Map<string, Record<string, string>>());
  const [sourceError, setSourceError] = useState<string | null>(null);
  useEffect(() => {
    if (session?.captureType && session.sourceContext) return;
    let cancelled = false;
    void captureCollectionSource(document).then(sourceContext => {
      if (cancelled) return;
      shared.current.title = sourceContext.title;
      props.store.getState().dispatch({ type: 'COLLECTION_PANEL_CONFIGURED', itemType: 'link',
        collectionId: session?.selectedCollectionId || null, collectionName: session?.selectedCollectionName || null, sourceContext });
    }).catch(error => { if (!cancelled) setSourceError(error instanceof Error ? error.message : 'Could not read this page.'); });
    return () => { cancelled = true; };
  }, [props.store, session?.captureType, session?.sourceContext]);
  if (!session?.captureType || !session.sourceContext) return <WebsitePopupFormPanel presentation="standalone" label="Web Clips"
    onEscape={props.onClose} fields={<p role="status">{sourceError || 'Preparing capture…'}</p>}
    footer={<button type="button" className="website-popup-create-footer__expand-details" aria-label="Close" onClick={props.onClose}><FiX/></button>}/>;
  const key = captureKey(session.captureType, session.selectedCollectionId);
  const retained = records.current.get(key);
  const initial = props.savedScreenshot || retained?.record || null;
  const draft = { ...shared.current, propertyValues: propertyDrafts.current.get(session.selectedCollectionId || '') || {} };
  return <CaptureForm key={session.captureRevision} {...props} initial={initial} draft={draft}
    onConfigure={(type, collectionId, name, current, recapture = false) => {
      shared.current = current.draft;
      propertyDrafts.current.set(session.selectedCollectionId || '', current.draft.propertyValues);
      records.current.set(key, current);
      const nextKey = captureKey(type, collectionId);
      if (recapture) records.current.delete(nextKey);
      props.store.getState().dispatch({ type: 'COLLECTION_PANEL_CONFIGURED', itemType: type,
        collectionId, collectionName: name, sourceContext: session.sourceContext!, hasRecord: Boolean(records.current.get(nextKey)?.record) });
    }}/>;
}

function CaptureForm({ initial, draft, onConfigure, ...props }: Props & {
  initial: CollectionItemRecord | null;
  draft: CollectionPanelDraft;
  onConfigure: (type: CollectionCaptureType, id: string | null, name: string | null, current: Retained, recapture?: boolean) => void;
}) {
  const session = useStore(props.store, value => value.state.collectionSession)!;
  const [destinationOpen, setDestinationOpen] = useState(false);
  const destinationInput = useRef<HTMLInputElement | null>(null);
  const restoringDestinationFocus = useRef(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [unknownDestinationOutcome, setUnknownDestinationOutcome] = useState(false);
  const creatingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const form = useWebsitePopupCollectionItemForm({ store: props.store, snapshot: props.snapshot, open: props.open,
    initialRecord: initial, webDraft: props.webDraft, panelDraft: draft, presentation: 'standalone',
    onTitleInputRef: props.onTitleInputRef, onPreviewChange: ignoreProjection, onStatusChange: ignoreProjection, onEscape: props.onClose });
  const capture = form.capture;
  const metadataReader = useRef(capture.getPanelDraft);
  metadataReader.current = capture.getPanelDraft;
  useEffect(() => {
    props.controller?.saveController.setMetadataReader(() => metadataReader.current());
    return () => props.controller?.saveController.setMetadataReader(null);
  }, [props.controller]);
  const type = session.captureType as CollectionCaptureType;
  const busy = creating || form.tags.pending || form.properties.pending || capture.status === 'creating' || capture.status === 'saving-details';
  // A failed, unconfirmed create cannot safely be retried by switching away and back.
  const blocked = busy || (capture.status === 'error' && !capture.canRetry)
    || (session.screenshot.status === 'error' && !session.screenshot.canRetry);
  const configure = (nextType: CollectionCaptureType, id = session.selectedCollectionId, name = session.selectedCollectionName, recapture = false) => {
    if (blocked) return;
    capture.flushDetails();
    onConfigure(nextType, id, name, { draft: capture.getPanelDraft(), record: capture.record }, recapture);
  };
  const collections = props.snapshot.newCollections;
  const matches = collections.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const canCreate = !unknownDestinationOutcome && Boolean(query.trim() && props.snapshot.defaultOrganisationId)
    && !collections.some(item => item.name.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const rows = [...matches.map(item => ({ id: item.id, title: item.name, icon: <FaFolder/>, iconTone: 'collection' as const })),
    ...(canCreate ? [{ id: 'create-collection', title: `Create “${query.trim()}”`, icon: <FaFolder/>, iconTone: 'collection' as const }] : [])];
  const choose = async (index: number) => {
    if (blocked || creatingRef.current || !rows[index]) return;
    if (index < matches.length) { configure(type, matches[index].id, matches[index].name); return; }
    creatingRef.current = true; setCreating(true); setDestinationError(null);
    try {
      const collection = await createCollection({ organisationId: props.snapshot.defaultOrganisationId!, name: query.trim() });
      if (mounted.current) onConfigure(type, collection.id, collection.name, { draft: capture.getPanelDraft(), record: capture.record });
    } catch (error) { if (mounted.current) {
      const unknown = error instanceof CollectionClientError && error.code === 'TRANSPORT_ERROR';
      setUnknownDestinationOutcome(unknown);
      setDestinationError(unknown ? 'Could not confirm creation. Check your Web Clips before creating another folder.'
        : error instanceof Error ? error.message : 'Could not create the collection.');
    } }
    finally { creatingRef.current = false; if (mounted.current) setCreating(false); }
  };
  const closeDestination = () => {
    setDestinationOpen(false);
    restoringDestinationFocus.current = true;
    destinationInput.current?.focus({ preventScroll: true });
    restoringDestinationFocus.current = false;
  };
  const escape = () => { if (destinationOpen) { closeDestination(); return; } form.escape(); };
  const picker = destinationOpen ? <WebsitePopupResults ariaLabel="Web Clips" emptyState="No matching Web Clips" showHeadings={false}
    statusMessage={destinationError || (creating ? 'Creating collection…' : undefined)}
    onMouseDown={event => event.preventDefault()} onRowSelectionRequest={setSelectedIndex} onRowActivationRequest={index => void choose(index)}
    sections={rows.length ? [{ id: 'capture-destinations', label: 'Web Clips', rows: rows.map((row, index) => ({ ...row, selected: index === selectedIndex, disabled: blocked })) }] : []}/>
    : form.properties.pickerOpen ? <WebsitePopupCollectionPropertySuggestions form={form} showHeadings={false}/>
    : form.tags.pickerOpen ? <WebsitePopupCollectionTagSuggestions sections={form.tags.sections} selectedIndex={form.tags.selectedIndex} showHeadings={false}
      onSelect={form.tags.selectIndex} onActivate={intent => { void form.tags.activate(intent); form.focusTags(); }}
      statusMessage={form.tags.error || (form.tags.pending ? 'Creating tag…' : undefined)}/> : null;
  const needsCapture = !capture.record && (type === 'screenshot' || type === 'web-scraping');
  const screenshotStatus = type === 'screenshot' && !capture.record && session.screenshot.status !== 'idle';
  const message = !session.selectedCollectionId ? 'Choose a Web Clip to save.'
    : needsCapture ? 'Capture content to save automatically.' : undefined;
  const footer = screenshotStatus ? <ConnectedWebsitePopupScreenshotStatusFooter store={props.store} controller={props.controller}
    organisationId={props.snapshot.defaultOrganisationId || null} presentation="standalone"/>
    : <WebsitePopupCollectionItemStatusFooter presentation="standalone" state={{ revision: session.captureRevision,
      status: capture.status, error: capture.error || destinationError || props.webError, retry: props.webError ? props.onSelectElement : capture.retry,
      canRetry: destinationError ? false : capture.canRetry, itemId: capture.record?.id, lastSavedAt: capture.record?.updatedAt, message }}/>;
  return <WebsitePopupFormPanel presentation="standalone" label="Web Clips" onEscape={escape}
    headerContent={<><button type="button" className="website-popup-create-footer__expand-details" aria-label="Back to commands"
      onClick={() => { capture.flushDetails(); props.store.getState().dispatch({ type: 'COLLECTION_PANEL_EXITED' }); }}><FiArrowLeft/></button>
      <div className="website-popup-collection-title"><WebsitePopupCollectionItemFields form={form} presentation="standalone" section="title"/></div>
      <button type="button" className="website-popup-create-footer__expand-details website-popup-collection-panel__close" aria-label="Close Web Clips"
        onClick={() => { capture.flushDetails(); props.onClose(); }}><FiX/></button></>}
    fields={<>
      <section aria-label="Capture format" className="website-popup-collection-format-list">
        <div className="website-popup-section__heading">Capture format</div>
        {formats.map(format => <button type="button" key={format.type} className="website-popup-collection-format"
          aria-pressed={type === format.type} disabled={blocked} onClick={() => { if (format.type !== type) configure(format.type); }}>
          <format.icon aria-hidden="true"/><span>{format.label}</span>{type === format.type && <FiCheck aria-hidden="true"/>}</button>)}
      </section>
      <WebsitePopupArgumentSlot fieldId="collection" label={<>Add to collection <span className="website-popup-collection-required" aria-hidden="true">*</span></>} kind="single-select" width="long" active={destinationOpen}>
        <span className="website-popup-collection-destination">
          <span className="website-popup-collection-field-icon website-popup-collection-field-icon--folder" aria-hidden="true"><FaFolder/></span>
          <input ref={destinationInput} className="website-popup-create-composer__input" aria-label="Add to collection" aria-required="true" role="combobox"
            aria-expanded={destinationOpen} aria-controls={destinationOpen ? 'website-popup-results' : undefined} aria-autocomplete="list"
            aria-activedescendant={destinationOpen && rows[selectedIndex] ? `website-popup-result-${selectedIndex}` : undefined}
            value={destinationOpen ? query : session.selectedCollectionName || collections.find(item => item.id === session.selectedCollectionId)?.name || ''}
            disabled={blocked} placeholder="Choose a collection" onFocus={() => { if (!restoringDestinationFocus.current) { form.focusMetadata(); setDestinationOpen(true); } }}
            onClick={() => setDestinationOpen(true)} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); setDestinationOpen(true); }}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDestination(); }
              if (event.key === 'Tab') setDestinationOpen(false);
              if (event.key === 'Enter') { event.preventDefault(); void choose(selectedIndex); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setDestinationOpen(true);
                setSelectedIndex(index => rows.length ? (index + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length : 0); }
            }}/><button type="button" className="website-popup-create-footer__expand-details" aria-label={destinationOpen ? 'Close Web Clips dropdown' : 'Show Web Clips'}
              aria-expanded={destinationOpen} onMouseDown={event => event.preventDefault()}
              onClick={() => { if (destinationOpen) closeDestination(); else { form.focusMetadata(); setDestinationOpen(true); destinationInput.current?.focus({ preventScroll: true }); } }}>
                {destinationOpen ? <FiX aria-hidden="true"/> : <FiChevronDown aria-hidden="true"/>}
            </button>
        </span>
      </WebsitePopupArgumentSlot>
      {type !== 'link' && <section className="website-popup-collection-capture-details" aria-label="Capture details" onFocusCapture={() => setDestinationOpen(false)}>
        <div className="website-popup-section__heading">Capture details</div>
        <WebsitePopupCollectionItemFields form={form} presentation="standalone" section="capture"/>
        {needsCapture && type === 'screenshot' && <WebsitePopupScreenshotModeChooser store={props.store} controller={props.controller}
          organisationId={props.snapshot.defaultOrganisationId || null} enabled={props.open && Boolean(session.selectedCollectionId) && !blocked
            && (session.screenshot.status === 'idle' || session.screenshot.status === 'error'
              && session.screenshot.failureStage !== 'saving' && session.screenshot.failureStage !== 'preparing-image')} embedded/>}
        {needsCapture && type === 'web-scraping' && <button type="button" className="website-popup-collection-format"
          disabled={!session.selectedCollectionId || blocked} onClick={props.onSelectElement}>Select element</button>}
        {(capture.record || capture.articleText || props.webDraft) && <div className="website-popup-collection-capture-preview website-popup-custom-scrollbar">
          <WebsitePopupCollectionContentPreview enabled={props.open} embedded hideTitle state={{ revision: session.captureRevision,
            type, title: capture.title, url: session.sourceUrl, record: capture.record, articleText: capture.articleText, webDraft: props.webDraft, status: capture.status }}/>
        </div>}
      </section>}
      <div onFocusCapture={() => setDestinationOpen(false)}><WebsitePopupCollectionItemFields form={form} presentation="standalone" section="metadata"/></div>
    </>} picker={picker} onPickerClose={escape} pickerCloseInField
    onPickerDismiss={() => { setDestinationOpen(false); form.tags.closePicker(); form.properties.closePicker(); }}
    pickerCloseLabel={destinationOpen ? 'Close Web Clips dropdown' : form.properties.pickerOpen ? 'Close Properties dropdown' : 'Close Tags dropdown'}
    activePickerFieldId={destinationOpen ? 'collection' : form.properties.pickerOpen ? COLLECTION_PROPERTY_PICKER_FIELD
      : form.tags.pickerOpen ? WEBSITE_POPUP_COLLECTION_TAG_FIELD : null} footer={footer}/>;
}

/** Stateless field presentation; inline and panel views consume the same form owner. */
import type { WebsitePopupPresentation } from '../interaction/websitePopupPresentation';
import type { WebsitePopupCollectionItemForm } from './useWebsitePopupCollectionItemForm';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupUrlToken } from './WebsitePopupUrlToken';
import { WebsitePopupCollectionTagField } from './WebsitePopupCollectionTagPicker';
import { WebsitePopupCollectionCustomProperties } from './WebsitePopupCollectionCustomProperties';
import { FiTag, FiX } from 'react-icons/fi';

export function WebsitePopupCollectionItemFields({ form, presentation = 'inline', section = 'all' }: {
    form: WebsitePopupCollectionItemForm;
    presentation?: WebsitePopupPresentation;
    section?: 'all' | 'title' | 'capture' | 'metadata';
}) {
    if (!form.supported) return null;
    const { capture, itemLabel, isArticle, isScreenshot } = form;
    return <div data-collection-section={presentation === 'standalone' ? section : undefined} className={presentation === 'standalone'
        ? 'website-popup-create-side-panel__selected-properties' : 'website-popup-create-composer'}>
      {section === 'all' && <WebsitePopupArgumentSlot fieldId="collection" label="Web Clip" kind="single-select" width="medium">
        <WebsitePopupAutoWidthField className="website-popup-create-composer__input" value={form.collectionName}
          aria-label="Selected Web Clip" readOnly tabIndex={-1}/>
      </WebsitePopupArgumentSlot>}
      {(section === 'all' || section === 'title') && <WebsitePopupArgumentSlot fieldId="title" label="Title" kind="single-line-text" width="medium" active>
        <WebsitePopupAutoWidthField ref={form.setTitleInput} className="website-popup-create-composer__input"
          value={capture.title} aria-label={`${itemLabel} Title`} aria-required="true" aria-invalid={!capture.title.trim()}
          onFocus={form.focusMetadata}
          onChange={event => capture.changeTitle(event.currentTarget.value)} onBlur={capture.flushDetails}
          onKeyDown={event => form.handleFieldKeyDown('title', event)}/>
      </WebsitePopupArgumentSlot>}
      {section === 'all' && form.capturedUrl ? <WebsitePopupArgumentSlot fieldId="link-url" label={isArticle || isScreenshot ? 'Source' : 'Link'} kind="multi-select" width="medium">
        <span className="website-popup-multi-select-argument website-popup-multi-select-argument--read-only">
          <WebsitePopupUrlToken url={form.capturedUrl} label={form.capturedSite}/>
        </span>
      </WebsitePopupArgumentSlot> : null}
      {(section === 'all' || section === 'capture') && isArticle ? <WebsitePopupArgumentSlot fieldId="author" label="Author" kind="single-line-text" width="medium">
        <WebsitePopupAutoWidthField ref={form.setAuthorInput} className="website-popup-create-composer__input"
          value={capture.author} aria-label="Article author" placeholder="Optional author"
          onFocus={form.focusMetadata}
          onChange={event => capture.changeAuthor(event.currentTarget.value)} onBlur={capture.flushDetails}
          onKeyDown={event => form.handleFieldKeyDown('author', event)}/>
      </WebsitePopupArgumentSlot> : null}
      {(section === 'all' || section === 'metadata') && <>
      {section === 'metadata' && <WebsitePopupCollectionTagField values={form.tags.selected} query={form.tags.query} active={form.tags.pickerOpen}
        leading={!form.tags.selected.length ? <span className="website-popup-collection-field-icon" aria-hidden="true"><FiTag/></span> : undefined}
        trailing={form.tags.pickerOpen ? <button type="button" className="website-popup-create-footer__expand-details website-popup-collection-field-close"
          aria-label="Close Tags dropdown" title="Close Tags dropdown" onMouseDown={event => event.preventDefault()} onClick={form.escape}><FiX aria-hidden="true"/></button> : undefined}
        inputRef={form.setTagInput} onFocus={form.handleTagFocus} onQueryChange={value => {
          form.tags.changeQuery(value); form.tags.openPicker();
        }} onKeyDown={form.handleTagKeyDown} onRemove={form.tags.remove}/>}
      <WebsitePopupArgumentSlot fieldId="note" label="Note" kind="multiline-text" width="long">
        <textarea ref={form.setNoteInput} rows={3}
          className="website-popup-create-composer__textarea website-popup-collection-note website-popup-custom-scrollbar"
          value={capture.note} placeholder="Optional note" aria-label={`Note for captured ${itemLabel}`}
          onFocus={form.focusMetadata}
          onChange={event => capture.changeNote(event.currentTarget.value)} onBlur={capture.flushDetails}
          onKeyDown={event => form.handleFieldKeyDown('note', event)}/>
      </WebsitePopupArgumentSlot>
      {section === 'all' && <WebsitePopupCollectionTagField values={form.tags.selected} query={form.tags.query} active={form.tags.pickerOpen}
        inputRef={form.setTagInput} onFocus={form.handleTagFocus} onQueryChange={value => {
          form.tags.changeQuery(value); form.tags.openPicker();
        }} onKeyDown={form.handleTagKeyDown} onRemove={form.tags.remove}/>}
      {presentation === 'standalone' && <WebsitePopupCollectionCustomProperties form={form}/>}
      </>}
    </div>;
}

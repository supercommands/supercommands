/** Controlled optional fields; persistence stays in the shared form owner. */
import { FiChevronDown, FiPlus, FiType, FiX } from 'react-icons/fi';
import type { WebsitePopupCollectionItemForm } from './useWebsitePopupCollectionItemForm';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupOptionalSingleControl } from './WebsitePopupOptionalSingleControl';
import { WebsitePopupResults } from '../display/WebsitePopupResults';
import { COLLECTION_PROPERTY_PICKER_FIELD } from './useWebsitePopupCollectionProperties';

export function WebsitePopupCollectionCustomProperties({ form }: { form: WebsitePopupCollectionItemForm }) {
  const properties = form.properties;
  const chooser = properties.entryVisible && <WebsitePopupArgumentSlot fieldId={COLLECTION_PROPERTY_PICKER_FIELD} label="Properties" kind="single-select" width="long" active={properties.pickerOpen}>
      <span className="website-popup-create-option-placeholder website-popup-create-option-placeholder--input website-popup-collection-property-select">
      <WebsitePopupAutoWidthField ref={properties.setInput} className="website-popup-create-composer__input"
        value={properties.query} placeholder="Search or create a property" aria-label="Search or create a Collection property"
        role="combobox" aria-expanded={properties.pickerOpen} aria-controls={properties.pickerOpen ? 'website-popup-results' : undefined}
        aria-autocomplete="list" onFocus={form.handlePropertyFocus} onClick={form.handlePropertyFocus}
        onChange={event => properties.changeQuery(event.currentTarget.value)} onKeyDown={properties.handleKeyDown}/>
      <button type="button" tabIndex={form.panelDraft && properties.pickerOpen ? 0 : -1}
        aria-label={form.panelDraft && properties.pickerOpen ? 'Close Properties dropdown' : 'Show Collection properties'} aria-expanded={properties.pickerOpen}
        onMouseDown={event => event.preventDefault()} onClick={() => {
          if (form.panelDraft && properties.pickerOpen) form.escape();
          else { properties.focusPicker(); form.handlePropertyFocus(); }
        }}>
        {form.panelDraft && properties.pickerOpen ? <FiX aria-hidden="true"/> : <FiChevronDown aria-hidden="true"/>}
      </button>
      </span>
    </WebsitePopupArgumentSlot>;
  return <>
    {properties.selected.map(definition => <WebsitePopupArgumentSlot key={definition.id} fieldId={`property-${definition.id}`} label={definition.label} kind="single-line-text" width="long">
      <WebsitePopupOptionalSingleControl removeLabel={`Remove ${definition.label} from this item`} onRemove={() => properties.remove(definition.id)}>
        <input type="text" ref={element => properties.setValueInput(definition.id, element)}
          className="website-popup-create-composer__input website-popup-collection-property-value"
          value={form.capture.propertyValues[definition.id] ?? ''} placeholder="Optional value" aria-label={definition.label}
          disabled={!form.capture.record && !form.panelDraft} onFocus={form.focusMetadata}
          onChange={event => form.capture.changePropertyValue(definition.id, event.currentTarget.value)}
          onBlur={form.capture.flushDetails} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); form.capture.flushDetails(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); form.escape(); }
            if (event.key === 'Backspace' && !event.currentTarget.value) { event.preventDefault(); event.stopPropagation(); properties.focusPicker(); }
          }}/>
      </WebsitePopupOptionalSingleControl>
    </WebsitePopupArgumentSlot>)}
    {chooser}
    {!properties.entryVisible && <WebsitePopupArgumentSlot fieldId="collection-property-add" label="Properties" kind="single-select" width="long">
      <button type="button" className="website-popup-create-option-placeholder website-popup-collection-property-add"
        onClick={() => { form.focusMetadata(); properties.addAnother(); }}>
        <FiPlus aria-hidden="true"/> Add property
      </button>
    </WebsitePopupArgumentSlot>}
    {properties.error && <WebsitePopupArgumentSlot fieldId="property-error" label="Properties" kind="single-line-text" width="long">
      <span role="alert" className="website-popup-create-footer__error">{properties.error}</span>
      <button type="button" className="website-popup-create-footer__save" disabled={properties.pending} onClick={() => { void properties.reload(); }}>Reload</button>
    </WebsitePopupArgumentSlot>}
  </>;
}

export function WebsitePopupCollectionPropertySuggestions({ form, showHeadings = true }: { form: WebsitePopupCollectionItemForm; showHeadings?: boolean }) {
  const properties = form.properties;
  return <WebsitePopupResults ariaLabel="Collection properties" showHeadings={showHeadings}
    emptyState={properties.query.trim() ? 'No available matching properties. Try another label.' : 'Type a property name to create one.'}
    statusMessage={properties.error || (properties.pending ? 'Loading or saving properties…' : undefined)}
    onMouseDown={event => event.preventDefault()} onRowSelectionRequest={properties.selectIndex}
    onRowActivationRequest={index => { void properties.activate(index); }}
    sections={properties.rows.length ? [{ id: 'collection-property-labels', label: 'Properties', rows: properties.rows.map((row, index) => ({
      id: row.id, title: row.create ? `Create “${row.label}”` : row.label, icon: row.create ? <FiPlus/> : <FiType/>, iconTone: 'option',
      disabled: row.disabled, selected: index === properties.selectedIndex,
    })) }] : []}/>;
}

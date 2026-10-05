/** Space-triggered inline adapter; Enter/click uses the unified capture panel. */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WebsitePopupCollectionItemFields } from './WebsitePopupCollectionItemFields';
import { useWebsitePopupCollectionItemForm, type WebsitePopupCollectionItemFormOptions } from './useWebsitePopupCollectionItemForm';
import { WebsitePopupCollectionTagSuggestions } from './WebsitePopupCollectionTagPicker';

export function ConnectedWebsitePopupCollectionItemDetailsComposer({ inlinePickerTarget, onTagPickerOpenChange, ...options }:
    WebsitePopupCollectionItemFormOptions & { inlinePickerTarget?: HTMLElement | null; onTagPickerOpenChange?: (open: boolean) => void }) {
    const form = useWebsitePopupCollectionItemForm({ ...options, presentation: 'inline' });
    useEffect(() => {
        onTagPickerOpenChange?.(options.open && form.tags.pickerOpen);
        return () => onTagPickerOpenChange?.(false);
    }, [form.tags.pickerOpen, onTagPickerOpenChange, options.open]);
    const picker = options.open && form.tags.pickerOpen ? <WebsitePopupCollectionTagSuggestions sections={form.tags.sections}
        selectedIndex={form.tags.selectedIndex} onSelect={form.tags.selectIndex}
        onActivate={intent => { void form.tags.activate(intent); form.focusTags(); }}
        statusMessage={form.tags.error || (form.tags.pending ? 'Creating tag…' : undefined)}/> : null;
    return <><WebsitePopupCollectionItemFields form={form} presentation="inline"/>
        {inlinePickerTarget && picker ? createPortal(picker, inlinePickerTarget) : null}</>;
}

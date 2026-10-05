import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WebsitePopupCreateSidePanel } from '../create/WebsitePopupCreateSidePanel';
import type { WebsitePopupChatSaveDestination } from './useWebsitePopupSaveChat';
const grammar = { entity: 'agent', fields: [], fieldPrefixes: [] };
export function WebsitePopupSaveChatSidePanel({ destination, page, pending, error, onSave, onCancel, }: {
    destination: WebsitePopupChatSaveDestination;
    page: {
        url: string;
        title: string;
    };
    pending: boolean;
    error: string | null;
    onSave: () => void;
    onCancel: () => void;
}) {
    const [properties, setProperties] = useState<HTMLDivElement | null>(null);
    const [footer, setFooter] = useState<HTMLDivElement | null>(null);
    const saveRef = useRef<HTMLButtonElement | null>(null);
    useLayoutEffect(() => {
        if (footer)
            saveRef.current?.focus({ preventScroll: true });
    }, [footer, destination.entity, destination.targetId]);
    return (<>
      <WebsitePopupCreateSidePanel grammar={grammar} label="Save to Agent" onCollapse={onCancel} onPropertiesMount={setProperties} onPickerMount={() => { }} activePickerField={null} onSaveMount={setFooter}/>
      {properties
            ? createPortal(<>
              <label className="website-popup-result-edit-panel__field">
                <span>{destination.entity === 'prompt' ? 'AI Prompt' : 'Chat Agent'}</span>
                <input readOnly value={destination.title}/>
              </label>
              <label className="website-popup-result-edit-panel__field">
                <span>Conversation URL</span>
                <input readOnly value={page.url} title={page.url}/>
              </label>
              {error ? (<p className="website-popup-result-edit-panel__error" role="alert">
                  {error}
                </p>) : null}
            </>, properties)
            : null}
      {footer
            ? createPortal(<div className="website-popup-result-edit-panel__footer">
              <button type="button" className="website-popup-result-edit-panel__secondary" disabled={pending} onClick={onCancel}>
                Cancel
              </button>
              <button ref={saveRef} type="button" className="website-popup-create-footer__save" disabled={pending} onClick={onSave}>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>, footer)
            : null}
    </>);
}

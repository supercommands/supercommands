import { useEffect } from 'react';
import { useStore } from 'zustand';
import { FiCrop, FiMonitor, FiFileText } from 'react-icons/fi';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupScreenshotCaptureController } from '../runtime/WebsitePopupScreenshotCaptureController';
import type { WebsitePopupScreenshotCaptureMode } from '../../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
import { WebsitePopupResultRow } from '../display/WebsitePopupResultRow';

const modes: { mode: WebsitePopupScreenshotCaptureMode; title: string; detail: string; icon: typeof FiCrop }[] = [
  { mode: 'area', title: 'Selected area', detail: 'Drag an area and confirm the crop', icon: FiCrop },
  { mode: 'visible', title: 'Visible page', detail: 'Capture and save the current view', icon: FiMonitor },
  { mode: 'full-page', title: 'Full page', detail: 'Scroll, capture and save the entire page', icon: FiFileText },
];

/** Reuses the command row presentation and per-popup selection state. */
export function WebsitePopupScreenshotModeChooser({ store, controller, organisationId, enabled, embedded = false }: {
  store: WebsitePopupInteractionStoreApi;
  controller: WebsitePopupScreenshotCaptureController | null;
  organisationId: string | null;
  enabled: boolean;
  embedded?: boolean;
}) {
  const selected = useStore(store, current => current.state.selectedIndex);
  const dispatch = store.getState().dispatch;
  const activate = (index: number) => {
    const choice = modes[index];
    if (enabled && choice && controller) void controller.captureMode(choice.mode, organisationId);
  };
  useEffect(() => {
    if (!enabled || embedded) return;
    dispatch({ type: 'SUGGESTION_COUNT_CHANGED', count: modes.length });
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      // Footer/header controls keep their native keyboard activation.
      const path = event.composedPath();
      if (path.some(target => target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement)) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = store.getState().state.selectedIndex;
      if (event.key === 'Enter') {
        const choice = modes[index];
        if (choice && controller) void controller.captureMode(choice.mode, organisationId);
      } else dispatch({ type: 'SELECTION_SET', index: (index + (event.key === 'ArrowDown' ? 1 : modes.length - 1)) % modes.length });
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [enabled, embedded, controller, organisationId, store, dispatch]);
  if (embedded) return <div className="website-popup-collection-format-list" aria-label="Screenshot capture mode">
    {modes.map((choice, index) => <button type="button" key={choice.mode} className="website-popup-collection-format"
      disabled={!enabled || !controller} onClick={() => activate(index)}><choice.icon aria-hidden="true"/><span>{choice.title}</span></button>)}
  </div>;
  return <div className="website-popup-results website-popup-custom-scrollbar" role="listbox" aria-label="Screenshot capture mode">
    <div className="website-popup-section__heading">Screenshot</div>
    {modes.map((choice, index) => <WebsitePopupResultRow key={choice.mode} index={index}
      row={{ id: choice.mode, title: choice.title, detail: choice.detail, icon: <choice.icon/>,
        selected: selected === index, disabled: !enabled || !controller }}
      onSelectionRequest={index => dispatch({ type: 'SELECTION_SET', index })} onActivationRequest={activate}/>)}
  </div>;
}

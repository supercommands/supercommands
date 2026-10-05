/** Draft-only Hotkey column; the parent owns the shared Save and Cancel actions. */
import { useCallback, useId, useRef, type RefObject } from 'react';
import { BsKeyboard } from 'react-icons/bs';
import { WebsitePopupHotkeyCapture } from '../create/WebsitePopupHotkeyCapture';
import type { useWebsitePopupItemHotkey } from './useWebsitePopupItemHotkey';

export function WebsitePopupItemHotkeySection({ controller, disabled, saveRef, cancelRef }: {
    controller: ReturnType<typeof useWebsitePopupItemHotkey>;
    disabled: boolean;
    saveRef: RefObject<HTMLButtonElement | null>;
    cancelRef: RefObject<HTMLButtonElement | null>;
}) {
    const errorId = useId();
    const focusGeneration = useRef(0);
    const { stopCapture, validateDraft } = controller;
    const finishCapture = useCallback((reverse: boolean, reason: 'keyboard' | 'blur' | 'visibility' = 'keyboard') => {
        const generation = ++focusGeneration.current;
        stopCapture();
        void validateDraft().then(() => {
            if (reason === 'keyboard') requestAnimationFrame(() => {
                if (focusGeneration.current === generation)
                    (reverse ? cancelRef : saveRef).current?.focus({ preventScroll: true });
            });
        });
    }, [stopCapture, validateDraft, cancelRef, saveRef]);
    const { startCapture, cancel } = controller;
    const startRecording = useCallback(() => { focusGeneration.current++; startCapture(); }, [startCapture]);
    const cancelRecording = useCallback(() => { focusGeneration.current++; cancel(); }, [cancel]);
    const busy = disabled || controller.pending;
    return <section className="website-popup-text-command-editor__hotkey" aria-label="Hotkey assignment">
      <div className="website-popup-text-command-editor__field-label">
        <span><BsKeyboard aria-hidden="true"/>Hotkey</span>
      </div>
      <div className="website-popup-text-command-editor__body">
        <WebsitePopupHotkeyCapture active={controller.captureActive} disabled={busy || controller.saved === null}
          invalid={Boolean(controller.error)} errorId={controller.error ? errorId : undefined}
          value={controller.draft} onChange={controller.changeDraft}
          onCaptureStateChange={controller.onCaptureStateChange}
          onCommit={finishCapture} onCancel={cancelRecording} onRemove={cancelRecording}
          onReRecord={startRecording} onNavigateBack={cancelRecording} removable={false}/>
      </div>
      <div className="website-popup-text-command-editor__field-footer">
        {controller.draft ? <button type="button" aria-label="Clear hotkey" disabled={busy || controller.captureActive}
          onClick={() => controller.changeDraft('')}>Clear</button> : null}
        <div className="website-popup-text-command-editor__status" role="status" aria-live="polite">
          {controller.loading ? 'Loading Hotkey…' : controller.pending ? 'Checking Hotkey…' : controller.checking ? 'Checking Hotkey…' : null}
        </div>
      </div>
      {controller.error ? <div id={errorId} className="website-popup-text-command-editor__error" role="alert">{controller.error}</div> : null}
      {controller.saved === null && controller.error ? <button type="button" disabled={busy}
        onClick={() => void controller.refresh()}>Retry Hotkey</button> : null}
    </section>;
}

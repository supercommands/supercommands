/** Shared popup Shadow-DOM-safe recorder for Create and existing-item Hotkey drafts. */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FiX } from 'react-icons/fi';
import { useKeystrokeRecording } from '../../../../shared-components/hotkeys/hooks/useKeystrokeRecording';
import { startWebsitePopupHotkeyCapture, stopWebsitePopupHotkeyCapture, } from '../bridge/websitePopupHotkeyBridge';
export type WebsitePopupHotkeyCaptureProps = {
    active: boolean;
    disabled?: boolean;
    invalid?: boolean;
    errorId?: string;
    value: string;
    onChange: (value: string) => void;
    onCaptureStateChange: (capture: {
        status: 'idle' | 'arming' | 'recording';
        token: string | null;
        error: string | null;
    }) => void;
    onCommit: (reverse: boolean, reason?: 'keyboard' | 'blur' | 'visibility') => void;
    onCancel: (previousValue: string) => void;
    onRemove: () => void;
    onReRecord: () => void;
    onNavigateBack: () => void;
    onEscape?: () => void;
    onFocus?: () => void;
    removable?: boolean;
};
const createCaptureToken = () => globalThis.crypto?.randomUUID?.()
    || `website-hotkey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const CAPTURE_REFRESH_MS = 20000;
export function WebsitePopupHotkeyCapture({ active, disabled = false, invalid = false, errorId, value, onChange, onCaptureStateChange, onCommit, onCancel, onRemove, onReRecord, onNavigateBack, onEscape, onFocus, removable = true, }: WebsitePopupHotkeyCaptureProps) {
    const [input, setInput] = useState<HTMLInputElement | null>(null);
    const [root, setRoot] = useState<HTMLSpanElement | null>(null);
    const [arming, setArming] = useState(true);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [token, setToken] = useState(createCaptureToken);
    const isMac = typeof navigator !== 'undefined'
        && /Mac|iPhone|iPad|iPod/i.test(`${navigator.platform} ${navigator.userAgent}`);
    const { hotkey, setHotkey, captureHotkey } = useKeystrokeRecording(value, isMac);
    const armedRef = useRef(false);
    const releaseCaptureRef = useRef<(() => void) | null>(null);
    // Parent navigation callbacks may change identity while typing; ownership must not rearm.
    const callbacksRef = useRef({ onCaptureStateChange, onCommit, onCancel });
    callbacksRef.current = { onCaptureStateChange, onCommit, onCancel };
    const latestValueRef = useRef(value);
    const initialValueRef = useRef(value);
    const wasActiveRef = useRef(false);
    useEffect(() => {
        latestValueRef.current = value;
        setHotkey(value);
    }, [setHotkey, value]);
    useEffect(() => {
        if (!active || disabled) {
            if (wasActiveRef.current) {
                const previousToken = token;
                queueMicrotask(() => {
                    const currentToken = (window as Window & {
                        __cmdosKeystrokeRecordingActive?: string | boolean;
                    })
                        .__cmdosKeystrokeRecordingActive;
                    if (!currentToken || currentToken === previousToken) {
                        callbacksRef.current.onCaptureStateChange({ status: 'idle', token: null, error: null });
                    }
                });
            }
            wasActiveRef.current = false;
            return;
        }
        wasActiveRef.current = true;
        if (!root || !input)
            return;
        let cancelled = false;
        initialValueRef.current = value;
        setCaptureError(null);
        setArming(true);
        const windowState = window as Window & {
            __cmdosKeystrokeRecordingActive?: string | boolean;
        };
        windowState.__cmdosKeystrokeRecordingActive = token;
        root?.setAttribute('data-hotkey-capture-active', 'true');
        callbacksRef.current.onCaptureStateChange({ status: 'arming', token, error: null });
        let refreshTimer: number | null = null;
        const stopBackground = () => { void stopWebsitePopupHotkeyCapture(token).catch(() => undefined); };
        const release = () => {
            if (cancelled) return;
            cancelled = true;
            armedRef.current = false;
            if (refreshTimer !== null) window.clearInterval(refreshTimer);
            root.removeAttribute('data-hotkey-capture-active');
            if (windowState.__cmdosKeystrokeRecordingActive === token)
                windowState.__cmdosKeystrokeRecordingActive = false;
            if (releaseCaptureRef.current === release) releaseCaptureRef.current = null;
            // Stop now, including while start/renewal acknowledgements are in flight.
            stopBackground();
        };
        releaseCaptureRef.current = release;
        const failCapture = (error: unknown) => {
            if (cancelled) return;
            const message = error instanceof Error ? error.message : String(error);
            release();
            setArming(false);
            setCaptureError(message);
            input.blur();
            callbacksRef.current.onCaptureStateChange({ status: 'idle', token: null, error: message });
        };
        void startWebsitePopupHotkeyCapture(token).then(() => {
            if (cancelled) { stopBackground(); return; }
            armedRef.current = true;
            setArming(false);
            callbacksRef.current.onCaptureStateChange({ status: 'recording', token, error: null });
            refreshTimer = window.setInterval(() => {
                void startWebsitePopupHotkeyCapture(token).then(() => {
                    // A renewal completing after release must not revive the old lease.
                    if (cancelled) stopBackground();
                }).catch(failCapture);
            }, CAPTURE_REFRESH_MS);
            requestAnimationFrame(() => {
                if (!cancelled) input.focus({ preventScroll: true });
            });
        }).catch(failCapture);
        return release;
    }, [active, disabled, input, root, token]);
    const retryCapture = () => setToken(createCaptureToken());
    const stopAndRun = useCallback((callback: () => void) => {
        releaseCaptureRef.current?.();
        callbacksRef.current.onCaptureStateChange({ status: 'idle', token: null, error: null });
        callback();
    }, []);
    useEffect(() => {
        if (!active || disabled)
            return;
        const release = (reason: 'blur' | 'visibility') => {
            if (!releaseCaptureRef.current) return;
            const wasArmed = armedRef.current;
            stopAndRun(() => wasArmed && latestValueRef.current
                ? callbacksRef.current.onCommit(false, reason)
                : callbacksRef.current.onCancel(initialValueRef.current));
        };
        const onWindowBlur = () => release('blur');
        const onVisibilityChange = () => {
            if (document.hidden)
                release('visibility');
        };
        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('blur', onWindowBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [active, disabled, stopAndRun]);
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (captureError && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            retryCapture();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            stopAndRun(() => onCancel(initialValueRef.current));
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            if (event.shiftKey && latestValueRef.current)
                stopAndRun(() => onCommit(true));
            else if (event.shiftKey)
                stopAndRun(() => initialValueRef.current
                    ? onCancel(initialValueRef.current) : removable ? onRemove() : onCancel(''));
            else if (latestValueRef.current)
                stopAndRun(() => onCommit(false));
            else
                stopAndRun(removable ? onRemove : () => onCancel(''));
            return;
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            if (!latestValueRef.current) {
                stopAndRun(() => onCancel(initialValueRef.current));
                return;
            }
            setHotkey('');
            latestValueRef.current = '';
            onChange('');
            return;
        }
        if (!armedRef.current)
            return;
        const next = captureHotkey(event);
        if (next && next !== 'CANCEL') {
            latestValueRef.current = next;
            onChange(next);
        }
    };
    if (!active || disabled) {
        return (<span className="website-popup-create-option-placeholder website-popup-create-option-placeholder--input website-popup-hotkey-capture">
        <button type="button" className="website-popup-create-option-control website-popup-hotkey-capture__summary" data-has-value={value ? 'true' : 'false'} aria-label={value ? `Hotkey ${value}. Record another` : 'Capture Hotkey'} aria-invalid={invalid || undefined} aria-describedby={errorId} disabled={disabled} onFocus={onFocus} onKeyDown={event => {
                if (event.key === 'Escape' && onEscape) {
                    event.preventDefault();
                    event.stopPropagation();
                    onEscape?.();
                    return;
                }
                if (event.key !== 'Backspace' && event.key !== 'Delete')
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (value)
                    onChange('');
                else if (event.key === 'Backspace')
                    onNavigateBack();
            }} onClick={() => {
                setToken(createCaptureToken());
                onReRecord();
            }}>
          {value || 'Capture Hotkey'}
        </button>
        {removable ? <button type="button" aria-label="Remove Hotkey option" title="Remove Hotkey option" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onRemove}>
          <FiX aria-hidden="true"/>
        </button> : null}
      </span>);
    }
    return (<span ref={setRoot} className="website-popup-create-option-placeholder website-popup-create-option-placeholder--input website-popup-hotkey-capture" data-hotkey-capture role="group" aria-label="Hotkey capture" onKeyDown={event => {
            if (!arming && !captureError)
                return;
            if (event.key !== 'Escape' && event.key !== 'Tab' && event.key !== 'Backspace')
                return;
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            stopAndRun(event.key === 'Tab' && !initialValueRef.current && removable
                ? onRemove : () => onCancel(initialValueRef.current));
        }} onBlur={event => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
                return;
            if (event.relatedTarget instanceof Element
                && event.relatedTarget.closest('.website-popup-hotkey-capture')) {
                if (releaseCaptureRef.current)
                    stopAndRun(() => onCancel(initialValueRef.current));
                return;
            }
            if (releaseCaptureRef.current) {
                const wasArmed = armedRef.current;
                stopAndRun(() => wasArmed && latestValueRef.current
                    ? onCommit(false, 'blur')
                    : onCancel(initialValueRef.current));
            }
        }}>
      <input ref={setInput} type="text" data-is-hotkey-input="true" value={hotkey} readOnly disabled={arming} aria-invalid={invalid || Boolean(captureError) || undefined} aria-describedby={errorId} aria-label={captureError ? `${captureError}. Press Enter to retry Hotkey capture` : 'Press a Hotkey'} placeholder={arming ? 'Preparing Hotkey capture…' : captureError || 'Press shortcut'} title={captureError} autoComplete="off" spellCheck={false} onKeyDown={handleKeyDown} onClick={captureError ? retryCapture : undefined} className="website-popup-create-composer__input website-popup-hotkey-capture__input" onFocus={onFocus}/>
      {removable ? <button type="button" aria-label="Remove Hotkey option" title="Remove Hotkey option" onMouseDown={event => event.preventDefault()} onClick={() => stopAndRun(onRemove)}>
        <FiX aria-hidden="true"/>
      </button> : null}
    </span>);
}

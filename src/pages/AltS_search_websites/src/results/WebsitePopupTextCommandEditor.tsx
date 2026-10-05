/** One Shadow-DOM right-side editor for item Text Commands and configured prefixes. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import { validateWebsitePopupTextCommand } from '../bridge/websitePopupTextCommandBridge';
import { validateWebsitePopupHotkey } from '../bridge/websitePopupHotkeyBridge';
import { updateWebsitePopupPrefixSetting } from '../bridge/websitePopupPrefixSettingsBridge';
import { useWebsitePopupItemHotkey } from './useWebsitePopupItemHotkey';
import { WebsitePopupItemHotkeySection } from './WebsitePopupItemHotkeySection';
import type { WebsitePopupTextCommandCheck, WebsitePopupTextCommandConflict } from '../../../../shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
import type { WebsitePopupPrefixEditTarget, WebsitePopupTextCommandEditTarget } from '../display/websitePopupDisplayTypes';
export type WebsitePopupTextCommandEditorProps = {
    target: WebsitePopupTextCommandEditTarget | WebsitePopupPrefixEditTarget;
    anchor: DOMRect;
    shadowRoot: ShadowRoot;
    onClose: (restoreFocus: boolean) => void;
};
export function WebsitePopupTextCommandEditor({ target, anchor, shadowRoot, onClose, }: WebsitePopupTextCommandEditorProps) {
    return 'type' in target
        ? <WebsitePopupAssignmentEditor target={target} anchor={anchor} shadowRoot={shadowRoot} onClose={onClose}/>
        : <WebsitePopupItemAssignmentEditor target={target} anchor={anchor} shadowRoot={shadowRoot} onClose={onClose}/>;
}
function WebsitePopupItemAssignmentEditor(props: WebsitePopupTextCommandEditorProps & { target: WebsitePopupTextCommandEditTarget }) {
    const hotkey = useWebsitePopupItemHotkey({ entity: props.target.entity, targetId: props.target.targetId });
    return <WebsitePopupAssignmentEditor {...props} hotkey={hotkey}/>;
}
function WebsitePopupAssignmentEditor({ target, anchor, shadowRoot, onClose, hotkey }: WebsitePopupTextCommandEditorProps & {
    hotkey?: ReturnType<typeof useWebsitePopupItemHotkey>;
}) {
    const [value, setValue] = useState(target.value);
    const [savedValue, setSavedValue] = useState(target.value);
    const [savedReferenceId, setSavedReferenceId] = useState('type' in target ? undefined : target.referenceId);
    const [check, setCheck] = useState<{
        draft: string;
        result: WebsitePopupTextCommandCheck;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [shareConflict, setShareConflict] = useState(false);
    const [position, setPosition] = useState<{
        left: number;
        top: number;
        pointerTop: number;
        side: 'left' | 'right' | 'overlay';
    } | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const overwriteButtonRef = useRef<HTMLButtonElement | null>(null);
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
    const pendingRef = useRef(false);
    const mountedRef = useRef(false);
    const valueRef = useRef(value);
    const layer = shadowRoot.querySelector<HTMLElement>('.website-popup-layer');
    const isPrefix = 'type' in target;
    const prefixType = isPrefix ? target.type : undefined;
    const prefixCategory = isPrefix ? target.category : undefined;
    const referenceId = savedReferenceId;
    const blocked = saving || Boolean(hotkey?.pending || hotkey?.captureActive);
    const inputBlocked = saving || Boolean(hotkey?.captureActive);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);
    useLayoutEffect(() => {
        if (!layer || !panelRef.current)
            return;
        const panel = panelRef.current;
        let initialPlacement = true;
        const measure = () => {
        const style = window.getComputedStyle(layer);
        const inset = Number.parseFloat(style.getPropertyValue('--website-popup-viewport-inset')) || 0;
        const gap = Number.parseFloat(style.getPropertyValue('--website-popup-navigation-gap')) || 0;
        const pointerInset = Number.parseFloat(style.getPropertyValue('--website-popup-navigation-icon-size')) || gap;
        const preferredRight = anchor.right + gap;
        const preferredLeft = anchor.left - panel.offsetWidth - gap;
        const fitsRight = preferredRight + panel.offsetWidth <= window.innerWidth - inset;
        const fitsLeft = preferredLeft >= inset;
        const side = fitsRight ? 'right' : fitsLeft ? 'left' : 'overlay';
        const left = fitsRight ? preferredRight : fitsLeft ? preferredLeft
            : Math.max(inset, Math.min(preferredRight, window.innerWidth - inset - panel.offsetWidth));
        const anchorCenter = anchor.top + anchor.height / 2;
        const placeInitially = initialPlacement;
        initialPlacement = false;
        setPosition(previous => {
            // Keep the input anchored when validation changes the panel's height.
            const preferredTop = placeInitially || !previous ? anchorCenter - panel.offsetHeight / 2 : previous.top;
            const top = Math.max(inset, Math.min(preferredTop, window.innerHeight - inset - panel.offsetHeight));
            const pointerTop = Math.max(pointerInset, Math.min(anchorCenter - top, panel.offsetHeight - pointerInset));
            if (previous && previous.left === left && previous.top === top && previous.pointerTop === pointerTop && previous.side === side)
                return previous;
            return { left, top, pointerTop, side };
        });
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(panel);
        return () => observer?.disconnect();
    }, [anchor, layer]);
    useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
    }, []);
    useEffect(() => {
        if (saving || !value.trim() || (!isPrefix && value === savedValue)) {
            setCheck(null);
            return;
        }
        let current = true;
        const timer = window.setTimeout(() => {
            void validateWebsitePopupTextCommand(value, referenceId, prefixType && prefixCategory ? { type: prefixType, category: prefixCategory } : undefined)
                .then(result => {
                if (current && valueRef.current === value)
                    setCheck({ draft: value, result });
            })
                .catch(failure => {
                if (current && valueRef.current === value)
                    setCheck({
                        draft: value,
                        result: { status: 'error', value,
                            message: failure instanceof Error ? failure.message : String(failure) },
                    });
            });
        }, 300);
        return () => { current = false; window.clearTimeout(timer); };
    }, [isPrefix, referenceId, value, savedValue, saving, prefixType, prefixCategory]);
    useEffect(() => {
        if (!layer)
            return;
        const onOutside = (event: MouseEvent) => {
            if (pendingRef.current) return;
            if (!event.composedPath().includes(panelRef.current as EventTarget))
                onClose(false);
        };
        const onScroll = () => { if (!pendingRef.current) onClose(false); };
        const onResize = () => { if (!pendingRef.current) onClose(false); };
        document.addEventListener('mousedown', onOutside, true);
        layer.querySelector('.website-popup-results')?.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('mousedown', onOutside, true);
            layer.querySelector('.website-popup-results')?.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [layer, onClose]);
    const save = useCallback(async (nextValue: string, approval?: WebsitePopupTextCommandConflict) => {
        if (pendingRef.current || hotkey?.pending || hotkey?.captureActive)
            return;
        if (isPrefix && !nextValue.trim()) {
            setError('Enter a prefix before saving.');
            return;
        }
        if (isPrefix && nextValue.trim().toLowerCase() === target.value) {
            onClose(true);
            return;
        }
        pendingRef.current = true;
        setSaving(true);
        setError(null);
        let textSaved = false;
        try {
            const textChanged = nextValue !== savedValue;
            const hotkeyChanged = hotkey && hotkey.saved !== null && hotkey.draft !== hotkey.saved;
            // Check both drafts before either write. The bridge rechecks ownership on save.
            if (textChanged && nextValue.trim()) {
                const result = await validateWebsitePopupTextCommand(nextValue, referenceId,
                    prefixType && prefixCategory ? { type: prefixType, category: prefixCategory } : undefined);
                if (!mountedRef.current) return;
                setCheck({ draft: nextValue, result });
                if (result.status === 'error' || (result.status === 'conflict' && !approval)) return;
            }
            if (hotkeyChanged && hotkey.draft.trim() && !('type' in target)) {
                const result = await validateWebsitePopupHotkey(hotkey.draft, target.targetId);
                if (!mountedRef.current) return;
                if (result.status === 'error' || (result.status === 'conflict' && !hotkey.conflict)) {
                    await hotkey.validateDraft();
                    return;
                }
            }
            if ('type' in target) {
                await updateWebsitePopupPrefixSetting({
                    type: target.type, category: target.category,
                    value: nextValue.trim().toLowerCase(), expectedValue: target.value, approval,
                });
            }
            else if (textChanged) {
                const outcome = await executeWebsitePopupBridgeOperation({
                    kind: 'update-item-text-command', entity: target.entity,
                    targetId: target.targetId, value: nextValue, approval,
                    expectedValue: savedValue, expectedReferenceId: savedReferenceId ?? target.referenceId,
                });
                if (outcome.status !== 'text-command-updated')
                    throw new Error('Unable to update the Text Command.');
                if (!mountedRef.current) return;
                valueRef.current = outcome.value.replace(/^\/+/, '');
                setValue(valueRef.current);
                setSavedValue(valueRef.current);
                setSavedReferenceId(outcome.referenceId || savedReferenceId);
                setCheck(null);
                textSaved = true;
            }
            if (hotkeyChanged) {
                const success = hotkey.conflict
                    ? await hotkey.persist(hotkey.draft, hotkey.conflict)
                    : await hotkey.commit();
                if (!success) {
                    if (mountedRef.current && textSaved)
                        setError('Text command saved. Hotkey was not saved; review it and save again.');
                    return;
                }
            }
            if (mountedRef.current) onClose(true);
        }
        catch (failure: unknown) {
            if (!mountedRef.current) return;
            setError(failure instanceof Error ? failure.message : String(failure));
            if (nextValue) {
                void validateWebsitePopupTextCommand(nextValue, referenceId, 'type' in target ? { type: target.type, category: target.category } : undefined)
                    .then(result => {
                    if (mountedRef.current && valueRef.current === nextValue)
                        setCheck({ draft: nextValue, result });
                }).catch(() => undefined);
            }
        }
        finally {
            pendingRef.current = false;
            if (mountedRef.current) setSaving(false);
        }
    }, [isPrefix, onClose, target, savedValue, savedReferenceId, hotkey, referenceId, prefixType, prefixCategory]);
    if (!layer)
        return null;
    const currentCheck = check?.draft === value ? check.result : null;
    const conflict = currentCheck?.status === 'conflict' ? currentCheck.conflict : null;
    const validationError = currentCheck?.status === 'error' ? currentCheck.message : null;
    const shownError = error || validationError || (currentCheck?.status === 'conflict' ? currentCheck.message : null);
    const checking = Boolean(!saving && value.trim() && (isPrefix || value !== savedValue) && !currentCheck && !error);
    const textChanged = value !== savedValue;
    const hotkeyChanged = Boolean(hotkey && hotkey.saved !== null && hotkey.draft !== hotkey.saved);
    const saveDisabled = blocked || Boolean(hotkey?.checking) || (!textChanged && !hotkeyChanged)
        || (isPrefix && !value.trim()) || Boolean(validationError)
        || (textChanged && Boolean(value.trim()) && !currentCheck);
    return createPortal(<div ref={panelRef} className="website-popup-text-command-editor" data-combined={Boolean(hotkey)} data-side={position?.side} role="dialog" aria-label={isPrefix ? `Edit prefix for ${target.title}` : `Edit shortcuts for ${target.title}`} style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }} onKeyDown={event => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            event.stopPropagation();
            if (!pendingRef.current) onClose(true);
        }} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      {position && position.side !== 'overlay' ? <span className="website-popup-text-command-editor__pointer" aria-hidden="true" style={{ top: position.pointerTop }}/> : null}
      <div className="website-popup-text-command-editor__content">
        <div className="website-popup-text-command-editor__header">
          <span>{isPrefix ? `Edit ${target.title} Prefix` : 'Assign a shortcut'}</span>
        </div>
        <div className="website-popup-text-command-editor__columns">
        <section className="website-popup-text-command-editor__text" aria-label="Text command assignment">
        {!isPrefix ? <div className="website-popup-text-command-editor__field-label">
          <span><span aria-hidden="true">c_</span>Text command</span>
        </div> : null}
        <div className="website-popup-text-command-editor__body">
          <input ref={inputRef} value={value} disabled={inputBlocked} aria-label={isPrefix ? `${target.title} prefix` : 'Text Command'} aria-invalid={Boolean(shownError)} aria-describedby={shownError ? 'website-popup-text-command-editor-error' : undefined} placeholder={isPrefix ? 'prefix' : 'shortcut'} autoComplete="off" spellCheck={false} onChange={event => {
            const nextValue = event.currentTarget.value;
            valueRef.current = nextValue;
            setValue(nextValue);
            setCheck(null);
            setError(null);
            setShareConflict(false);
        }} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!pendingRef.current) onClose(true);
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (conflict || hotkey?.conflict)
                    overwriteButtonRef.current?.focus({ preventScroll: true });
                else if (!saveDisabled)
                    void save(value);
            }
        }}/>
        </div>
        <div className="website-popup-text-command-editor__field-footer">
          {!isPrefix && value ? <button type="button" aria-label="Clear text command" disabled={blocked} onClick={() => {
              valueRef.current = ''; setValue(''); setCheck(null); setError(null);
          }}>Clear</button> : null}
          <div className="website-popup-text-command-editor__status" role="status" aria-live="polite">
            {saving ? 'Saving…' : checking ? 'Checking Text Command…' : null}
          </div>
        </div>
        {shownError ? <div id="website-popup-text-command-editor-error" className="website-popup-text-command-editor__error" role="alert">
          {currentCheck?.status === 'conflict' && !error ? (<>
              <span className="website-popup-text-command-editor__error-label">Conflict:</span>
              <span className="website-popup-text-command-editor__error-emphasis">"{currentCheck.value}"</span>
              <span>is already assigned to</span>
              <span className="website-popup-text-command-editor__error-emphasis">{(currentCheck.conflict.owners || [currentCheck.conflict]).map(owner => `"${owner.label}"`).join(', ')}.</span>
              {!currentCheck.conflict.canShare ? <span>Overwrite releases this trigger from its current action or category.</span> : null}
            </>) : shownError}
        </div> : null}
        {!isPrefix && conflict?.canShare ? <label className="website-popup-text-command-editor__field-label">
          <input type="checkbox" checked={shareConflict} disabled={blocked} onChange={event => setShareConflict(event.currentTarget.checked)}/>
          Assign to this item too
        </label> : null}
        </section>
        {hotkey ? <WebsitePopupItemHotkeySection controller={hotkey} disabled={saving} saveRef={overwriteButtonRef} cancelRef={cancelButtonRef}/> : null}
        </div>
        <div className="website-popup-text-command-editor__actions">
          <button ref={cancelButtonRef} type="button" disabled={saving} onClick={() => onClose(true)}>Cancel</button>
          <button ref={overwriteButtonRef} type="button" disabled={saveDisabled} onClick={() => void save(value, conflict ? { ...conflict, ...(shareConflict ? { mode: 'add' as const } : {}) } : undefined)}>
              {saving ? 'Saving…' : (conflict && !shareConflict) || hotkey?.conflict ? 'Overwrite & save' : 'Save'}
          </button>
        </div>
      </div>
    </div>, layer);
}


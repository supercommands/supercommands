import { buildWebsitePopupCreateSubmission, applyWebsitePopupCreateOutcome } from './websitePopupCreateSubmission';
/**
 * popup Shadow-DOM Create footer.
 *
 * It owns Save/Create Another presentation and invokes the typed popup execution
 * bridge. It never imports legacy popup UI or persistence callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { useStore } from 'zustand';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import { resolveWebsitePopupCreateSaveAction, resolveWebsitePopupCreateSaveKeyboardIntent, } from '../interaction/websitePopupKeyboardIntentResolver';
import { isHotkeyRecordingActive } from '../../../../shared-components/hotkeys/core/hotkeyCapture';
import { getIncompleteWebsitePopupCreateField } from './websitePopupCreateFieldPolicy';
import { serializeWebsitePopupAgentModels } from '../../../../shared-components/websitePopup/websitePopupModelSelection';
export type WebsitePopupCreateFooterProps = {
    store: WebsitePopupInteractionStoreApi;
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    keyboardTarget?: ShadowRoot | null;
    sidePanelOpen?: boolean;
    onToggleSidePanel?: () => void;
    saveButtonTarget?: HTMLElement | null;
    onRequestClose: () => void;
    open?: boolean;
};
const getPlatformSaveKey = () => typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';
export function WebsitePopupCreateFooter({ store, createGrammar, keyboardTarget = null, sidePanelOpen = false, onToggleSidePanel, saveButtonTarget = null, onRequestClose, open = true, }: WebsitePopupCreateFooterProps) {
    const state = useStore(store, current => current.state);
    const dispatch = useStore(store, current => current.dispatch);
    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);
    const shortcutHelpRef = useRef<HTMLSpanElement | null>(null);
    const hideShortcutHelp = () => {
        const help = shortcutHelpRef.current;
        if (help?.matches(':popover-open')) help.hidePopover();
    };
    const showShortcutHelp = (anchor: HTMLElement) => {
        const help = shortcutHelpRef.current;
        if (!help || !open || standalone || typeof help.showPopover !== 'function') return;
        const rect = anchor.getBoundingClientRect();
        const inset = getComputedStyle(anchor).getPropertyValue('--website-popup-viewport-inset');
        help.style.right = `max(${inset}, ${window.innerWidth - rect.right}px)`;
        help.style.bottom = `calc(${window.innerHeight - rect.top}px + var(--website-popup-results-padding-y))`;
        if (!help.matches(':popover-open')) help.showPopover();
    };
    useEffect(() => {
        const hide = () => hideShortcutHelp();
        window.addEventListener('resize', hide);
        window.addEventListener('scroll', hide, true);
        return () => {
            hide();
            window.removeEventListener('resize', hide);
            window.removeEventListener('scroll', hide, true);
        };
    }, []);
    useEffect(() => { if (!open) hideShortcutHelp(); }, [open]);
    const aliveRef = useRef(true);
    const openRef = useRef(open);
    openRef.current = open;
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);
    const [error, setError] = useState<string | null>(null);
    const route = state.route.kind === 'create' ? state.route : null;
    const standalone = route?.presentation === 'standalone';
    const session = state.createSession;
    const entity = route?.entity || '';
    const grammar = createGrammar.find(candidate => candidate.entity === entity);
    const textCommandFieldId = grammar?.fields.find(field => field.source === 'shortcut')?.field;
    const hotkeyFieldId = grammar?.fields.find(field => field.source === 'hotkey')?.field;
    const favoriteFieldId = grammar?.fields.find(field => field.source === 'favorite')?.field;
    const textCommandValue = textCommandFieldId ? session?.fieldValues[textCommandFieldId] || '' : '';
    const hotkeyValue = hotkeyFieldId ? session?.fieldValues[hotkeyFieldId] || '' : '';
    const incompleteField = getIncompleteWebsitePopupCreateField(grammar ?? null, session);
    const missingRequiredField = incompleteField?.required ? incompleteField : null;
    const incompleteOption = incompleteField && !incompleteField.required ? incompleteField : null;
    const hasTextCommand = Boolean(textCommandFieldId
        && session?.committedOptionalFieldOrder.includes(textCommandFieldId) && textCommandValue.trim());
    const hasHotkeyOption = Boolean(hotkeyFieldId
        && session?.committedOptionalFieldOrder.includes(hotkeyFieldId));
    const hasHotkey = Boolean(hasHotkeyOption && hotkeyValue.trim());
    const favoriteEnabled = Boolean(favoriteFieldId
        && session?.committedOptionalFieldOrder.includes(favoriteFieldId)
        && session.fieldValues[favoriteFieldId] === 'enabled');
    const validation = session?.textCommandValidation;
    const hotkeyValidation = session?.hotkeyValidation;
    const needsTextOverwrite = !session?.favoritePartial && hasTextCommand && validation?.status === 'conflict';
    const needsHotkeyOverwrite = !session?.favoritePartial && !needsTextOverwrite
        && hasHotkey && hotkeyValidation?.status === 'conflict';
    const needsOverwrite = needsTextOverwrite || needsHotkeyOverwrite;
    const textCommandBlocked = hasTextCommand
        && validation?.status !== 'available'
        && validation?.status !== 'approved';
    const hotkeyBlocked = hasHotkey && hotkeyValidation?.status !== 'available'
        && hotkeyValidation?.status !== 'approved';
    const hotkeyIncomplete = hasHotkeyOption && !hasHotkey;
    const captureActive = Boolean(hotkeyFieldId && session?.childMode === hotkeyFieldId)
        || Boolean(session && session.hotkeyCapture.status !== 'idle');
    const overwriteBlocked = pending || Boolean(!session?.todoFollowupPartial && !session?.textCommandPartial
        && !session?.hotkeyPartial && incompleteField) || captureActive || !grammar;
    const saveBlocked = session?.favoritePartial
        ? false
        : session?.todoFollowupPartial
            ? Boolean(textCommandBlocked || hotkeyBlocked || hotkeyIncomplete || captureActive)
            : session?.textCommandPartial
                ? !hasTextCommand || Boolean(textCommandBlocked || hotkeyBlocked || hotkeyIncomplete || captureActive)
                : session?.hotkeyPartial
                    ? !hasHotkey || Boolean(hotkeyBlocked || captureActive)
                    : Boolean(incompleteField || textCommandBlocked
                        || hotkeyBlocked || hotkeyIncomplete || captureActive);
    const saveAction = resolveWebsitePopupCreateSaveAction({
        textCommandConflict: Boolean(needsTextOverwrite),
        hotkeyConflict: Boolean(needsHotkeyOverwrite),
        overwriteBlocked: Boolean(overwriteBlocked),
        saveBlocked: Boolean(saveBlocked || pending || !grammar || !session),
    });
    useEffect(() => setError(null), [textCommandValue, hotkeyValue]);
    const save = useCallback(async (createAnother: boolean) => {
        // Reject a stale React closure after a partial result changes the store:
        // a rapid second click must never repeat the entity-creation operation.
        if (pendingRef.current || !session || store.getState().state.createSession !== session
            || !grammar || saveBlocked)
            return;
        pendingRef.current = true;
        setPending(true);
        setError(null);
        try {
            if (entity === 'agent' && session.modelSelection && !session.favoritePartial
                && !session.textCommandPartial && !session.hotkeyPartial) {
                serializeWebsitePopupAgentModels(session.modelSelection);
            }
            const outcome = await executeWebsitePopupBridgeOperation(buildWebsitePopupCreateSubmission(session, entity, textCommandValue, hotkeyValue, favoriteEnabled, createAnother));
            // A dismissed form must not apply a late outcome or close a newer popup.
            if (!aliveRef.current || !openRef.current) return;
            const result = applyWebsitePopupCreateOutcome(outcome, session, dispatch);
            if (result.error)
                setError(result.error);
            if (result.close)
                onRequestClose();
        }
        catch (saveError: unknown) {
            if (aliveRef.current && openRef.current)
                setError(saveError instanceof Error ? saveError.message : String(saveError));
        }
        finally {
            pendingRef.current = false;
            if (aliveRef.current) setPending(false);
        }
    }, [dispatch, entity, favoriteEnabled, grammar, hotkeyValidation, hotkeyValue, onRequestClose,
        saveBlocked, session, store, textCommandValue, validation]);
    const approveNextOverwrite = useCallback(() => {
        if (saveAction !== 'approve-text-command' && saveAction !== 'approve-hotkey')
            return false;
        if (pendingRef.current)
            return false;
        dispatch({ type: saveAction === 'approve-text-command'
                ? 'CREATE_TEXT_COMMAND_OVERWRITE_APPROVED'
                : 'CREATE_HOTKEY_OVERWRITE_APPROVED' });
        return true;
    }, [dispatch, saveAction]);
    useEffect(() => {
        if (!keyboardTarget)
            return;
        const onKeyDown = (event: Event) => {
            if (!(event instanceof KeyboardEvent))
                return;
            if (isHotkeyRecordingActive(event))
                return;
            const intent = resolveWebsitePopupCreateSaveKeyboardIntent({
                key: event.key,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
            });
            if (intent === 'pass-through')
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (saveAction === 'approve-text-command' || saveAction === 'approve-hotkey') {
                approveNextOverwrite();
                return;
            }
            if (saveAction !== 'save' || pendingRef.current || !grammar || !session)
                return;
            void save(intent === 'save-and-create-another');
        };
        keyboardTarget.addEventListener('keydown', onKeyDown, true);
        return () => keyboardTarget.removeEventListener('keydown', onKeyDown, true);
    }, [approveNextOverwrite, grammar, keyboardTarget, save, saveAction, session]);
    const disabled = pending || saveBlocked || !grammar || !session;
    const tooltipMessage = missingRequiredField
        ? missingRequiredField.kind === 'multiSelect'
            ? `Add at least one ${missingRequiredField.label} before saving`
            : `Add a ${missingRequiredField.label} before saving`
        : incompleteOption
            ? `Choose or remove ${incompleteOption.label} before saving`
            : needsOverwrite ? 'Approve overwrite, then press again to save'
                : 'Save; add Shift to save and create another';
    const platformKey = getPlatformSaveKey();
    const textCommandStatus = hasTextCommand
        ? validation?.status === 'checking' ? 'Checking Text Command…'
            : validation?.status === 'available' ? 'Text Command available'
                : validation?.status === 'approved' ? validation.message
                    : validation?.status === 'conflict' || validation?.status === 'error' ? validation.message
                        : null
        : null;
    const hotkeyStatus = session?.hotkeyCapture.error || (hasHotkey
        ? hotkeyValidation?.status === 'checking' ? 'Checking Hotkey…'
            : hotkeyValidation?.status === 'available' ? 'Hotkey available'
                : hotkeyValidation?.status === 'approved' ? hotkeyValidation.message
                    : hotkeyValidation?.status === 'conflict' || hotkeyValidation?.status === 'error'
                        ? hotkeyValidation.message : null
        : hotkeyIncomplete ? 'Capture or remove Hotkey before saving' : null);
    const shownStatus = session?.hotkeyCapture.error || (needsTextOverwrite ? textCommandStatus
        : needsHotkeyOverwrite ? hotkeyStatus
            : hotkeyBlocked || hotkeyIncomplete ? hotkeyStatus
                : textCommandBlocked ? textCommandStatus
                    : session?.activeArgumentId === hotkeyFieldId && hotkeyStatus ? hotkeyStatus
                        : textCommandStatus || hotkeyStatus);
    const shownStatusTone = session?.hotkeyCapture.error ? 'error' : shownStatus === hotkeyStatus
        ? hotkeyValidation?.status === 'available' ? 'available'
            : hotkeyValidation?.status === 'approved' ? 'available'
                : hotkeyValidation?.status === 'conflict' || hotkeyValidation?.status === 'error' || hotkeyIncomplete
                    ? 'error' : 'checking'
        : validation?.status === 'available' ? 'available'
            : validation?.status === 'approved' ? 'available'
                : validation?.status === 'conflict' || validation?.status === 'error'
                    ? 'error' : 'checking';
    const missingFieldMessage = missingRequiredField
        ? missingRequiredField.kind === 'multiSelect'
            ? `Add at least one ${missingRequiredField.label} to save`
            : `Add ${missingRequiredField.label} to save`
        : null;
    const pendingMessage = session?.favoritePartial ? 'Adding to Favorites…'
        : session?.todoFollowupPartial ? 'Finishing Todo setup…'
            : session?.textCommandPartial ? 'Assigning Text Command…'
                : session?.hotkeyPartial ? 'Assigning Hotkey…'
                    : 'Creating item and saving options…';
    const saveControls = (<span className="website-popup-create-footer__save-wrap" onMouseEnter={event => showShortcutHelp(event.currentTarget)} onMouseLeave={hideShortcutHelp} onFocus={event => {
        if ((event.target as HTMLElement).hasAttribute('data-action')) showShortcutHelp(event.currentTarget);
    }} onBlur={hideShortcutHelp}>
      {standalone && !(needsTextOverwrite && validation?.status === 'conflict') ? <button type="button" className="website-popup-create-footer__save website-popup-create-footer__cancel" onClick={onRequestClose}>Cancel</button> : null}
      {needsTextOverwrite && validation?.status === 'conflict' ? <>
        <button type="button" className="website-popup-create-footer__save website-popup-create-footer__cancel" disabled={pending && !standalone} onClick={() => standalone ? onRequestClose() : dispatch({ type: 'CREATE_FIELD_VALUE_CHANGED', field: textCommandFieldId || 'shortcut', value: '' })}>Cancel</button>
        {validation.conflict.canShare ? <button type="button" className="website-popup-create-footer__save" disabled={overwriteBlocked} onClick={() => dispatch({ type: 'CREATE_TEXT_COMMAND_OVERWRITE_APPROVED', mode: 'add' })}>Assign to this item too</button> : null}
      </> : null}
      <button type="button" className="website-popup-create-footer__save" data-action={needsOverwrite ? 'overwrite' : 'save'} disabled={saveAction === 'blocked' || disabled && !needsOverwrite} onKeyDown={event => {
            if (event.key !== 'Escape' || !sidePanelOpen)
                return;
            event.preventDefault();
            event.stopPropagation();
            onToggleSidePanel?.();
        }} onClick={() => {
            if (approveNextOverwrite())
                return;
            void save(false);
        }}>
        {pending ? 'Working…' : needsOverwrite ? 'Overwrite'
            : session?.favoritePartial ? 'Retry Favorite'
                : session?.todoFollowupPartial ? 'Retry Todo Setup'
                    : session?.textCommandPartial ? 'Retry Text Command'
                        : session?.hotkeyPartial ? 'Retry Hotkey' : 'Save'}
      </button>
      {!standalone ? <span ref={shortcutHelpRef} popover="manual" className="website-popup-create-footer__shortcut-help" role="tooltip">
        <kbd>{platformKey}</kbd>
        <span>+</span>
        <kbd>Enter</kbd>
        {!needsOverwrite ? <><span>or</span><kbd>{platformKey}</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>Enter</kbd></> : null}
        <span>{tooltipMessage}</span>
      </span> : null}
    </span>);
    const footer = (<footer className="website-popup-create-footer" aria-live="polite" data-presentation={standalone ? 'standalone' : 'inline'}>
      {pending ? <span className="website-popup-create-footer__error" role="status">{pendingMessage}</span>
            : error || session?.textCommandPartial || session?.todoFollowupPartial || session?.favoritePartial || session?.hotkeyPartial
                ? <span className="website-popup-create-footer__error" data-status="error">
            {error || session?.favoritePartial?.message || session?.todoFollowupPartial?.message
                        || session?.textCommandPartial?.message || session?.hotkeyPartial?.message}
          </span>
                : missingFieldMessage
                    ? <span className="website-popup-create-footer__error">{missingFieldMessage}</span>
                    : incompleteOption
                        ? <span className="website-popup-create-footer__error" data-status="error">
              Choose or remove {incompleteOption.label} before saving
            </span>
                        : shownStatus
                            ? <span className="website-popup-create-footer__error" data-status={shownStatusTone}>
              {shownStatus}
            </span>
                            : null}
      <span className="website-popup-create-footer__actions">
      {!standalone && session?.fieldsHydrated ? (<button type="button" className="website-popup-create-footer__expand-details" aria-label={sidePanelOpen ? 'Collapse details panel' : 'Expand details panel'} title={sidePanelOpen ? 'Collapse details panel' : 'Expand details panel'} aria-expanded={sidePanelOpen} onClick={onToggleSidePanel}>
          {sidePanelOpen ? <FiMinimize2 aria-hidden="true"/> : <FiMaximize2 aria-hidden="true"/>}
        </button>) : null}
      {!standalone && saveButtonTarget ? createPortal(saveControls, saveButtonTarget) : saveControls}
      </span>
    </footer>);
    // Status, errors, progress and actions share the visible standalone footer.
    // While its portal host mounts, keep them out of the left surface.
    return standalone ? (saveButtonTarget ? createPortal(footer, saveButtonTarget) : null) : footer;
}

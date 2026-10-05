/** Shared item hotkey drafts; capture ownership remains in WebsitePopupHotkeyCapture. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import { validateWebsitePopupHotkey } from '../bridge/websitePopupHotkeyBridge';
import type { WebsitePopupTextCommandTargetEntity } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupHotkeyCheck, WebsitePopupHotkeyConflict } from '../../../../shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';

const messageOf = (failure: unknown) => failure instanceof Error ? failure.message : String(failure);
type HotkeyState = {
    saved: string | null;
    draft: string;
    captureActive: boolean;
    pending: boolean;
    checking: boolean;
    conflict: WebsitePopupHotkeyConflict | null;
    error: string | null;
};
const initialState = (): HotkeyState => ({ saved: null, draft: '', captureActive: false, pending: false, checking: false, conflict: null, error: null });

export function useWebsitePopupItemHotkey(target: { entity: WebsitePopupTextCommandTargetEntity; targetId: string }, onSaved?: () => void) {
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const key = `${target.entity}:${target.targetId}`;
    const [state, setState] = useState(initialState);
    const stateRef = useRef(state);
    const keyRef = useRef(key);
    keyRef.current = key;
    const scopeRef = useRef<{ key: string; active: boolean; pending: boolean; revision: number; checkSequence: number; refreshRequested: boolean } | null>(null);
    const refreshRef = useRef<() => Promise<void>>(async () => {});
    const update = useCallback((patch: Partial<HotkeyState>) => {
        stateRef.current = { ...stateRef.current, ...patch };
        setState(stateRef.current);
    }, []);
    const isCurrent = useCallback((scope: NonNullable<typeof scopeRef.current>) =>
        scope.active && scopeRef.current === scope && keyRef.current === scope.key, []);

    // The synchronous ref lock covers validation and the following mutation.
    const run = useCallback(async (operation: (scope: NonNullable<typeof scopeRef.current>) => Promise<void | boolean>) => {
        const scope = scopeRef.current;
        if (!scope || !isCurrent(scope) || scope.pending || stateRef.current.saved === null) return false;
        scope.pending = true;
        const revision = scope.revision;
        update({ pending: true, error: null });
        try { return (await operation(scope)) !== false && isCurrent(scope) && scope.revision === revision; }
        catch (failure) {
            if (isCurrent(scope) && scope.revision === revision) update({ error: messageOf(failure) });
            return false;
        }
        finally {
            scope.pending = false;
            if (isCurrent(scope)) {
                update({ pending: false });
                if (scope.refreshRequested) void refreshRef.current();
            }
        }
    }, [isCurrent, update]);

    const write = useCallback(async (scope: NonNullable<typeof scopeRef.current>, value: string, approval?: WebsitePopupHotkeyConflict) => {
        if (!isCurrent(scope)) return;
        const revision = scope.revision;
        let outcome;
        try {
            outcome = await executeWebsitePopupBridgeOperation({ kind: 'set-result-hotkey', ...target, value, approval });
        } catch (failure) {
            // Refresh conflict ownership after a rejected approval, retaining the draft.
            const check = value.trim() ? await validateWebsitePopupHotkey(value, target.targetId).catch(() => null) : null;
            if (isCurrent(scope) && scope.revision === revision && check) {
                update({ conflict: check.status === 'conflict' ? check.conflict : null });
                if (check.status !== 'available') throw new Error(check.message);
            }
            throw failure;
        }
        if (!isCurrent(scope)) return;
        if (outcome.status !== 'hotkey-updated') throw new Error('Hotkey was not updated.');
        // A newer draft must survive an earlier write completing.
        update({ saved: outcome.value, ...(scope.revision === revision ? { draft: outcome.value, conflict: null } : {}) });
        if (scope.revision === revision) onSavedRef.current?.();
    }, [target.entity, target.targetId, isCurrent, update]);

    const checkDraft = useCallback(async (scope: NonNullable<typeof scopeRef.current>, allow: () => boolean = () => true): Promise<WebsitePopupHotkeyCheck | null> => {
        const revision = scope.revision;
        const sequence = ++scope.checkSequence;
        const value = stateRef.current.draft;
        const check = await validateWebsitePopupHotkey(value, target.targetId);
        if (!isCurrent(scope) || scope.revision !== revision || scope.checkSequence !== sequence || !allow()) return null;
        update({ conflict: check.status === 'conflict' ? check.conflict : null,
            error: check.status === 'available' ? null : check.message });
        return check;
    }, [target.targetId, isCurrent, update]);

    const refresh = useCallback(async () => {
        const scope = scopeRef.current;
        if (!scope || !isCurrent(scope)) return;
        if (scope.pending || stateRef.current.captureActive) { scope.refreshRequested = true; return; }
        scope.refreshRequested = false;
        scope.pending = true;
        const revision = scope.revision;
        const dirty = stateRef.current.draft !== (stateRef.current.saved || '');
        update({ pending: true, error: null });
        try {
            const outcome = await executeWebsitePopupBridgeOperation({ kind: 'get-result-hotkey', ...target });
            if (!isCurrent(scope)) return;
            if (outcome.status !== 'hotkey-state') throw new Error('Unable to load Hotkey.');
            const preserveDraft = dirty || scope.revision !== revision;
            update({ saved: outcome.value, ...(!preserveDraft ? { draft: outcome.value, conflict: null } : {}) });
            if (preserveDraft && stateRef.current.draft.trim()) await checkDraft(scope);
            else update({ conflict: null });
        } catch (failure) {
            if (isCurrent(scope) && scope.revision === revision) update({ error: messageOf(failure) });
        } finally {
            scope.pending = false;
            if (isCurrent(scope)) {
                update({ pending: false });
                if (scope.refreshRequested) void refreshRef.current();
            }
        }
    }, [target.entity, target.targetId, isCurrent, checkDraft, update]);
    refreshRef.current = refresh;

    useEffect(() => {
        const scope = { key, active: true, pending: false, revision: 0, checkSequence: 0, refreshRequested: false };
        scopeRef.current = scope;
        stateRef.current = initialState();
        setState(stateRef.current);
        void refreshRef.current();
        const messages = typeof chrome === 'undefined' ? undefined : chrome.runtime?.onMessage;
        const onChange = (message: { action?: string; table?: string }) => {
            if (message?.action === 'db_changed' && message.table === 'hotkeysMap')
                void refreshRef.current();
        };
        messages?.addListener(onChange);
        return () => { scope.active = false; messages?.removeListener(onChange); };
    }, [key, target.entity, target.targetId]);

    // Validate captured drafts without taking the save lock or disabling the recorder.
    useEffect(() => {
        const scope = scopeRef.current;
        if (!scope || !isCurrent(scope) || !state.captureActive || state.pending
            || !state.draft.trim() || state.draft === state.saved) {
            update({ checking: false });
            return;
        }
        let active = true;
        const revision = scope.revision;
        update({ checking: true });
        const timer = window.setTimeout(() => {
            void checkDraft(scope, () => active && stateRef.current.captureActive && !scope.pending).catch(failure => {
                if (active && stateRef.current.captureActive && isCurrent(scope) && scope.revision === revision && !scope.pending)
                    update({ error: messageOf(failure) });
            }).finally(() => {
                if (active && isCurrent(scope)) update({ checking: false });
            });
        }, 250);
        return () => { active = false; window.clearTimeout(timer); };
    }, [key, state.captureActive, state.draft, state.saved, state.pending, checkDraft, isCurrent, update]);

    const validateDraft = useCallback(() => run(async scope => {
        if (stateRef.current.draft.trim()) await checkDraft(scope);
        else update({ conflict: null, error: null });
    }), [run, checkDraft, update]);
    const persist = useCallback((value: string, approval?: WebsitePopupHotkeyConflict) => {
        update({ captureActive: false, checking: false });
        return run(scope => write(scope, value, approval));
    }, [run, write, update]);
    const commit = useCallback(() => {
        update({ captureActive: false, checking: false });
        return run(async scope => {
            const { draft, saved } = stateRef.current;
            if (draft === saved) return true;
            if (!draft) { await write(scope, ''); return true; }
            const revision = scope.revision;
            const check = await checkDraft(scope);
            if (check?.status === 'available' && scope.revision === revision) await write(scope, check.value);
            else return false;
            return true;
        });
    }, [run, checkDraft, write, update]);
    const changeDraft = useCallback((draft: string) => {
        if (scopeRef.current) scopeRef.current.revision++;
        update({ draft, conflict: null, error: null });
    }, [update]);
    const cancel = useCallback(() => {
        if (stateRef.current.saved === null) { update({ captureActive: false }); return; }
        changeDraft(stateRef.current.saved || '');
        update({ captureActive: false });
        if (scopeRef.current?.refreshRequested) void refreshRef.current();
    }, [changeDraft, update]);
    const startCapture = useCallback(() => {
        if (stateRef.current.saved === null || scopeRef.current?.pending) return;
        update({ captureActive: true, conflict: null, error: null });
    }, [update]);
    const stopCapture = useCallback(() => {
        update({ captureActive: false });
        if (scopeRef.current?.refreshRequested) void refreshRef.current();
    }, [update]);
    const onCaptureStateChange = useCallback((capture: { status: 'idle' | 'arming' | 'recording'; token: string | null; error: string | null }) => {
        if (capture.status !== 'idle' || !capture.error) return;
        update({ captureActive: false, error: capture.error });
        const scope = scopeRef.current;
        if (scope?.refreshRequested) {
            const revision = scope.revision;
            void refreshRef.current().then(() => {
                if (isCurrent(scope) && scope.revision === revision && !stateRef.current.captureActive)
                    update({ error: capture.error });
            });
        }
    }, [isCurrent, update]);

    return { ...state, loading: state.saved === null && !state.error, changeDraft, startCapture, stopCapture,
        onCaptureStateChange, cancel, validateDraft, persist, commit, refresh };
}

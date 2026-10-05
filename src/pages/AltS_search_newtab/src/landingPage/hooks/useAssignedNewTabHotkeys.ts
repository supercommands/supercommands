import { useEffect, useCallback, useRef } from 'react';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { getUserHotkeyByCombination } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { db } from '../../../../../storage/indexDB/dbConfig';
import { recordAssignedTriggerUsage } from '../../../../../shared-components/triggers';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import { getCurrentExtensionTabContext } from '../../../../../shared-components/sessions/launchSessionSmart';
import { launchSessionSmartWithReferences, requestMissingAiPromptInput, } from '../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { waitForNewTabHotkeyApp, cancelNewTabHotkeyAppWaiters } from './newTabHotkeyAppBindings';
interface AssignedNewTabHotkeyOptions {
    enabled: boolean;
    isKeystrokeRecordingActive: () => boolean;
    onOpenFullscreenNote: (id: string) => boolean;
    prepareApp: () => Promise<boolean>;
}
/** Single assigned-hotkey listener above normal App and fullscreen Note routes. */
export const useAssignedNewTabHotkeys = ({ enabled, isKeystrokeRecordingActive, onOpenFullscreenNote, prepareApp }: AssignedNewTabHotkeyOptions) => {
    const dbNotes = useDbStore(state => state.notes);
    const dbLinks = useDbStore(state => state.links);
    const dbSnippets = useDbStore(state => state.snippets);
    const dbAiPrompts = useDbStore(state => state.aiPrompts);
    const dbTodos = useDbStore(state => state.todos);
    const dbSessions = useDbStore(state => state.sessions);
    const dbWidgetViews = useDbStore(state => state.widgetViews);
    const recordNewtabHotkeyUsage = useCallback((hotkey: string, referenceId: string, referenceType: string, success = true, errorCode?: string) => {
        const allRecords = [
            ...dbNotes,
            ...dbLinks,
            ...dbSnippets,
            ...dbAiPrompts,
            ...dbTodos,
            ...dbSessions,
            ...dbWidgetViews
        ] as any[];
        const actualId = extractSnippetIdFromCompoundId(referenceId);
        const entity = allRecords.find(record => String(record?.id || record?.snippet_id || '') === actualId);
        recordAssignedTriggerUsage({
            triggerKind: 'user_hotkey',
            triggerValue: hotkey,
            triggerSource: 'hotkey',
            referenceId,
            referenceType,
            surface: 'newtab',
            success,
            errorCode,
            targetLabelSnapshot: entity?.title || entity?.name || entity?.key || referenceId,
            triggerLabelSnapshot: hotkey,
        }).catch(err => console.warn('[useKeyboardShortcuts] Failed to record hotkey usage:', err));
    }, [dbAiPrompts, dbLinks, dbNotes, dbSessions, dbSnippets, dbTodos, dbWidgetViews]);
    const launchCollectionViewById = useCallback(async (referenceId: string) => {
        return launchDashboardCollectionView(referenceId, { mode: 'open' });
    }, []);
    const handlers = useRef({ isKeystrokeRecordingActive, onOpenFullscreenNote, prepareApp, recordNewtabHotkeyUsage });
    handlers.current = { isKeystrokeRecordingActive, onOpenFullscreenNote, prepareApp, recordNewtabHotkeyUsage };
    // Handle global hotkeys for commands, links, and notes (matching AltS logic)
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        const handleHotkeyDown = async (e: KeyboardEvent) => {
            if (e.repeat || handlers.current.isKeystrokeRecordingActive())
                return;
            // Check if typing in an input/textarea
            const activeEl = document.activeElement;
            const isInInputField = activeEl?.tagName === 'INPUT' ||
                activeEl?.tagName === 'TEXTAREA' ||
                (activeEl as HTMLElement)?.isContentEditable;
            // Ignore standalone modifier keys
            if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(e.key)) {
                return;
            }
            // Build pressed hotkey string
            const parts: string[] = [];
            if (e.ctrlKey || e.metaKey)
                parts.push('Ctrl');
            if (e.altKey)
                parts.push('Alt');
            if (e.shiftKey)
                parts.push('Shift');
            let keyName = e.key;
            if (keyName === ' ')
                keyName = 'Space';
            else if (keyName.length === 1)
                keyName = keyName.toUpperCase();
            else if (keyName === 'ArrowUp')
                keyName = '?';
            else if (keyName === 'ArrowDown')
                keyName = '?';
            else if (keyName === 'ArrowLeft')
                keyName = '?';
            else if (keyName === 'ArrowRight')
                keyName = '?';
            parts.push(keyName);
            const pressedHotkey = parts.join('+');
            // Skip if no modifier (we don't want single key hotkeys in AltS_search_newtab)
            // This also ensures normal typing in inputs is not intercepted
            if (!e.ctrlKey && !e.altKey && !e.metaKey)
                return;
            // Skip if typing in input WITHOUT a hotkey modifier combination
            // (Allow Ctrl/Alt+key combos even in input fields for hotkeys)
            // Only skip for common text editing shortcuts that should work in inputs
            if (isInInputField) {
                // Allow standard text editing shortcuts to work in inputs
                const isTextEditShortcut = (e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase());
                if (isTextEditShortcut)
                    return;
            }
            // Check database hotkeys first (prioritized user-defined DB hotkeys)
            try {
                const dbHotkey = await getUserHotkeyByCombination(pressedHotkey);
                if (!active) return;
                if (dbHotkey) {
                    const { referenceId, referenceType } = dbHotkey;
                    const normalizedReferenceType = String(referenceType || '').toLowerCase();
                    const backgroundTargets = ['link', 'webcollection', 'agent', 'chat_agent', 'module', 'automation'];
                    const appTargets = ['command', 'todo', 'note', 'snippet', 'prompt', 'aiprompt', 'ai_prompt', 'collection', 'collections', 'collection_view'];
                    if (![...backgroundTargets, ...appTargets, 'session'].includes(normalizedReferenceType)) return;
                    const actualIdForRoute = extractSnippetIdFromCompoundId(referenceId);
                    if (referenceType === 'note' && handlers.current.onOpenFullscreenNote(actualIdForRoute)) {
                        e.preventDefault(); e.stopPropagation();
                        handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
                        return;
                    }
                    const needsApp = appTargets.includes(normalizedReferenceType);
                    const app = needsApp ? await waitForNewTabHotkeyApp(handlers.current.prepareApp) : null;
                    if (!active || (needsApp && !app)) return;
                    if (referenceType === 'command') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (referenceId === 'create') {
                            app?.openCreateMenu();
                            handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
                            return;
                        }
                        if (app) {
                            app.executeCommand(referenceId);
                            handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
                        }
                        return;
                    }
                    if (normalizedReferenceType === 'todo') {
                        e.preventDefault();
                        e.stopPropagation();
                        const actualId = extractSnippetIdFromCompoundId(referenceId);
                        const todo = await db.todos.get(actualId);
                        if (todo) {
                            const ui = useUIStore.getState();
                            ui.setView({ type: 'home' });
                            ui.setTodoCreatePrefill(todo);
                            ui.openItemEditor('todo', String(todo.id));
                        }
                        handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, Boolean(todo), todo ? undefined : 'todo_not_found');
                        return;
                    }
                    if (referenceType === 'note' ||
                        referenceType === 'snippet' ||
                        ['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType)) {
                        e.preventDefault();
                        e.stopPropagation();
                        const actualId = extractSnippetIdFromCompoundId(referenceId);
                        if (referenceType === 'snippet') {
                            useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'snippet' } });
                        }
                        else if (['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType)) {
                            const promptRecord = useDbStore.getState().aiPrompts.find(prompt => String(prompt.id) === String(actualId));
                            if (promptRecord) {
                                requestMissingAiPromptInput({
                                    promptRecord,
                                    promptId: actualId,
                                    title: promptRecord.title || 'AI Prompt',
                                });
                            }
                            else {
                                useUIStore.getState().openEditor({ type: 'aiPrompt', id: actualId });
                            }
                        }
                        else {
                            useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'note' } });
                        }
                        handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
                        return;
                    }
                    if (['collection', 'collections', 'collection_view'].includes(normalizedReferenceType)) {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            const didLaunch = await launchCollectionViewById(referenceId);
                            handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, didLaunch, didLaunch ? undefined : 'collection_view_not_found');
                        }
                        catch (error) {
                            console.error('[useKeyboardShortcuts] Failed to launch collection view hotkey:', error);
                            handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, false, 'collection_view_launch_failed');
                        }
                        return;
                    }
                    if ((referenceType as string) === 'session') {
                        e.preventDefault();
                        e.stopPropagation();
                        const actualId = extractSnippetIdFromCompoundId(referenceId);
                        const session = useDbStore.getState().sessions.find(item => String(item.id) === String(actualId));
                        if (!session) {
                            handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, false, 'entity_not_found');
                            return;
                        }
                        const response = await launchSessionSmartWithReferences(session, {
                            source: 'hotkey',
                            requireAutoSave: false,
                        });
                        handlers.current.recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, response?.ok && !response?.skipped, response?.skipped ? response.reason : response?.ok ? undefined : response?.error || 'session_launch_failed');
                        return;
                    }
                    if (backgroundTargets.includes(normalizedReferenceType)) {
                        e.preventDefault();
                        e.stopPropagation();
                        const actualId = extractSnippetIdFromCompoundId(referenceId);
                        const currentTabContext = await getCurrentExtensionTabContext();
                        // Trigger the hotkey via background to actually open the URLs in new tabs
                        chrome.runtime.sendMessage({
                            action: 'trigger_hotkey',
                            type: referenceType,
                            id: actualId,
                            ...currentTabContext,
                            triggerUsage: {
                                triggerKind: 'user_hotkey',
                                triggerValue: pressedHotkey,
                                triggerSource: 'hotkey',
                                surface: 'newtab',
                                referenceId,
                                referenceType,
                                correlationId: `newtab_hotkey_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                            },
                        });
                        return;
                    }
                }
            }
            catch (error) {
                console.error('[useKeyboardShortcuts] Failed to check database hotkey:', error);
            }
            // ?? Global System Shortcuts: Ctrl+Q (Quick Search)
            const isCtrlQ = pressedHotkey === 'Ctrl+Q';
            if (isCtrlQ) {
                e.preventDefault();
                e.stopPropagation();
                // Ctrl+Q behavior: Focus search
                const app = await waitForNewTabHotkeyApp(handlers.current.prepareApp);
                if (active) app?.focusSearch();
                return;
            }
        };
        window.addEventListener('keydown', handleHotkeyDown);
        return () => {
            active = false;
            cancelNewTabHotkeyAppWaiters();
            window.removeEventListener('keydown', handleHotkeyDown);
        };
    }, [enabled, launchCollectionViewById]);
};

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import ReactDOM from 'react-dom';
import { useAppearance } from '@extension/ui';
import clsx from 'clsx';
import { BRAND } from '../../../../shared-components/brandingConfig';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE } from '../../../../shared-components/editorContainer/functionalEditorSurfaceStyle';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { isLocalCommandId, findCommandByAnyId } from '../../../../shared-components/commands';
import { executeRetiredCreateUiAction } from '../../../../shared-components/commands/newtabCommandRuntime';
import { extractUrlsFromSnippet, resolvePrimaryAction, } from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { FaLink, FaNetworkWired, FaBook, FaPlus, FaHashtag, FaChevronRight, FaChevronLeft, FaSun, FaMoon, FaFileAlt, FaHome, FaChevronDown, } from 'react-icons/fa';
import { FiCreditCard, FiTerminal, FiSettings, FiCheck, FiLayout } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { AiOutlineEnter } from 'react-icons/ai';
import { BsPinAngle, BsPinAngleFill, BsList, BsGrid, BsTable, BsLayoutSidebarInsetReverse } from 'react-icons/bs';
import type { SnippetActionDetail } from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type { InteractiveItem } from '../landingPage/views/defaultContainer';
import { AI_GROUP, type CommandId } from '../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { getCommandServices } from '../commands/commandServices';
import { commandRegistry } from '../../../../shared-components/commands/registry';
import { CommandContext } from '../../../../shared-components/commands/types';
import { type LocalCommandId } from '../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import type { OrganisationData } from '../../../../settings/allOrganisationManager/organisations/organisationTypes';
import type { SnippetRecord } from '../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { requestMissingAiPromptInput } from '../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useWidgetDashboardStore } from '../../../../storage/store/useWidgetDashboardStore';
import { launchSessionSmartWithReferences } from '../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { updateSnippet } from '../../../../allObjectFolder/src/createObject/snippets/snippetData';
import { nowUtc } from '../../../../shared-components/utils';
import { isSameDay } from 'date-fns';
import { toggleFavoriteRecord } from '../../../../shared-components/favorites/favoriteData';
import { getItemCompoundId, extractSnippetIdFromCompoundId, } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { deleteTodo, createTodo, mapTodoReferences } from '../../../../allObjectFolder/src/createObject/todos/todoData';
import { executeItemDelete } from '../../../../shared-components/utils/itemDelete';
import { db } from '../../../../storage/indexDB/dbConfig';
import { recordTimelineOpen, type TimelineKind } from './timeline/timelineActivity';
import { saveHotkey, clearHotkey } from '../../../../shared-components/hotkeys';
import { saveShortcut, clearShortcut } from '../../../../shared-components/shortcuts';
import Searchbar, { type SearchbarHandle, type SuggestionState, type WorkspaceItemSuggestion as SnippetSuggestion, } from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';
import useNotification from '../../../../shared-components/notifications/useNotification';
import { LEFT_SIDEBAR_WIDTHS } from '../landingPage/useLeftSidebarLayout';
import { useConvertibleItems } from '../../../../allObjectFolder/src/createObject/todos/todoHooks';
// import CreateWorkspacePanel from '../../../../settings/allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import { storageDebug } from '../../../../shared-components/utils/storageDebugLogger';
import { SessionGridIcon } from '../../../../shared-components/icons/sessionGridIcon';
import { updateWidgetSettingsAsync } from '../../../../storage/localStorage/widgetDashboardStorage';
import WidgetMainContainer from './widgets/components/WidgetMainContainer';
import { WIDGET_CATALOG_MIN_DOCK_VIEWPORT_WIDTH, WIDGET_CATALOG_PANEL_WIDTH } from './widgets/components/RightSideWidget';
import { isMainDashboardView } from './widgets/engine/widgetDashboardData';
import { startupPerf } from '../startupPerf';
const DeleteDialog = React.lazy(() => import('../../../../shared-components/modals/deleteDialog'));
const EditSnippetScreen = React.lazy(() => import('../../../../allObjectFolder/src/createObject/snippets/SnippetEditorScreen'));
const NoteEditorView = React.lazy(() => import('../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView').then(module => ({
    default: module.NoteEditorView,
})));
const CreateTodoView = React.lazy(() => import('../../../../allObjectFolder/src/createObject/todos/ui/CreateTodoView'));
const AiPromptEditorView = React.lazy(() => import('../../../../allObjectFolder/src/createObject/aiPrompt/ui/AiPromptEditorView').then(module => ({
    default: module.AiPromptEditorView,
})));
const LinkEditorView = React.lazy(() => import('../../../../allObjectFolder/src/createObject/links/ui/LinkEditorView'));
const SessionEditorView = React.lazy(() => import('../../../../allObjectFolder/src/createObject/session/ui/SessionEditorView'));
const ChatAgent = React.lazy(() => import('../../../../allObjectFolder/src/createObject/ChatAgent'));
const BoardView = React.lazy(() => import('../../../../shared-components/BoardView/BoardView'));
const SettingsLayout = React.lazy(() => import('../../../../settings/uxLayoutCustomization/settingsLayout'));
const SpreadsheetMainContainer = React.lazy(() => import('../../../../shared-components/spreadsheetUi/ui/spreadsheetMainContainer'));
const KnowledgeExplorerView = React.lazy(() => import('../../../../shared-components/knowledgeGraph/KnowledgeExplorerView'));
const CollectionsView = React.lazy(() => import('./collections/CollectionsView'));
const TimelineView = React.lazy(() => import('./timeline/TimelineView'));
type Snippet = SnippetRecord & {
    key?: string;
    value?: string | {
        urls?: string[];
        names?: string[];
    };
    category?: string;
};
type Organisation = OrganisationData & {
    organisation_snippets?: Snippet[];
};
interface ContainerProps {
    reload: () => void;
    searchbarRef: React.RefObject<SearchbarHandle | null>;
    searchValue?: string;
    onSnippetSelectFromSearch?: (item: SnippetSuggestion) => void;
    commandListCategory?: string;
    onCommandListCategoryChange?: (category: string) => void;
    activeCommandSection?: string;
    onCommandSectionChange?: (section: string) => void;
    onOrganizationSettings?: (orgId: string, orgName: string) => void;
    onCreateOrganization?: () => void;
    onOrganizationHandlersReady?: (handlers: {
        onOrganizationSettings: (orgId: string, orgName: string) => void;
        onCreateOrganization: () => void;
    }) => void;
    onOrganizationPanelChange?: (state: {
        isOpen: boolean;
        orgId?: string;
        orgName?: string;
        loading?: boolean;
    }) => void;
    onSearchbarFocus?: (isUserInitiated: boolean) => void; // Called when main searchbar gains focus
    onNavigateToListView?: (category: 'commands', section?: string) => void;
    hideMainContent?: boolean; // Hide main content (keep searchbar visible)
    onLockedCommandChange?: (commandId: string | null) => void;
    onMenuStateChange?: (isOpen: boolean) => void;
    onQueryChange?: (value: string) => void;
    isSpreadsheetViewOpen?: boolean;
    onOpenSpreadsheetMainContainer?: (section?: string) => void;
    onCloseSpreadsheetMainContainer?: () => void;
    onCreateOrganisation?: () => void;
    showSidebarColumn?: boolean;
    isInitialAltSFocus?: boolean;
    onInitialAltSFocusChange?: (val: boolean) => void;
    onBoardViewOpenChange?: (isOpen: boolean) => void;
    /** Called after user confirms unsaved-changes dialog triggered by Alt+S */
    onShortcutBoardView?: () => void;
    /** Called after user confirms unsaved-changes dialog triggered by shortcut */
    onShortcutCreateMenu?: () => void;
    onSuggestionStateChange?: (state: SuggestionState | null) => void;
    onHoverSlashDot?: () => void;
    onBoardViewRedirect?: () => void;
    isWidgetEditMode?: boolean;
    onEnterWidgetEditMode?: (widgetId?: string) => void;
    onExitWidgetEditMode?: () => void;
    pendingSelectedWidgetId?: string | null;
    isLeftSidebarIconOnly?: boolean;
}
const KeyHint: React.FC<{
    keys: string[];
}> = ({ keys }) => (<span className="flex items-center gap-1">
    {keys.map((key: string) => (<span key={key} className="rounded border border-white/20 bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 shadow-sm leading-none">
        {key}
      </span>))}
  </span>);
const Container: React.FC<ContainerProps> = ({ reload, searchbarRef, onMenuStateChange, searchValue: propSearchValue, onSnippetSelectFromSearch, commandListCategory, onCommandListCategoryChange, activeCommandSection, onCommandSectionChange, onOrganizationSettings, onCreateOrganization, onOrganizationHandlersReady, onOrganizationPanelChange, onSearchbarFocus, onNavigateToListView, hideMainContent, onLockedCommandChange, onQueryChange: propOnQueryChange, isSpreadsheetViewOpen, onOpenSpreadsheetMainContainer, onCloseSpreadsheetMainContainer, onCreateOrganisation, showSidebarColumn, isInitialAltSFocus, onInitialAltSFocusChange, onBoardViewOpenChange, onShortcutBoardView, onShortcutCreateMenu, onSuggestionStateChange, onHoverSlashDot, onBoardViewRedirect, isWidgetEditMode = false, onEnterWidgetEditMode, onExitWidgetEditMode, pendingSelectedWidgetId, isLeftSidebarIconOnly = false, }: ContainerProps) => {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1366));
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const boardViewRef = useRef<any>(null);
    // Clear any persisted dirty/draft states on app initialization (e.g. refresh)
    useEffect(() => {
        startupPerf('Container:clearDrafts');
        // Clear Todo draft as well
        useUIStore.getState().setTodoDraft({
            title: '',
            scheduleType: '',
            recurringCycle: 'daily',
            time: '',
            date: '',
            isAnytime: false,
            selectedItem: null,
            selectedType: 'custom',
            description: '',
        });
    }, []);
    const [suggestionState, setSuggestionStateInternal] = useState<SuggestionState | null>(null);
    useEffect(() => {
        onSuggestionStateChange?.(suggestionState);
    }, [suggestionState, onSuggestionStateChange]);
    const setSuggestionState = useCallback((val: SuggestionState | null | ((prev: SuggestionState | null) => SuggestionState | null)) => {
        setSuggestionStateInternal(val);
    }, []);
    const prevIsMenuOpenRef = useRef(false);
    const [searchValue, setSearchValue] = useState('');
    const prevLockedRef = useRef<string | null>(null);
    const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const [agentSpeakerProps, setAgentSpeakerProps] = useState<any>(null);
    const activeView = useUIStore(s => s.activeView);
    const activeEditor = useUIStore(s => s.activeEditor);
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
    const sameJson = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    useEffect(() => {
        startupPerf('Container:initDbSync:start');
        useDbStore.getState().initDbSync();
    }, []);
    const commands = useDbStore(state => state.commands);
    const lockedCommand = suggestionState?.lockedCommand;
    const dbOrganisations = useDbStore(state => state.organisations);
    const dbSnippets = useDbStore(state => state.snippets);
    const dbTodos = useDbStore(state => state.todos);
    const dbHotkeysMap = useDbStore(state => state.hotkeysMap);
    const dbChatAgents = useDbStore(state => state.chatAgents);
    const dbAiPrompts = useDbStore(state => state.aiPrompts);
    useEffect(() => {
        if (activeView?.type === 'timeline' && isSpreadsheetViewOpen) onCloseSpreadsheetMainContainer?.();
    }, [activeView?.type, isSpreadsheetViewOpen, onCloseSpreadsheetMainContainer]);
    useEffect(() => {
        const editor = activeEditor;
        if (!editor) return;
        if (activeView?.type === 'collections' || (isSpreadsheetViewOpen && !editor.props?.isOverlay)) return;
        const tables = {
            note: db.notes, link: db.links, todo: db.todos, snippet: db.snippets,
            aiPrompt: db.aiPrompts,
        };
        const kind = editor.type as keyof typeof tables;
        const table = tables[kind];
        if (!table) return;
        // Several editor routes use "new" or "edit" as their UI id while carrying
        // the saved entity in props. Resolve the real database id before logging.
        const candidates = [editor.props?.snippet?.id, editor.props?.snippet?.snippet_id,
            editor.props?.item?.id, editor.props?.prefill?.id, editor.id]
            .filter((id): id is string => typeof id === 'string' && !!id && id !== 'new' && id !== 'edit' && id !== 'todo-create');
        if (!candidates.length) return;
        let cancelled = false;
        void (async () => {
            for (const candidate of candidates) {
                const record = await table.get(candidate);
                if (record && !('deletedAt' in record && record.deletedAt != null)) {
                    if (!cancelled) recordTimelineOpen(kind as TimelineKind, String(record.id));
                    break;
                }
            }
        })().catch(() => {});
        return () => { cancelled = true; };
    }, [activeEditor?.openInstanceId, activeView?.type, isSpreadsheetViewOpen]);
    useEffect(() => {
        startupPerf('Container:commit', {
            renderCount: renderCountRef.current,
            activeViewType: activeView?.type || 'none',
            activeEditorType: activeEditor?.type || 'none',
            suggestionVisible: Boolean(suggestionState),
            lockedCommand: suggestionState?.lockedCommand,
            searchValueLength: searchValue.length,
            organisationCount: dbOrganisations.length,
            snippetCount: dbSnippets.length,
            todoCount: dbTodos.length,
            chatAgentCount: dbChatAgents.length,
            aiPromptCount: dbAiPrompts.length,
        });
    });
    const [activeTodoId, setActiveTodoId] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (activeEditor?.type !== 'todo') {
            setActiveTodoId(null);
        }
    }, [activeEditor?.type]);
    const handleLoadTodo = useCallback((todo: any) => {
        if (!todo) {
            setActiveTodoId(null);
            useUIStore.getState().setTodoCreatePrefill(null);
            return;
        }
        setActiveTodoId(todo.id);
        // Load the todo into the CreateTodoView form by using the prefill mechanism
        useUIStore.getState().setTodoCreatePrefill({
            todo_id: todo.id,
            key: todo.name,
            title: todo.name,
            description: todo.description ?? '',
            value: todo.description ?? '',
            category: 'custom',
            is_done: todo.isDone,
            scheduleTime: todo.scheduleTime,
            event_deadline: new Date(todo.scheduleTime).toISOString(),
            is_recurring: todo.scheduleType === 'recurring',
            recurring_cycle: todo.recurringType ?? null,
            is_anytime: false,
            references: todo.references ?? [],
            config: { id: (todo.references ?? []).map((r: any) => r.id), title: todo.name },
            tags: todo.tags ?? todo.tagIds ?? [],
            tagIds: todo.tagIds ?? todo.tags ?? [],
            shortcut: todo.shortcut ?? '',
            hotkey: dbHotkeysMap[todo.id] || todo.hotkey || '',
        });
    }, [dbHotkeysMap]);
    const handleDeleteTodoById = useCallback(async (id: string) => {
        try {
            await db.todos.delete(id);
            await deleteTodo(id);
            const currentActiveId = activeTodoId ||
                (useUIStore.getState().activeEditor?.type === 'todo'
                    ? useUIStore.getState().activeEditor?.props?.prefill?.todo_id ||
                        useUIStore.getState().activeEditor?.props?.prefill?.id ||
                        useUIStore.getState().activeEditor?.id
                    : null);
            if (String(currentActiveId) === String(id) || activeTodoId === id) {
                setActiveTodoId(null);
                useUIStore.getState().setTodoCreatePrefill(null);
                useUIStore.getState().openEditor({ type: 'todo', id: 'new' });
            }
            const chromeAny = (window as any).chrome;
            if (chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: id });
            }
        }
        catch (e) {
            console.error('[Container] Failed to delete todo from table:', e);
        }
    }, [activeTodoId]);
    const handleUpdateTodoField = useCallback(async (id: string, field: string, value: any) => {
        try {
            const todo = await db.todos.get(id);
            if (!todo)
                return;
            const chromeAny = (window as any).chrome;
            if (field === 'title') {
                await db.todos.update(id, { name: value, updatedAt: Date.now() });
                if (chromeAny?.storage?.local) {
                    const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                    const localTodos = result.local_todos || [];
                    const updated = localTodos.map((t: any) => String(t.snippet_id || t.id || t.todo_id) === String(id) ? { ...t, key: value, title: value } : t);
                    await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
                }
            }
            else if (field === 'shortcut') {
                await db.todos.update(id, { shortcut: value, updatedAt: Date.now() });
                if (value) {
                    await saveShortcut(id, id, value, todo.name, 'todo');
                }
                else {
                    await clearShortcut(id, id, 'todo');
                }
                if (chromeAny?.storage?.local) {
                    const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                    const localTodos = result.local_todos || [];
                    const updated = localTodos.map((t: any) => String(t.snippet_id || t.id || t.todo_id) === String(id) ? { ...t, shortcut: value } : t);
                    await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
                }
            }
            const currentPrefill = useUIStore.getState().todoCreatePrefill;
            if (currentPrefill) {
                const prevId = (currentPrefill as any).todo_id || (currentPrefill as any).id || (currentPrefill as any).snippet_id;
                if (String(prevId) === String(id)) {
                    useUIStore.getState().setTodoCreatePrefill({
                        ...currentPrefill,
                        ...(field === 'title' ? { title: value, key: value } : {}),
                        ...(field === 'shortcut' ? { shortcut: value } : {}),
                    });
                }
            }
        }
        catch (e) {
            console.error('[Container] Failed to update todo inline field:', e);
        }
    }, []);
    // --- Saved AI Agents for AICommandLockedUI ---
    const savedAiAgents = useMemo(() => {
        const agents: any[] = [];
        // Merge real ChatAgent records from Dexie (AI prompt editors)
        dbChatAgents.forEach((agent: any) => {
            if (!agents.find(a => String(a.id) === String(agent.id))) {
                agents.push({
                    ...agent,
                    organisation_id: agent.organisationId || agent.organisation_id,
                    category: 'agent',
                    type: 'chat_agent',
                });
            }
        });
        // Merge real AI Prompts (AiPromptEditorView prompts)
        dbAiPrompts.forEach((prompt: any) => {
            if (!agents.find(a => String(a.id) === String(prompt.id))) {
                agents.push({
                    ...prompt,
                    name: prompt.title || prompt.name || '',
                    url: prompt.prompt || '',
                    organisation_id: prompt.organisationId || prompt.organisation_id,
                    category: 'agent',
                    type: 'chat_agent',
                });
            }
        });
        return agents;
    }, [dbChatAgents, dbAiPrompts]);
    const handleSelectSavedAgent = (agent: any) => {
        searchbarRef.current?.selectSavedAgent(agent);
    };
    const handleNewChat = () => {
        searchbarRef.current?.newAiChat();
    };
    const selectedOrganisationId = useUIStore((s: any) => s.selectedOrganisationId);
    const selectedOrganisation = React.useMemo(() => {
        const ws = dbOrganisations.find((item: any) => item.id === selectedOrganisationId);
        if (!ws)
            return null;
        return {
            ...(ws as any),
            organisation_id: (ws as any).organisation_id || ws.id,
            organisation_name: (ws as any).organisation_name || ws.organisationName,
            organisation_snippets: [],
        } as any;
    }, [dbOrganisations, selectedOrganisationId]);
    const selectedSnippetRawId = useUIStore((s: any) => s.selectedSnippetId);
    const selectedSnippetRaw = React.useMemo(() => {
        const snippet = dbSnippets.find((item: any) => item.id === selectedSnippetRawId || (item as any).item || (item as any).snippet_id === selectedSnippetRawId);
        if (!snippet)
            return null;
        return {
            ...(snippet as any),
            snippet_id: (snippet as any).snippet_id || snippet.id,
        } as any;
    }, [dbSnippets, selectedSnippetRawId]);
    const snippetBreadCrum = useUIStore((s: any) => s.snippetBreadcrumb);
    const isCreatingNewItem = activeEditor?.id === 'new';
    // Guard the editor state with Zustand's activeEditor to prevent stale state bugs
    const selectedSnippet = activeEditor ? selectedSnippetRaw : null;
    const isCreatingEditorView = activeEditor?.type === 'note' ||
        activeEditor?.type === 'snippet' ||
        activeEditor?.type === 'aiPrompt' ||
        activeEditor?.type === 'session' ||
        activeEditor?.type === 'todo';
    const { theme } = useAppearance();
    const isDark = theme.isDark;
    const isFocusMode = useUIStore((s: any) => s.isFocusMode);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isLinkEditModalOpen = useUIStore(s => s.activeEditor?.type === 'link');
    const linkEditPrefill = useUIStore((s: any) => s.linkEditPrefill);
    const todoCreatePrefill = useUIStore((s: any) => s.todoCreatePrefill);
    // This matches RichEditor behavior: navigating via sidebar should reset the view.
    // The user should manually close the modal or it should be handled explicitly.
    // Load and sync favorites
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local)
            return;
        // Initial load
        chromeAny.storage.local.get('myFavouriteItems', (res: {
            myFavouriteItems?: Record<string, any[]>;
        }) => {
            const nextValue = res.myFavouriteItems || {};
            setFavoritesMapping(prev => (sameJson(prev, nextValue) ? prev : nextValue));
        });
        // Listener
        const handleChange = (changes: {
            [key: string]: any;
        }, area: string) => {
            if (area === 'local' && changes.myFavouriteItems) {
                const nextValue = changes.myFavouriteItems.newValue || {};
                setFavoritesMapping(prev => (sameJson(prev, nextValue) ? prev : nextValue));
            }
        };
        chromeAny.storage.onChanged.addListener(handleChange);
        return () => {
            chromeAny.storage.onChanged.removeListener(handleChange);
        };
    }, []);
    // RESET STATE ON MOUNT (Refresh)
    // User requested: "When I just refresh... it goes to the home view freshly new one."
    // RESET STATE ON MOUNT (Refresh) - Ensure completely clean state
    useEffect(() => {
        const hasUrlTrigger = typeof window !== 'undefined' && (window as any).__hasUrlTrigger;
        // Load favorites visibility from storage
        const chrome = (window as any).chrome;
        if (chrome?.storage?.local) {
            chrome.storage.local.get(['showFavorites'], (result: any) => {
                if (result.showFavorites !== undefined) {
                    useUIStore.getState().setShowFavorites(result.showFavorites);
                }
            });
        }
        if (hasUrlTrigger) {
            return;
        }
        // Clear all navigation and selection state
        useUIStore.getState().setSelectedSnippetId(null);
        useUIStore.getState().setSnippetBreadcrumb(null);
        useUIStore.getState().setSelectedOrganisationId(null);
        // dispatch(setShowTodosView(false)); // REMOVED: keep Todos open if user pinned it
        const urlParams = new URLSearchParams(window.location.search);
        const hasLockParam = urlParams.get('lock_command') || urlParams.get('open_note') || urlParams.get('trigger_hotkey');
        // Clear search and scroll
        setSearchValue('');
        // COLLAPSE EVERYTHING - critical for "fresh start" feel
        // useUIStore.getState().expandAllWorkspaces({});
        // Ensure local state is reset
        // Clear suggestion state
        setSuggestionState(null);
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
        // RESET TO HOME VIEW - ensures fresh start on refresh/new tab
        // Specifically clear any pending AI/Command locks via the ref if it's available after mount
        useUIStore.getState().returnToHome();
        // Explicitly clear AI lock on next tick to ensure Searchbar is ready
        // BUT skip this if the URL has a lock_command (e.g. from opening an agent in a collection)
        setTimeout(() => {
            if (searchbarRef.current) {
                if (!hasLockParam) {
                    searchbarRef.current.lockCommand(null);
                }
                else {
                }
            }
        }, 50);
    }, []);
    // Sync with prop if it changes (e.g. from parent App)
    useEffect(() => {
        if (propSearchValue !== undefined && propSearchValue !== searchValue) {
            setSearchValue(propSearchValue);
        }
    }, [propSearchValue]);
    const isLinkEditMode = useUIStore((s: any) => s.activeEditor?.type === 'link');
    const activeLinkSnippet = useUIStore((s: any) => s.linkEditPrefill?.snippet);
    const showFavorites = useUIStore((s: any) => s.showFavorites);
    // Clear searchbar state when navigating to Todos View to ensure locked AI modes are dismissed
    useEffect(() => {
        if (activeView?.type === 'todo') {
            searchbarRef.current?.clear();
            setSuggestionState(null);
        }
    }, [activeView?.type]);
    const handleCloseLinkEditModal = () => {
        useUIStore.getState().setSelectedSnippetId(null); // Ensure snippet is deselected so editor mode exits and searchbar reappears
        useUIStore.getState().returnToHome();
        // Reset search state to ensure we return to the Homepage view (no "Keep typing..." message)
        if (isCreatingNewItem || selectedOrganisation) {
            // Removed searchValue and searchbar clear to allow persistent suggestions
            // setSearchValue('');
            //
            // setSuggestionState(null);
            // Full Reset to Homepage (Fresh state)
            useUIStore.getState().setSelectedOrganisationId(null);
            useUIStore.getState().setSelectedSnippetId(null);
            useUIStore.getState().setSnippetBreadcrumb(null);
            // useUIStore.getState().setShowFavorites(false); // REMOVED: Respect user choice
            if (searchbarRef.current) {
                // searchbarRef.current.clear();
                searchbarRef.current.blur();
            }
        }
        else {
            // Only focus if we were NOT clearing search (meaning we were probably already in a clean state)
            setTimeout(() => {
                if (!isModalOpen() && searchbarRef.current) {
                    searchbarRef.current.focus();
                }
            }, 0);
        }
    };
    const userId = 'local_user';
    const viewMode = useUIStore((s: any) => s.viewMode);
    const triggerNotification = useNotification();
    const [homeDeleteContext, setHomeDeleteContext] = useState<{
        isOpen: boolean;
        detail: SnippetActionDetail | null;
    }>({ isOpen: false, detail: null });
    // Organization handlers - these set the view and call parent callbacks
    const handleOrganizationSettings = useCallback((orgId: string, orgName: string) => {
        useUIStore.getState().setView({ type: 'settings', section: 'allOrganisations' });
        onOrganizationSettings?.(orgId, orgName);
    }, [onOrganizationSettings]);
    const handleCreateOrganisation = useCallback(() => {
        // Workspace creation is only allowed from onboarding for now.
        // useUIStore.getState().setView({ type: 'createWorkspace' });
        // onCreateWorkspace?.();
    }, [onCreateOrganisation]);
    const handleCreateOrganization = useCallback(() => {
        // Organization/workspace creation is only allowed from onboarding for now.
        // useUIStore.getState().setView({ type: 'createWorkspace' });
        // onCreateOrganization?.();
    }, [onCreateOrganization]);
    // Expose handlers to parent (App) so it can pass them to SideBar
    useEffect(() => {
        if (onOrganizationHandlersReady) {
            onOrganizationHandlersReady({
                onOrganizationSettings: handleOrganizationSettings,
                // Organization/workspace creation is only allowed from onboarding for now.
                // onCreateOrganization: handleCreateOrganization,
                onCreateOrganization: () => { },
            });
        }
    }, [onOrganizationHandlersReady, handleOrganizationSettings, handleCreateOrganization]);
    // Notify parent when organization panel opens/closes
    useEffect(() => {
        if (activeView?.type === 'createOrganisation') {
            onOrganizationPanelChange?.({
                isOpen: true,
                orgId: (activeView as any)?.orgId,
                orgName: (activeView as any)?.orgName,
            });
        }
        else {
            onOrganizationPanelChange?.({ isOpen: false });
        }
    }, [activeView, onOrganizationPanelChange]);
    const commandStatus = useUIStore((s: any) => s.commandStatus);
    const pendingNotification = useUIStore((s: any) => s.pendingNotification);
    const [inlineNotification, setInlineNotification] = useState<{
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
    } | null>(null);
    // When pendingNotification changes, display it and auto-clear after 10 seconds
    useEffect(() => {
        if (pendingNotification) {
            // Show the notification
            setInlineNotification(pendingNotification);
            useUIStore.setState({ pendingNotification: null });
        }
        // Auto-clear after 10 seconds (hard deadline)
        if (inlineNotification) {
            const timeout = setTimeout(() => {
                setInlineNotification(null);
            }, 10000);
            return () => clearTimeout(timeout);
        }
        return undefined;
    }, [pendingNotification, inlineNotification]);
    // Auto-clear command status after 10 seconds (hard deadline)
    useEffect(() => {
        if (commandStatus.status !== 'idle' && commandStatus.status !== 'loading') {
            const timeout = setTimeout(() => {
                useUIStore.getState().resetCommandStatus();
            }, 10000);
            return () => clearTimeout(timeout);
        }
        return undefined;
    }, [commandStatus]);
    // Memoized reload function to avoid unnecessary re-renders
    const handleReload = useCallback(() => {
        // Trigger a background reload but don't block UI
        reload();
    }, [reload]);
    const debouncedSearchTerm = useUIStore((s: any) => s.debouncedSearchTerm);
    // Helper function to check if any modal/popup is open (matching AltS logic)
    const isModalOpen = useCallback((): boolean => {
        const modals = document.querySelectorAll('.fixed.inset-0');
        const activeElement = document.activeElement;
        if (activeElement) {
            const modalParent = activeElement.closest('.fixed.inset-0');
            if (modalParent) {
                const style = window.getComputedStyle(modalParent);
                if (style.opacity !== '0' && style.display !== 'none') {
                    return true;
                }
            }
        }
        for (let i = 0; i < modals.length; i++) {
            const modal = modals[i] as HTMLElement;
            const style = window.getComputedStyle(modal);
            if (style.opacity !== '0' && style.display !== 'none') {
                return true;
            }
        }
        return false;
    }, []);
    // Focus search bar when view/state changes (matching AltS behavior)
    // Only focus if not in editor mode (which handles its own focus)
    useEffect(() => {
        const focusTimeout = window.setTimeout(() => {
            // Only focus if not in editor mode (which handles its own focus)
            // AND not in AI command mode (which has its own middle input box)
            const isInEditor = (isCreatingNewItem || selectedSnippet) && snippetBreadCrum;
            const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
                suggestionState?.lockedCommand === 'gpt' ||
                suggestionState?.lockedCommand === 'perplexity' ||
                suggestionState?.lockedCommand === 'claude' ||
                suggestionState?.lockedCommand === 'gemini';
            if (!isInEditor && !isAiLocked && !isModalOpen() && !isWidgetEditMode && searchbarRef.current) {
                searchbarRef.current.focus({ preventScroll: true });
            }
        }, 0);
        return () => window.clearTimeout(focusTimeout);
    }, [
        selectedOrganisation,
        selectedSnippet,
        isCreatingNewItem,
        isModalOpen,
        suggestionState?.lockedCommand
    ]);
    useEffect(() => {
        const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
            suggestionState?.lockedCommand === 'gpt' ||
            suggestionState?.lockedCommand === 'perplexity' ||
            suggestionState?.lockedCommand === 'claude' ||
            suggestionState?.lockedCommand === 'gemini';
    }, [
        selectedOrganisation?.organisation_id,
        selectedSnippet,
        isCreatingNewItem,
        isModalOpen,
        suggestionState?.lockedCommand
    ]);
    // Auto-switch to editor when a snippet is selected (e.g. from CollectionGridView)
    useEffect(() => {
        if (selectedSnippet) {
            // Clear search bar command state when opening an editor from favorites or elsewhere
            // This ensures any pending "command pill" (e.g. /ai) is removed
            searchbarRef.current?.clear();
            // Removed destructive block that forced type: 'note', id: 'new' when selecting a snippet
        }
    }, [selectedSnippet, activeView?.type, snippetBreadCrum]);
    // Ensure search bar is cleared when creating a new item (but NOT for AI/agent editors which manage their own input)
    useEffect(() => {
        if (isCreatingNewItem &&
            activeEditor?.type !== 'ai' &&
            activeEditor?.type !== 'aiPrompt' &&
            activeEditor?.type !== 'agent') {
            searchbarRef.current?.clear();
        }
    }, [isCreatingNewItem, activeEditor?.type]);
    // Ensure search bar is cleared when link edit modal opens
    useEffect(() => {
        if (isLinkEditModalOpen) {
            searchbarRef.current?.clear();
        }
    }, [isLinkEditModalOpen]);
    // Ensure search bar is cleared when session editor opens
    useEffect(() => {
        if (activeEditor?.type === 'session') {
            searchbarRef.current?.clear();
        }
    }, [activeEditor?.type]);
    // Close active editors when AI command is locked (navigating to AI Chat Agent)
    useEffect(() => {
        const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
            suggestionState?.lockedCommand === 'gpt' ||
            suggestionState?.lockedCommand === 'perplexity' ||
            suggestionState?.lockedCommand === 'claude' ||
            suggestionState?.lockedCommand === 'gemini';
        if (isAiLocked && activeEditor && activeEditor.type !== 'ai' && activeEditor.type !== 'aiPrompt') {
            useUIStore.getState().closeEditor();
        }
    }, [suggestionState?.lockedCommand, activeEditor]);
    // CLEAR BREADCRUMB: Auto-switch back to home view when editor states are cleared
    useEffect(() => {
        const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
        // If we're in noteEditor mode but all the editor states are cleared, go back to home
        if (activeEditor?.type === 'note' &&
            !activeEditor?.props?.isOverlay &&
            !selectedSnippet &&
            !isCreatingNewItem &&
            !snippetBreadCrum &&
            !isEmbedded) {
            useUIStore.getState().setView({ type: 'home' });
        }
    }, [activeView?.type, selectedSnippet, isCreatingNewItem, snippetBreadCrum]);
    // NEW ITEM CREATION: Auto-switch to noteEditor when creating new item
    useEffect(() => {
        if (isCreatingNewItem &&
            activeEditor?.type !== 'note' &&
            activeEditor?.type !== 'snippet' &&
            activeEditor?.type !== 'link' &&
            activeEditor?.type !== 'session' &&
            activeEditor?.type !== 'ai' &&
            activeEditor?.type !== 'aiPrompt' &&
            activeEditor?.type !== 'agent' &&
            activeEditor?.type !== 'todo') {
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
        }
    }, [isCreatingNewItem, activeView?.type]);
    // Memoized selectedSnippet to prevent it from being lost during re-renders
    const memoizedSnippet = useRef(selectedSnippet);
    // Update the memoized value when the real value changes
    useEffect(() => {
        if (selectedSnippet) {
            memoizedSnippet.current = selectedSnippet;
        }
    }, [selectedSnippet]);
    // Use the memoized version if the real one is null but we have a breadcrumb
    const effectiveSnippet = isCreatingNewItem
        ? null
        : selectedSnippet || (snippetBreadCrum && memoizedSnippet.current);
    // Clear the memoized snippet when navigating back to workspace view or home
    useEffect(() => {
        // CLEAR BREADCRUMB: Clear memoized snippet when going back to workspace view OR home view
        // Original condition: selectedWorkspace && !snippetBreadCrum && !selectedSnippet
        // Updated to also clear when going to home (no workspace selected)
        if (!snippetBreadCrum && !selectedSnippet) {
            memoizedSnippet.current = null;
        }
    }, [selectedOrganisation, snippetBreadCrum, selectedSnippet]);
    const hasReloadedRef = useRef(false);
    useEffect(() => {
        const term = (debouncedSearchTerm || '').trim();
        if (term.length === 0 && !hasReloadedRef.current) {
            reload(); // âœ… trigger only once
            hasReloadedRef.current = true;
        }
        if (term.length > 0) {
            hasReloadedRef.current = false; // reset so reload can fire next time it's cleared
        }
    }, [debouncedSearchTerm, reload]);
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
        else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark, isSpreadsheetViewOpen]);
    const trimmedSearch = (debouncedSearchTerm || '').trim();
    const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
        suggestionState?.lockedCommand === 'gpt' ||
        suggestionState?.lockedCommand === 'claude' ||
        suggestionState?.lockedCommand === 'perplexity' ||
        suggestionState?.lockedCommand === 'gemini';
    const isStoreLocked = false;
    const hasSearchTerm = trimmedSearch.length > 0 ||
        searchValue.trim().length > 0 ||
        (suggestionState?.value?.trim().length ?? 0) > 0 ||
        ((suggestionState?.selectedImagesCount ?? 0) > 0 && !suggestionState?.lockedCommand);
    const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
    const shouldShowSuggestions = !isEmbedded &&
        (hasSearchTerm || suggestionState?.isVisible || isStoreLocked) &&
        !isAiLocked &&
        !isLinkEditModalOpen;
    const displayHomeView = !isEmbedded &&
        !isLinkEditModalOpen &&
        !selectedSnippet &&
        !isCreatingNewItem &&
        !activeEditor &&
        trimmedSearch.length === 0 &&
        !suggestionState?.lockedCommand &&
        !suggestionState?.isAtMenuOpen;
    const isNarrowView = (displayHomeView && !isStoreLocked) || (shouldShowSuggestions && !isStoreLocked);
    const isBoardViewOpen = !!(!isStoreLocked &&
        suggestionState &&
        shouldShowSuggestions &&
        suggestionState.isVisible !== false &&
        !suggestionState.isAtMenuOpen &&
        suggestionState.lockedCommand !== 'calendar' &&
        (activeView?.type !== 'allItems' || isStoreLocked) &&
        !isLinkEditModalOpen);
    const activeDashboardView = dashboardState?.views.find(view => view.id === dashboardState.activeViewId);
    const isWorkspaceCollectionView = activeView?.type === 'home' && displayHomeView && Boolean(activeDashboardView) && !isMainDashboardView(activeDashboardView);
    useEffect(() => {
        onBoardViewOpenChange?.(isBoardViewOpen);
    }, [isBoardViewOpen, onBoardViewOpenChange]);
    const actionOrganisation = selectedOrganisation ?? dbOrganisations[0] ?? null;
    const canCreateContent = Boolean(actionOrganisation);
    useEffect(() => {
        // Preserve user theme setting from AppearanceProvider
    }, []);
    const resolveOrganisation = (organisationOverride?: Organisation | null): Organisation | null => {
        if (organisationOverride)
            return organisationOverride;
        if (selectedOrganisation)
            return selectedOrganisation;
        return null; // Do NOT default to the first workspace automatically
    };
    const handleAddNote = (organisationOverride?: Organisation | null) => {
        // Only use an override or currently selected workspace; do NOT default to the first one in the team
        const organisationToUse = organisationOverride || selectedOrganisation;
        useUIStore.getState().setSnippetBreadcrumb({
            organisation_id: organisationToUse?.organisation_id,
            organisation_name: organisationToUse?.organisation_name,
        });
        // If we have a workspace, use it; otherwise clear the selection
        useUIStore.getState().setSelectedOrganisationId(organisationToUse ? organisationToUse.organisation_id : null);
        useUIStore.getState().setSelectedSnippetId(null);
    };
    const handleAddLink = (organisationOverride?: Organisation | null) => {
        const organisationToUse = resolveOrganisation(organisationOverride);
        if (!organisationToUse) {
            triggerNotification('Select or create an organisation first', 'info');
            return;
        }
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
    };
    const handleGoHome = () => {
        useUIStore.getState().clearEditorStates();
        useUIStore.getState().setSelectedOrganisationId(null);
        setSuggestionState(null);
        setSearchValue('');
        useUIStore.getState().returnToHome();
        // Focus search bar when going home (matching AltS behavior)
        setTimeout(() => {
            searchbarRef.current?.focus();
        }, 0);
    };
    const handleNavigateBack = useCallback((forceNavigate?: any) => {
        const shouldForce = forceNavigate === true;
        if (activeEditor?.props?.isOverlay && activeView?.type === 'knowledgeGraph') {
            useUIStore.getState().closeEditor();
            return;
        }
        const isEditorOpen = isLinkEditModalOpen ||
            isCreatingNewItem ||
            activeEditor !== null ||
            [
                'noteEditor',
                'linkEditor',
                'aiEditor',
                'agentPanel',
                'todos',
                'bulk',
                'createOrganisation'
            ].includes(activeView?.type);
        if (isEditorOpen || selectedSnippet) {
            useUIStore.getState().setSelectedSnippetId(null);
            useUIStore.getState().clearEditorStates();
            useUIStore.getState().setSelectedOrganisationId(null);
            useUIStore.getState().setSnippetBreadcrumb(null);
            setSuggestionState(null);
            setSearchValue('');
            useUIStore.getState().closeEditor();
            useUIStore.getState().setView({ type: 'home' });
            setTimeout(() => searchbarRef.current?.focus(), 0);
            return;
        }
        else if (selectedOrganisation) {
            // Logic for "Back" when inside a Workspace (going to Home)
            useUIStore.getState().setSelectedOrganisationId(null);
            useUIStore.getState().setSnippetBreadcrumb(null);
            // Collapse all workspaces in the sidebar
            useUIStore.getState().expandAllOrganisations({});
        }
        // Removed suggestion state and search clear to show results persistently during navigation
        // setSuggestionState(null);
        // setSearchValue('');
        // searchbarRef.current?.clear();
        setTimeout(() => searchbarRef.current?.focus(), 0);
    }, [
        selectedOrganisation,
        selectedSnippet,
        isCreatingNewItem,
        isLinkEditModalOpen,
        activeView?.type,
        activeEditor
    ]);
    const handleHomeLinkEdit = useCallback((item: SnippetSuggestion) => {
        const snippet = (item as any).item || (item as any).snippet;
        if (!snippet)
            return;
        const category = (snippet.category || '').toLowerCase();
        console.log('[handleHomeLinkEdit] Routing to LINK editor', { snippet });
        // All link types - route to the unified link editor, identical to prompts
        useUIStore.getState().openEditor({
            type: 'link',
            id: snippet.id || snippet.snippet_id || 'new',
            props: {
                snippet,
            },
        });
    }, []);
    const handleRequestOpenUrls = useCallback((urls: string[], title?: string) => {
        searchbarRef.current?.openUrls(urls, title);
    }, [searchbarRef]);
    const handleHomeSnippetSelect = useCallback(async (item: SnippetSuggestion) => {
        const searchItem = (item as any).item || (item as any).snippet;
        const { organisation } = item;
        if (!searchItem && organisation) {
            useUIStore.getState().setSelectedOrganisationId(organisation ? organisation.organisation_id : null);
            useUIStore.getState().setView({ type: 'home' });
            return;
        }
        if (!searchItem)
            return;
        const normalizedCategory = String(searchItem.category || '').toLowerCase();
        if (['aiprompt', 'ai_prompt', 'prompt'].includes(normalizedCategory)) {
            const promptId = String(searchItem.id || searchItem.snippet_id || '');
            const storedPrompt = useDbStore.getState().aiPrompts.find(prompt => String(prompt.id) === promptId);
            const promptRecord = storedPrompt || searchItem;
            searchbarRef.current?.clear();
            searchbarRef.current?.blur();
            requestMissingAiPromptInput({
                promptRecord,
                promptId: promptId || 'new',
                title: promptRecord.title || 'AI Prompt',
            });
            return;
        }
        // 2. Resolve action based on category
        const action = resolvePrimaryAction(searchItem.category);
        // 3. Handle specific actions with early returns
        if (searchItem.category === 'session') {
            const resolved = await resolveEntityById(searchItem.snippet_id || searchItem.id);
            const sessionRecord = resolved?.entity as any;
            let sessionUrls: string[] = [];
            let sessionNames: string[] = [];
            if (sessionRecord && Array.isArray(sessionRecord.urls)) {
                sessionUrls = sessionRecord.urls.map((u: any) => u.url);
                sessionNames = sessionRecord.urls.map((u: any) => u.title || u.name || '');
            }
            else {
                const itemValue = searchItem.value as any;
                if (itemValue && Array.isArray(itemValue.urls)) {
                    sessionUrls = itemValue.urls;
                }
                else if (Array.isArray(itemValue)) {
                    sessionUrls = itemValue;
                }
                sessionNames = Array.isArray(itemValue?.names) ? itemValue.names : [];
            }
            await launchSessionSmartWithReferences(sessionRecord || {
                id: searchItem.snippet_id || searchItem.id,
                title: searchItem.key || 'Untitled Tab Session',
                organisationId: organisation?.organisation_id,
                urls: sessionUrls.map((url, index) => ({
                    url,
                    name: sessionNames[index] || url,
                    title: sessionNames[index] || url,
                })),
                sessionOpenSettings: (searchItem as any).sessionOpenSettings,
            }, {
                source: 'search',
                requireAutoSave: false,
            });
            return;
        }
        if (action === 'open_multiple_links') {
            const urls = extractUrlsFromSnippet(searchItem);
            if (urls.length > 0) {
                handleRequestOpenUrls(urls, searchItem.key);
                return;
            }
            // Fallback to editor if no urls found
            useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { editMode: true, snippet: searchItem } });
            return;
        }
        if (action === 'edit_link') {
            useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { editMode: true, snippet: searchItem } });
            return;
        }
        // 4. Default: Note Editor
        // Ensure searchbar is cleared when entering editor
        if (searchbarRef.current) {
            searchbarRef.current.clear();
            searchbarRef.current.blur();
        }
        if (organisation) {
            useUIStore.getState().setSelectedOrganisationId(organisation ? organisation.organisation_id : null);
            useUIStore.getState().viewSnippet({
                snippet: searchItem,
                breadcrumb: {
                    organisation_id: organisation.organisation_id,
                    organisation_name: organisation.organisation_name,
                },
            });
        }
        useUIStore.getState().openEditor({
            type: 'note',
            id: searchItem.snippet_id || searchItem.id || 'new',
            props: {
                snippet: searchItem,
            },
        });
    }, [handleRequestOpenUrls, triggerNotification]);
    // Handle snippet selection from search (like AltS)
    const handleSearchSnippetSelect = useCallback((item: SnippetSuggestion) => {
        if (!item.organisation)
            return;
        // Clear and blur search bar (matching AltS behavior)
        if (searchbarRef.current) {
            searchbarRef.current.clear();
            searchbarRef.current.blur();
        }
        handleHomeSnippetSelect(item);
    }, [handleHomeSnippetSelect]);
    // Expose handler to parent (App) so it can pass to SideBar
    useEffect(() => {
        if (onSnippetSelectFromSearch) {
            (window as any).__containerSnippetSelectHandler = handleSearchSnippetSelect;
        }
    }, [handleSearchSnippetSelect, onSnippetSelectFromSearch]);
    const handleHomeDeleteRequest = useCallback(async (detail: SnippetActionDetail) => {
        if (!detail)
            return;
        storageDebug.warn('Container.handleHomeDeleteRequest', 'Delete requested from home/search UI', {
            detail,
        });
        const result = await executeItemDelete(detail, 'Container.handleHomeDeleteRequest');
        if (result.status !== 'skipped') {
            reload();
            storageDebug.warn('Container.handleHomeDeleteRequest', 'Delete completed', { detail });
            if (selectedSnippet &&
                (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)) {
                useUIStore.getState().setSelectedSnippetId(null);
                useUIStore.getState().setSnippetBreadcrumb(null);
            }
        }
        if (result.status === 'deleted-locally') {
            storageDebug.error('Container.handleHomeDeleteRequest', 'Delete failed', result.error, {
                detail,
            });
        }
    }, [reload, selectedSnippet]);
    const handleCloseHomeDeleteDialog = useCallback(() => {
        setHomeDeleteContext({ isOpen: false, detail: null });
    }, []);
    const handleConfirmHomeDelete = useCallback(async () => {
        const detail = homeDeleteContext.detail;
        if (!detail)
            return;
        // Close dialog immediately for better UX
        setHomeDeleteContext({ isOpen: false, detail: null });
        const result = await executeItemDelete(detail, 'Container.handleConfirmHomeDelete');
        if (result.status !== 'skipped') {
            reload();
            storageDebug.warn('Container.handleConfirmHomeDelete', 'Confirmed delete completed', { detail });
            if (selectedSnippet &&
                (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)) {
                useUIStore.getState().setSelectedSnippetId(null);
                useUIStore.getState().setSnippetBreadcrumb(null);
            }
        }
        if (result.status === 'deleted-locally') {
            storageDebug.error('Container.handleConfirmHomeDelete', 'Confirmed delete failed', result.error, {
                detail,
            });
        }
    }, [homeDeleteContext.detail, reload, selectedSnippet]);
    // Allow DefaultContainer (HomeView) to return focus back to the search bar
    const handleRequestFocusSearch = useCallback(() => {
        if (searchbarRef.current) {
            searchbarRef.current.focus();
        }
    }, [searchbarRef]);
    // Handle command preview (matching AltS behavior)
    // This must clear immediately when navigating to notes to ensure icon updates synchronously.
    const handleCommandPreview = useCallback((commandId: CommandId | 'ai' | null) => {
        if (!searchbarRef.current)
            return;
        if (commandId) {
            searchbarRef.current.previewCommand(commandId);
        }
        else {
            searchbarRef.current.clearCommandPreview();
        }
    }, []);
    // Global keyboard handler for closing command list with Escape/Backspace
    const handleInteractiveItemHighlight = useCallback((item: InteractiveItem | null) => {
        if (!searchbarRef.current)
            return;
        if (!item) {
            // When nothing is highlighted, clear any command preview.
            searchbarRef.current.clearCommandPreview();
            return;
        }
        if (item.kind === 'command') {
            // For commands: DON'T change the typed value (no "/g", "/ai" injection).
            // HomeView already calls onCommandPreview, which updates the icon and inline box.
            return;
        }
        // For notes/links: clear any previous command preview so we fall back to default search icon.
        searchbarRef.current.clearCommandPreview();
    }, []);
    const handleCommandExecute = useCallback(async (commandId: CommandId | LocalCommandId | 'ai', options?: {
        prompt?: string;
        files?: {
            base64: string;
            filename: string;
        }[];
    }) => {
        console.log('[Container] handleCommandExecute called with:', commandId, options);
        const alreadyTracked = Boolean((options as any)?.__tracked);
        if (!alreadyTracked) {
        }
        // Close the Link Edit Modal first (explicit dispatch) before clearing other states
        if (isLinkEditModalOpen) {
        }
        // Explicitly clear any active editor states before running a command
        // This ensures a clean transition (closing notes/links) as requested by the user.
        useUIStore.getState().clearEditorStates();
        // Clear search bar and suggestions for instant feedback
        // Keep view-locking commands from clearing the search bar.
        if ((commandId as any) !== 'store') {
            setSearchValue('');
            setSuggestionState(null);
            searchbarRef.current?.clear();
        }
        const context: CommandContext = {
            prompt: options?.prompt,
            files: options?.files,
            state: useDbStore.getState(),
            services: getCommandServices(useDbStore.getState(), {
                toast: (msg, type) => triggerNotification(msg, type || 'info'),
                navigation: (view: any) => {
                    // Handle specific view requests from commands
                    if (view.kind === 'noteEditor') {
                        console.log('[Container] Navigation requested for noteEditor');
                        useUIStore.getState().openEditor({ type: 'note', id: 'new', props: view.noteProps });
                    }
                    else if (view.kind === 'linkEditor') {
                        console.log('[Container] Navigation requested for linkEditor');
                        useUIStore.getState().openEditor({ type: 'link', id: 'new', props: view.linkProps });
                    }
                    else if (view.kind === 'sessionEditor') {
                        useUIStore.getState().openEditor({ type: 'session', id: 'new', props: view.sessionProps });
                    }
                    else if (view.kind === 'agentPanel') {
                        useUIStore.getState().openEditor({ type: 'agent', id: 'new', props: view.agentProps });
                    }
                    else if (view.kind === 'custom') {
                        if (commandId === 'createprompt') {
                            useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
                        }
                    }
                    else if (view.kind === 'store') {
                        useUIStore.getState().setView({ type: 'store' });
                    }
                    else if (view.kind === 'allItems') {
                        // Don't clear search bar - user can filter items using main searchbar
                        setSuggestionState(null);
                        useUIStore.getState().setView({ type: 'allItems', itemType: view.itemType });
                        // Ensure focus logic runs after render
                        setTimeout(() => {
                            searchbarRef.current?.focus();
                        }, 10);
                    }
                    else if (view.kind === 'createOrganisation') {
                        // Workspace creation is only allowed from onboarding for now.
                        // useUIStore.getState().openCreateWorkspace();
                    }
                    else if (commandId === 'showallnotes') {
                        setSuggestionState(null);
                        useUIStore.getState().setView({ type: 'allItems', itemType: 'notes' });
                        // Ensure focus logic runs after render
                        setTimeout(() => {
                            searchbarRef.current?.focus();
                        }, 10);
                    }
                    else if (commandId === 'showalllinks') {
                        setSuggestionState(null);
                        useUIStore.getState().setView({ type: 'allItems', itemType: 'links' });
                        // Ensure focus logic runs after render
                        setTimeout(() => {
                            searchbarRef.current?.focus();
                        }, 10);
                    }
                },
                reload: handleReload,
            }),
        };
        if ((commandId as string) === 'collections') {
            setSuggestionState(null);
            if (onOpenSpreadsheetMainContainer) {
                onOpenSpreadsheetMainContainer('collections');
            }
            else {
                useUIStore.getState().openSheet('collections');
            }
            return;
        }
        if (commandId === 'showallnotes') {
            useUIStore.getState().setView({ type: 'allItems', itemType: 'notes' });
            setSuggestionState(null);
            setTimeout(() => searchbarRef.current?.focus(), 0);
            return;
        }
        if (commandId === 'showalllinks') {
            useUIStore.getState().setView({ type: 'allItems', itemType: 'links' });
            setSuggestionState(null);
            setTimeout(() => searchbarRef.current?.focus(), 0);
            return;
        }
        if (executeRetiredCreateUiAction(commandId as string)) {
            return;
        }
        await commandRegistry.execute(commandId as string, context);
    }, [triggerNotification, handleReload, onNavigateToListView, onCommandListCategoryChange]);
    // Handle Link Creation
    // Removed broken useEffect that unconditionally forced link editor on any new item creation
    // Handle Note Creation - switch to noteEditor when creating new note
    useEffect(() => {
        if (isCreatingNewItem &&
            snippetBreadCrum &&
            (snippetBreadCrum.organisation_id) &&
            activeEditor?.type !== 'link' &&
            activeEditor?.type !== 'session' &&
            activeEditor?.type !== 'todo' &&
            activeEditor?.type !== 'agent' &&
            activeEditor?.type !== 'ai' &&
            activeEditor?.type !== 'aiPrompt') {
            // If we are already in noteEditor, don't re-navigate (which clears props)
            if (activeEditor?.type === 'note') {
                return;
            }
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
        }
    }, [isCreatingNewItem, snippetBreadCrum, activeView?.type]);
    // â”€â”€â”€ Todo Conversion List Building & Save Handlers â”€â”€â”€
    const dbConvertibleItems = useConvertibleItems();
    const convertibleItems = useMemo(() => {
        return [...dbConvertibleItems];
    }, [dbConvertibleItems]);
    const finalConvertibleItems = useMemo(() => {
        return [...convertibleItems];
    }, [convertibleItems]);
    const handleCreateFromSelection = async (data: any) => {
        const chromeAny = (window as any).chrome;
        const cleanId = (id: string): string => {
            const idStr = String(id);
            if (idStr.includes('-') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)) {
                return idStr.split('-').slice(1).join('-');
            }
            return idStr;
        };
        try {
            const snippetId = data.item?.id || data.item?.snippet_id;
            if (!snippetId && data.type !== 'custom')
                throw new Error('Failed to identify item ID');
            let deadline = data.deadline || '';
            const isAnytime = !!data.isAnytime;
            if (!deadline && !isAnytime) {
                try {
                    if (data.date) {
                        const [year, month, day] = data.date.split('-').map(Number);
                        const [hour, minute] = data.time ? data.time.split(':').map(Number) : [23, 59];
                        const dt = new Date(year, month - 1, day, hour, minute);
                        if (!isNaN(dt.getTime())) {
                            deadline = dt.toISOString();
                        }
                    }
                }
                catch (e) {
                    console.warn('[Container] Failed to parse date/time:', e);
                }
            }
            if (isAnytime) {
                try {
                    let dt = new Date();
                    const nowMs = Date.now();
                    const eodMs = new Date().setHours(23, 59, 59, 999);
                    if (data.date) {
                        const [year, month, day] = data.date.split('-').map(Number);
                        const targetDate = new Date(year, month - 1, day);
                        if (isSameDay(targetDate, new Date())) {
                            const randomMs = Math.floor(Math.random() * (eodMs - nowMs));
                            dt = new Date(nowMs + randomMs);
                        }
                        else {
                            dt = targetDate;
                            dt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0);
                        }
                    }
                    else {
                        const randomMs = Math.floor(Math.random() * (eodMs - nowMs));
                        dt = new Date(nowMs + randomMs);
                    }
                    if (!isNaN(dt.getTime())) {
                        deadline = dt.toISOString();
                    }
                }
                catch (e) {
                    console.warn('[Container] Failed to set anytime deadline:', e);
                    deadline = nowUtc();
                }
            }
            // Save or Update todo
            const existingTodoId = data.todoId ||
                todoCreatePrefill?.todo_id ||
                (todoCreatePrefill?.snippet_id && todoCreatePrefill?.is_todo_type ? todoCreatePrefill.snippet_id : undefined);
            if (existingTodoId) {
                const nextScheduleTime = new Date(deadline).getTime();
                const previousScheduleTime = typeof todoCreatePrefill?.scheduleTime === 'number'
                    ? todoCreatePrefill.scheduleTime
                    : todoCreatePrefill?.event_deadline
                        ? new Date(String(todoCreatePrefill.event_deadline).replace(' ', 'T')).getTime()
                        : NaN;
                const shouldReactivateTodo = Number.isFinite(nextScheduleTime) &&
                    nextScheduleTime > Date.now() &&
                    (!Number.isFinite(previousScheduleTime) || Math.abs(nextScheduleTime - previousScheduleTime) >= 60000);
                const sid = todoCreatePrefill?.snippet_id ? String(todoCreatePrefill.snippet_id) : '';
                const hasConfigIds = Array.isArray(data.selectedItems) && data.selectedItems.length > 0;
                const configFromSelection = hasConfigIds
                    ? {
                        id: (data.selectedItems as any[]).map((i: any) => {
                            return String(cleanId(i.id));
                        }),
                        title: data.title,
                    }
                    : {
                        id: sid ? [String(cleanId(sid))] : [],
                        title: data.title,
                    };
                console.log('[Container] Update Todo Details Received:', {
                    todo_id: existingTodoId,
                    sid,
                    title: data.title,
                    shortcut: data.shortcut,
                    tags: data.tags,
                });
                if (sid && sid.startsWith('local-')) {
                    if (chromeAny?.storage?.local) {
                        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                        const localTodos = result.local_todos || [];
                        const updated = localTodos.map((t: any) => String(t.snippet_id || t.id) === sid
                            ? {
                                ...t,
                                key: data.title,
                                title: data.title,
                                value: data.description,
                                event_deadline: deadline,
                                is_recurring: data.scheduleType === 'recurring',
                                recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                                is_anytime: isAnytime,
                                is_done: shouldReactivateTodo ? false : t.is_done,
                                config: configFromSelection,
                                tags: data.tags || [],
                                shortcut: data.shortcut || '',
                            }
                            : t);
                        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
                    }
                }
                else {
                    if (chromeAny?.storage?.local) {
                        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                        const localTodos = result.local_todos || [];
                        const bestTodoId = existingTodoId;
                        const updated = localTodos.map((t: any) => String(t.snippet_id || t.id || t.todo_id) === String(bestTodoId || sid)
                            ? {
                                ...t,
                                key: data.title,
                                title: data.title,
                                value: data.description,
                                event_deadline: deadline,
                                is_recurring: data.scheduleType === 'recurring',
                                recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                                is_done: shouldReactivateTodo ? false : todoCreatePrefill?.is_done,
                                config: configFromSelection,
                                tags: data.tags || [],
                                shortcut: data.shortcut || '',
                            }
                            : t);
                        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
                    }
                    try {
                        const bestTodoId = existingTodoId;
                        if (sid) {
                            try {
                                await updateSnippet(sid, {
                                    config: configFromSelection,
                                });
                            }
                            catch (updateErr) {
                                console.warn('[Container] updateSnippet failed (item may not be a snippet):', updateErr);
                            }
                        }
                    }
                    catch (cloudError) {
                        console.error('[Container] Cloud sync failed for edit:', cloudError);
                    }
                    // Update Dexie database
                    try {
                        const todoId = String(existingTodoId || sid);
                        const updateReferences = Array.isArray(data.selectedItems) && data.selectedItems.length > 0
                            ? mapTodoReferences(data.selectedItems)
                            : [];
                        console.log('[Container] Dexie Update parameters:', {
                            todoId,
                            name: data.title,
                            tags: data.tags,
                            shortcut: data.shortcut,
                        });
                        await db.todos.update(todoId, {
                            name: data.title,
                            description: data.description,
                            scheduleTime: nextScheduleTime,
                            recurringType: (data.recurringCycle as any),
                            scheduleType: data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
                            references: updateReferences,
                            tagIds: data.tagIds || [],
                            shortcut: data.shortcut || '',
                            ...(shouldReactivateTodo ? { isDone: false } : {}),
                            updatedAt: Date.now(),
                        });
                        if (data.shortcut !== undefined) {
                            if (data.shortcut) {
                                await saveShortcut(todoId, todoId, data.shortcut, data.title, 'todo');
                            }
                            else {
                                await clearShortcut(todoId, todoId, 'todo');
                            }
                        }
                        if (data.hotkey !== undefined) {
                            if (data.hotkey) {
                                await saveHotkey(todoId, todoId, data.hotkey, 'todo');
                            }
                            else {
                                await clearHotkey(todoId, todoId, 'todo');
                            }
                        }
                        if (data.isFavorite !== undefined) {
                            const currentFavs = useDbStore.getState().favorites || [];
                            const isFav = currentFavs.some((f: any) => f.reference_id === todoId);
                            if (data.isFavorite !== isFav) {
                                await toggleFavoriteRecord(userId || 'local_user', todoId, 'todo', data.title);
                            }
                        }
                    }
                    catch (dbError) {
                        console.error('[Container] Failed to update Dexie todo:', dbError);
                    }
                    if (chromeAny?.runtime?.sendMessage) {
                        chromeAny.runtime.sendMessage({
                            action: 'schedule_todo_alarm',
                            todoId: String(existingTodoId || sid),
                            deadline: deadline || nowUtc(),
                            is_anytime: isAnytime,
                        });
                    }
                }
            }
            else if (['custom'].includes(data.type)) {
                const storageResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['lastNoteDestination', 'user', 'local_todos'], resolve));
                const lastDest = storageResult.lastNoteDestination;
                const localTodos = storageResult.local_todos || [];
                let targetOrganisationId = lastDest?.organisation_id;
                if (!targetOrganisationId && dbOrganisations.length > 0) {
                    targetOrganisationId = dbOrganisations[0].id;
                }
                const taskValue = data.description;
                let todoIdVal = generateEntityId('todo');
                // Save to Dexie database first to get the correct entity ID
                try {
                    const newTodo = await createTodo(data.title, [], data.scheduleType === 'recurring' ? 'recurring' : 'one-time', new Date(deadline).getTime(), data.scheduleType === 'recurring' ? data.recurringCycle : undefined, data.description);
                    if (newTodo && newTodo.id) {
                        todoIdVal = newTodo.id;
                        await db.todos.update(todoIdVal, {
                            tagIds: data.tagIds || [],
                            shortcut: data.shortcut || '',
                        });
                        if (data.shortcut) {
                            await saveShortcut(todoIdVal, todoIdVal, data.shortcut, data.title, 'todo');
                        }
                        if (data.hotkey) {
                            await saveHotkey(todoIdVal, todoIdVal, data.hotkey, 'todo');
                        }
                        if (data.isFavorite) {
                            await toggleFavoriteRecord(userId || 'local_user', todoIdVal, 'todo', data.title);
                        }
                    }
                }
                catch (dbError) {
                    console.error('[Container] Failed to create Dexie todo (custom):', dbError);
                }
                const optimisticTask: any = {
                    snippet_id: todoIdVal,
                    id: todoIdVal,
                    todo_id: todoIdVal,
                    key: data.title,
                    title: data.title,
                    value: taskValue,
                    category: 'note',
                    created_at: nowUtc(),
                    updated_at: nowUtc(),
                    event_deadline: deadline,
                    is_done: false,
                    is_todo_type: true,
                    is_recurring: data.scheduleType === 'recurring',
                    recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                    organisation_id: targetOrganisationId,
                    is_anytime: isAnytime,
                    tags: data.tags || [],
                    shortcut: data.shortcut || '',
                };
                await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: [optimisticTask, ...localTodos] }, resolve));
                if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({
                        action: 'schedule_todo_alarm',
                        todoId: String(todoIdVal),
                        deadline: deadline || nowUtc(),
                        is_anytime: isAnytime,
                    });
                }
            }
            else {
                const rawId = String(snippetId).includes('-') &&
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(snippetId))
                    ? String(snippetId).split('-').slice(1).join('-')
                    : snippetId;
                let savedTodoId = String(rawId || '');
                const cat = data.type || 'note';
                const hasConfigIds = Array.isArray(data.selectedItems) && data.selectedItems.length > 0;
                const configFromSelection = hasConfigIds
                    ? {
                        id: (data.selectedItems as any[]).map((i: any) => {
                            return String(cleanId(i.id));
                        }),
                        title: data.title,
                    }
                    : data.item?.config?.id
                        ? {
                            id: (data.item.config.id as any[]).map(id => String(cleanId(id))),
                            title: data.title,
                        }
                        : {
                            id: [String(cleanId(rawId))],
                            title: data.title,
                        };
                const optimisticTask: any = {
                    snippet_id: String(rawId),
                    key: data.title,
                    title: data.title,
                    value: ['command', 'agent', 'chat_agent'].includes(cat)
                        ? data.item?.id || data.item?.snippet_id || data.description
                        : data.description,
                    category: cat,
                    created_at: nowUtc(),
                    updated_at: nowUtc(),
                    event_deadline: deadline,
                    is_done: false,
                    is_todo_type: true,
                    is_recurring: data.scheduleType === 'recurring',
                    recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                    organisation_id: data.organisationId || data.item?.organisation_id,
                    tagIds: data.tagIds || [],
                    is_anytime: isAnytime,
                    config: configFromSelection,
                };
                // Save to Dexie database
                try {
                    let references: any[] = [];
                    if (Array.isArray(data.selectedItems)) {
                        references = mapTodoReferences(data.selectedItems);
                    }
                    else if (data.item) {
                        references = [
                            {
                                type: data.type || 'note',
                                id: rawId,
                                name: data.item.name || data.item.title || data.item.key || data.item.label || data.title,
                            }
                        ];
                    }
                    const newTodo = await createTodo(data.title, references, data.scheduleType === 'recurring' ? 'recurring' : 'one-time', new Date(deadline).getTime(), data.scheduleType === 'recurring' ? data.recurringCycle : undefined, data.description);
                    if (newTodo && newTodo.id) {
                        savedTodoId = String(newTodo.id);
                        const compoundId = getItemCompoundId({
                            id: newTodo.id,
                            organisation_id: data.organisationId,
                            snippet: { id: newTodo.id, category: 'todo' },
                        });
                        await db.todos.update(newTodo.id, {
                            tagIds: data.tagIds || [],
                            organisationId: data.organisationId,
                            shortcut: data.shortcut || '',
                        } as any);
                        if (data.shortcut) {
                            await saveShortcut(newTodo.id, compoundId, data.shortcut, data.title, 'todo');
                        }
                        if (data.hotkey) {
                            await saveHotkey(newTodo.id, compoundId, data.hotkey, 'todo');
                        }
                        if (data.isFavorite) {
                            await toggleFavoriteRecord(userId || 'local_user', newTodo.id, 'todo', data.title);
                        }
                    }
                }
                catch (dbError) {
                    console.error('[Container] Failed to create Dexie todo (selection):', dbError);
                }
                if (chromeAny?.storage?.local) {
                    const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                    const localTodos = result.local_todos || [];
                    await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: [optimisticTask, ...localTodos] }, resolve));
                }
                const finalTask = { ...optimisticTask, todo_id: String(rawId) };
                const freshResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
                const freshTodos = (freshResult.local_todos || []).map((t: any) => t.snippet_id === String(rawId) ? finalTask : t);
                await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: freshTodos }, resolve));
                if (rawId) {
                    try {
                        await updateSnippet(rawId, {
                            config: configFromSelection,
                        });
                    }
                    catch (updateErr) {
                        console.warn('[Container] updateSnippet failed (item may not be a snippet):', updateErr);
                    }
                }
                if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({
                        action: 'schedule_todo_alarm',
                        todoId: savedTodoId || String(rawId),
                        deadline: deadline || nowUtc(),
                        is_anytime: isAnytime,
                    });
                }
            }
            window.dispatchEvent(new CustomEvent('todosUpdated'));
        }
        catch (e) {
            console.error('[Container] handleCreateFromSelection failed:', e);
            throw e;
        }
    };
    // We no longer move focus explicitly from the search bar into HomeView here.
    // DefaultContainer listens to global keydown events (like AltS) and
    // handles ArrowUp/ArrowDown navigation while the search input stays focused.
    const isBoardSlashDropdownActive = useMemo(() => {
        if (suggestionState?.showEmptySlashDropdown)
            return true;
        const val = (suggestionState?.value || '').replace(/\u00A0/g, ' ');
        if (!val.startsWith('/'))
            return false;
        const textAfterSlash = val.slice(1).toUpperCase();
        const aliases = ['A', 'T', 'N', 'S', 'P', 'L', 'C', 'B'];
        const hasSpaceMatch = aliases.some(alias => textAfterSlash.startsWith(alias + ' '));
        return !hasSpaceMatch;
    }, [suggestionState?.value, suggestionState?.showEmptySlashDropdown]);
    // Determines what to render in the main content area
    const renderMainContent = () => {
        if (activeView?.type === 'timeline' && !activeEditor) {
            return <TimelineView/>;
        }
        if (activeView?.type === 'collections') {
            return <CollectionsView/>;
        }
        // Priority -1: Sheet UI
        let sheetBackground: React.ReactNode = null;
        if (isSpreadsheetViewOpen) {
            sheetBackground = (<div className="flex-1 w-full flex overflow-auto p-[1px] relative">
          {/* Organization/workspace creation is only allowed from onboarding for now.
                                                        Previously passed onCreateOrganization={handleCreateOrganization} and onCreateWorkspace={onCreateWorkspace}. */}
          <SpreadsheetMainContainer onClose={onCloseSpreadsheetMainContainer} savedAgents={savedAiAgents} onOrganizationSettings={handleOrganizationSettings} onBoardViewRedirect={onBoardViewRedirect}/>
        </div>);
            // If we are not opening an overlay editor, just return the spreadsheet UI
            if (!activeEditor?.props?.isOverlay) {
                return sheetBackground;
            }
        }
        const returnToCollectionSheet = () => {
            const editorType = activeEditor?.type;
            if (editorType === 'link') {
                useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { category: 'link' } });
                return true;
            }
            if (editorType === 'todo') {
                useUIStore.getState().openEditor({ type: 'todo', id: 'new' });
                return true;
            }
            if (editorType === 'snippet') {
                useUIStore.getState().setSelectedSnippet(null);
                useUIStore.getState().setSelectedSnippetId(null);
                useUIStore.getState().setSnippetBreadcrumb(null);
                useUIStore.getState().openEditor({
                    type: 'snippet',
                    id: 'new',
                    props: {
                        category: 'snippet',
                        snippet: null,
                        item: null,
                        prefill: null,
                        initialDraftKey: null,
                        initialDraftContent: null,
                    },
                });
                return true;
            }
            if (editorType === 'aiPrompt') {
                useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true });
                return true;
            }
            return false;
        };
        const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
            suggestionState?.lockedCommand === 'gpt' ||
            suggestionState?.lockedCommand === 'claude' ||
            suggestionState?.lockedCommand === 'perplexity' ||
            suggestionState?.lockedCommand === 'gemini';
        if (activeEditor?.type === 'ai' || (isAiLocked && !activeEditor)) {
            const aiState = suggestionState || {
                lockedCommand: 'ai',
                value: '',
                isSuggestionVisible: false,
                showAIHistoryPanel: false,
                isVisible: true,
                selectedAIs: [],
            };
            return (<div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div className="flex-1 h-full min-h-0 relative rounded-xl dark:rounded-none overflow-visible" style={{ border: 'none' }}>
            <ChatAgent key="ai-editor" state={aiState as SuggestionState} initialTab="agents" isMac={isMac} onSelectSavedAgent={handleSelectSavedAgent} onQueryChange={handleAIQueryChange} onClose={() => {
                    handleNavigateBack();
                }}/>
          </div>
        </div>);
        }
        // Priority 1: Editor
        const showEditor = activeEditor?.type === 'note' || activeEditor?.type === 'snippet' || activeEditor?.type === 'link';
        if (activeEditor?.type === 'session') {
            const editorComponent = (<div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-visible">
            <SessionEditorView isOpen={true} onClose={() => useUIStore.getState().closeEditor()} session={activeEditor?.props?.session || activeEditor?.props?.snippet} prefill={activeEditor?.props?.prefill} reload={reload}/>
          </div>
        </div>);
            if (activeEditor?.props?.isOverlay && sheetBackground) {
                return (<div className="relative w-full h-full flex flex-col overflow-hidden">
            {sheetBackground}
            <div className="fixed inset-0 z-[10000] backdrop-blur-md bg-black/50 flex flex-col overflow-y-auto">
              {editorComponent}
            </div>
          </div>);
            }
            return editorComponent;
        }
        if (activeEditor?.type === 'todo') {
            const editorComponent = (<div className="flex-1 min-h-0">
          <div className="h-full w-full flex flex-col overflow-visible">
            <CreateTodoView key={`todo-editor-${activeEditor?.id || 'new'}-${activeEditor?.openInstanceId || 0}`} isOverlay={Boolean(activeEditor?.props?.isOverlay)} items={finalConvertibleItems} onCreateTodo={async (data: any) => {
                    await handleCreateFromSelection(data);
                    if (!data.createMore) {
                        useUIStore.getState().setTodoCreatePrefill(null);
                        setActiveTodoId(null);
                        if (!data.returnToTodoSheet) {
                            useUIStore.getState().closeEditor();
                        }
                    }
                    else {
                        useUIStore.getState().setTodoCreatePrefill(null);
                        setActiveTodoId(null);
                        const currentProps = useUIStore.getState().activeEditor?.props || {};
                        const cleanProps = {
                            ...currentProps,
                            item: null,
                            snippet: null,
                            prefill: null,
                            initialTitle: null,
                            initialDescription: null,
                            initialDraftKey: null,
                            initialDraftContent: null,
                            keepSheetCreateEditorOpen: true,
                        };
                        useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: cleanProps });
                    }
                }} initialItem={todoCreatePrefill ||
                    activeEditor?.props?.prefill ||
                    activeEditor?.props?.item ||
                    activeEditor?.props?.snippet} isEditMode={!!(todoCreatePrefill?.todo_id ||
                    activeEditor?.props?.prefill?.todo_id ||
                    activeEditor?.props?.item?.id ||
                    activeEditor?.props?.snippet?.id ||
                    (activeEditor?.id && activeEditor.id !== 'new' && activeEditor.id !== 'todo-create'))} onClose={() => {
                    useUIStore.getState().setTodoCreatePrefill(null);
                    if (activeEditor?.props?.returnToCollectionSheet && returnToCollectionSheet()) {
                        setActiveTodoId(null);
                        return;
                    }
                    useUIStore.getState().closeEditor();
                    setActiveTodoId(null);
                }} existingTodos={dbTodos} activeTodoId={activeTodoId ||
                    (activeEditor?.id === 'new' || activeEditor?.id === 'todo-create' ? null : activeEditor?.id)} onLoadTodo={handleLoadTodo} onDeleteTodo={handleDeleteTodoById} hotkeysMap={dbHotkeysMap} onUpdateItemField={handleUpdateTodoField} hideRightPanel={Boolean(activeEditor?.props?.hideRightPanel)}/>
          </div>
        </div>);
            if (activeEditor?.props?.isOverlay && sheetBackground) {
                return (<div className="relative w-full h-full flex flex-col overflow-hidden">
            {sheetBackground}
            <div style={FUNCTIONAL_EDITOR_SURFACE_STYLE} className="fixed inset-0 z-[10000] backdrop-blur-md bg-black/50 flex flex-col overflow-y-auto">
              {editorComponent}
            </div>
          </div>);
            }
            const isNormalTodoMode = !activeEditor?.props?.isOverlay && !isFocusMode;
            return (<div className={`flex-1 min-h-0 pt-6 ${isNormalTodoMode ? 'bg-[var(--color-editorBg)] has-[[data-black-editor-surface=true]]:!bg-[var(--color-rootBg)] h-full w-full' : ''}`}>
          <div className="h-full w-full flex flex-col overflow-visible">{editorComponent}</div>
        </div>);
        }
        // Agent Panel
        if (activeEditor?.type === 'agent') {
            const aiState = suggestionState || {
                lockedCommand: 'ai',
                value: '',
                isSuggestionVisible: false,
                showAIHistoryPanel: false,
                isVisible: true,
                selectedAIs: [],
            };
            return (<div className="flex-1 min-h-0 w-full flex flex-col items-center transition-all duration-300 px-4">
          <div className="h-[90%] flex justify-center bg-transparent transition-all duration-300 rounded-xl overflow-hidden w-full max-w-[1440px] ">
            <div className={`flex flex-col overflow-hidden transition-all duration-[400ms] ease-in-out rounded-xl  shadow-2xl border border-white/10 w-full max-w-[840px] md:min-w-[840px]`}>
              <ChatAgent key={`agent-editor-${activeEditor.id || 'new'}`} state={aiState as SuggestionState} initialTab="agents" isMac={isMac} onSelectSavedAgent={handleSelectSavedAgent} onQueryChange={handleAIQueryChange} onClose={handleNavigateBack}/>
            </div>
          </div>
        </div>);
        }
        // AI Prompt Generator
        if (activeEditor?.type === 'aiPrompt') {
            const aiPromptCreationContext = activeEditor?.props?.aiPromptWidgetCreationContext;
            const activeAiPromptRecord = activeEditor?.props?.item ||
                activeEditor?.props?.snippet ||
                (activeEditor?.id && activeEditor.id !== 'new'
                    ? dbAiPrompts.find(prompt => String(prompt.id) === String(activeEditor.id))
                    : null);
            const activeAiPromptTagIds = Array.isArray(activeAiPromptRecord?.tagIds)
                ? activeAiPromptRecord.tagIds.map((tagId: unknown) => String(tagId || '').trim()).filter(Boolean)
                : undefined;
            const aiPromptInitialTagIds = aiPromptCreationContext?.sourceMode === 'tags'
                ? aiPromptCreationContext.selectedTagIds
                : activeAiPromptTagIds;
            const aiPromptInitialTitle = typeof activeAiPromptRecord?.title === 'string'
                ? activeAiPromptRecord.title
                : typeof activeAiPromptRecord?.name === 'string'
                    ? activeAiPromptRecord.name
                    : undefined;
            const aiPromptInitialPrompt = typeof activeAiPromptRecord?.prompt === 'string'
                ? activeAiPromptRecord.prompt
                : typeof activeAiPromptRecord?.description === 'string'
                    ? activeAiPromptRecord.description
                    : typeof activeAiPromptRecord?.content === 'string'
                        ? activeAiPromptRecord.content
                        : undefined;
            const aiPromptInitialModelUrls = activeAiPromptRecord?.modelUrls && typeof activeAiPromptRecord.modelUrls === 'object'
                ? Object.fromEntries(Object.entries(activeAiPromptRecord.modelUrls)
                    .map(([modelId, url]) => [modelId, typeof url === 'string' ? url : String(url || '')] as [
                    string,
                    string
                ])
                    .filter(([, url]) => url))
                : undefined;
            const handleAiPromptCreated = async (createdPrompt: any) => {
                if (!aiPromptCreationContext)
                    return;
                const { widgetId, viewId, sourceMode } = aiPromptCreationContext;
                if (sourceMode === 'manual') {
                    try {
                        let currentWidget: any = null;
                        let currentSettings: any = {};
                        let currentSourceMode = 'all';
                        const dbWidget = await db.widgets.get(widgetId);
                        if (dbWidget && dbWidget.viewId === viewId) {
                            currentSettings = dbWidget.settings || {};
                            currentSourceMode = currentSettings.sourceMode || 'all';
                            currentWidget = dbWidget;
                        }
                        if (!currentWidget)
                            return;
                        if (currentSourceMode !== 'manual')
                            return;
                        const existingPromptIds: string[] = Array.isArray(currentSettings.selectedPromptIds)
                            ? currentSettings.selectedPromptIds
                            : [];
                        if (!existingPromptIds.includes(createdPrompt.id)) {
                            const updatedPromptIds = [...existingPromptIds, createdPrompt.id];
                            await updateWidgetSettingsAsync(viewId, widgetId, {
                                ...currentSettings,
                                selectedPromptIds: updatedPromptIds,
                            });
                        }
                    }
                    catch (err) {
                        console.error('[Container] Failed to append created AI prompt to Custom widget settings:', err);
                    }
                }
            };
            const editorComponent = (<div className="flex-1 min-h-0">
          <div className="h-full w-full flex flex-col overflow-visible">
            <AiPromptEditorView key={`ai-prompt-editor-${activeEditor?.id || 'new'}-${activeEditor?.openInstanceId || 0}`} aiPromptId={activeEditor?.id === 'new' ? null : activeEditor?.id} onBack={() => {
                    if (activeEditor?.props?.returnToCollectionSheet && returnToCollectionSheet()) {
                        return;
                    }
                    useUIStore.getState().closeEditor();
                    if (!activeEditor?.props?.isOverlay && !activeEditor?.props?.returnToTimeline) {
                        useUIStore.getState().setView({ type: 'home' });
                    }
                }} initialTitle={aiPromptInitialTitle} initialPrompt={aiPromptInitialPrompt} initialModelUrls={aiPromptInitialModelUrls} initialTagIds={aiPromptInitialTagIds} onAiPromptCreated={handleAiPromptCreated} isFullScreenMode={false} isOverlay={Boolean(activeEditor?.props?.isOverlay)}/>
          </div>
        </div>);
            if (activeEditor?.props?.isOverlay && sheetBackground) {
                return (<div className="relative w-full h-full flex flex-col overflow-hidden">
            {sheetBackground}
            <div style={FUNCTIONAL_EDITOR_SURFACE_STYLE} className="fixed inset-0 z-[10000] backdrop-blur-md bg-black/50 flex flex-col overflow-y-auto">
              {editorComponent}
            </div>
          </div>);
            }
            const isNormalAiPromptMode = !activeEditor?.props?.isOverlay && !isFocusMode;
            return (<div className={`flex-1 min-h-0 pt-6 ${isNormalAiPromptMode ? 'bg-[var(--color-editorBg)] has-[[data-black-editor-surface=true]]:!bg-[var(--color-rootBg)] h-full w-full' : ''}`}>
          <div className="h-full w-full flex flex-col overflow-visible">{editorComponent}</div>
        </div>);
        }
        if (showEditor) {
            // Determine based on category:
            // If category is explicitly 'note', use SnippetEditor (Dynamic)
            // Else (including 'snippet' or undefined), use RichTextEditor (Standard)
            // Wait, previous logic was: 'note' => Snippet Label (Dynamic), 'snippet' => Note Label (Static)
            // Let's stick to the plan:
            // SnippetEditor for Snippets (Dynamic, @ variable support)
            // RichEditor for Notes (Static, no @ variable support)
            // We need to check the category of the item we are about to edit.
            // This comes from selectedSnippet OR snippetBreadCrum context if creating new?
            // Actually Container logic usually mounts RichTextEditor when activeEditor?.type === 'note'.
            // We should check the category prop passed to it, or derive it.
            // The activeView state for 'noteEditor' might have props.
            // const noteViewProps = activeEditor?.type === 'note' ? activeView : {};
            // Let's check selectedSnippet?.category.
            // If creating new, we might need a hint.
            // The 'category' prop was passed to RichTextEditor.
            const isSnippetMode = activeEditor?.type === 'snippet' ||
                activeEditor?.props?.snippet?.category === 'snippet' ||
                activeEditor?.props?.snippet?.type === 'snippet' ||
                activeEditor?.props?.category === 'snippet';
            const hotkeySnippet = isSnippetMode && activeEditor?.id !== 'new'
                ? useDbStore.getState().snippets.find(s => s.id === activeEditor?.id)
                : null;
            if (activeEditor?.type === 'note' || activeEditor?.type === 'link' || activeEditor?.type === 'snippet') {
                let editorContent: React.ReactNode = null;
                if (activeEditor?.type === 'link') {
                    const creationContext = activeEditor?.props?.linkWidgetCreationContext;
                    const initialTagIds = creationContext?.sourceMode === 'tags' ? creationContext.selectedTagIds : undefined;
                    const handleLinkCreated = async (createdLink: any) => {
                        if (!creationContext)
                            return;
                        const { widgetId, viewId, sourceMode } = creationContext;
                        if (sourceMode === 'manual') {
                            try {
                                let currentWidget: any = null;
                                let currentSettings: any = {};
                                let currentSourceMode = 'all';
                                const dbWidget = await db.widgets.get(widgetId);
                                if (dbWidget && dbWidget.viewId === viewId) {
                                    currentSettings = dbWidget.settings || {};
                                    currentSourceMode = currentSettings.sourceMode || 'all';
                                    currentWidget = dbWidget;
                                }
                                if (!currentWidget)
                                    return;
                                if (currentSourceMode !== 'manual')
                                    return;
                                const existingCollectionIds: string[] = Array.isArray(currentSettings.selectedCollectionIds)
                                    ? currentSettings.selectedCollectionIds
                                    : [];
                                if (!existingCollectionIds.includes(createdLink.id)) {
                                    const updatedCollectionIds = [...existingCollectionIds, createdLink.id];
                                    await updateWidgetSettingsAsync(viewId, widgetId, {
                                        ...currentSettings,
                                        selectedCollectionIds: updatedCollectionIds,
                                    });
                                }
                            }
                            catch (err) {
                                console.error('[Container] Failed to append created link to Custom widget settings:', err);
                            }
                        }
                    };
                    editorContent = (<LinkEditorView isOpen={true} isOverlay={Boolean(activeEditor?.props?.isOverlay)} onClose={() => {
                            if (activeEditor?.props?.returnToCollectionSheet && returnToCollectionSheet()) {
                                return;
                            }
                            useUIStore.getState().closeEditor();
                            if (!activeEditor?.props?.isOverlay && !activeEditor?.props?.returnToTimeline) {
                                setSearchValue('');
                                setSuggestionState(null);
                                searchbarRef.current?.clear();
                                useUIStore.getState().setView({ type: 'home' });
                            }
                        }} link={activeEditor?.props?.snippet || activeLinkSnippet} prefill={activeEditor?.props?.prefill || linkEditPrefill} initialTagIds={initialTagIds} onLinkCreated={handleLinkCreated} hideRightPanel={Boolean(activeEditor?.props?.hideRightPanel)} reload={reload}/>);
                }
                else if (isSnippetMode) {
                    const snippetCreationContext = activeEditor?.props?.snippetWidgetCreationContext;
                    const snippetInitialTagIds = snippetCreationContext?.sourceMode === 'tags' ? snippetCreationContext.selectedTagIds : undefined;
                    const handleSnippetCreated = async (createdSnippet: any) => {
                        if (!snippetCreationContext)
                            return;
                        const { widgetId, viewId, sourceMode } = snippetCreationContext;
                        if (sourceMode === 'manual') {
                            try {
                                let currentWidget: any = null;
                                let currentSettings: any = {};
                                let currentSourceMode = 'all';
                                const dbWidget = await db.widgets.get(widgetId);
                                if (dbWidget && dbWidget.viewId === viewId) {
                                    currentSettings = dbWidget.settings || {};
                                    currentSourceMode = currentSettings.sourceMode || 'all';
                                    currentWidget = dbWidget;
                                }
                                if (!currentWidget)
                                    return;
                                if (currentSourceMode !== 'manual')
                                    return;
                                const existingSnippetIds: string[] = Array.isArray(currentSettings.selectedSnippetIds)
                                    ? currentSettings.selectedSnippetIds
                                    : [];
                                if (!existingSnippetIds.includes(createdSnippet.id)) {
                                    const updatedSnippetIds = [...existingSnippetIds, createdSnippet.id];
                                    await updateWidgetSettingsAsync(viewId, widgetId, {
                                        ...currentSettings,
                                        selectedSnippetIds: updatedSnippetIds,
                                    });
                                }
                            }
                            catch (err) {
                                console.error('[Container] Failed to append created snippet to Custom widget settings:', err);
                            }
                        }
                    };
                    editorContent = (<EditSnippetScreen isOverlay={Boolean(activeEditor?.props?.isOverlay)} key={`snippet-editor-${activeEditor?.id || 'new'}-${activeEditor?.openInstanceId || 0}`} selectedSnippet={activeEditor?.props?.snippet || hotkeySnippet || effectiveSnippet} isCreatingNew={activeEditor?.id === 'new'} snippetBreadCrum={snippetBreadCrum} reload={handleReload} favoritesMapping={favoritesMapping} setFavoritesMapping={setFavoritesMapping} onBack={() => {
                            if (activeEditor?.props?.returnToCollectionSheet && returnToCollectionSheet()) {
                                return;
                            }
                            useUIStore.getState().closeEditor();
                            if (!activeEditor?.props?.isOverlay && !activeEditor?.props?.returnToTimeline) {
                                setSearchValue('');
                                setSuggestionState(null);
                                searchbarRef.current?.clear();
                                useUIStore.getState().setView({ type: 'home' });
                            }
                        }} initialDraftKey={activeEditor?.props?.initialDraftKey} initialDraftContent={activeEditor?.props?.initialDraftContent} initialTagIds={snippetInitialTagIds} onSnippetCreated={handleSnippetCreated} hideRightPanel={Boolean(activeEditor?.props?.hideRightPanel)} category="snippet"/>);
                }
                else {
                    const isNewNoteEditor = activeEditor?.id === 'new';
                    const noteInitialDraftKey = activeEditor?.props?.initialDraftKey ||
                        activeEditor?.props?.snippet?.title ||
                        activeEditor?.props?.snippet?.name ||
                        activeEditor?.props?.snippet?.key ||
                        activeEditor?.props?.item?.title ||
                        activeEditor?.props?.item?.name ||
                        activeEditor?.props?.item?.key;
                    const noteInitialDraftContent = activeEditor?.props?.initialDraftContent ||
                        activeEditor?.props?.snippet?.body ||
                        activeEditor?.props?.snippet?.content ||
                        activeEditor?.props?.snippet?.value ||
                        activeEditor?.props?.item?.body ||
                        activeEditor?.props?.item?.content ||
                        activeEditor?.props?.item?.value;
                    const noteCreationContext = activeEditor?.props?.noteWidgetCreationContext;
                    const noteInitialTagIds = noteCreationContext?.sourceMode === 'tags' ? noteCreationContext.selectedTagIds : undefined;
                    const handleNoteCreated = async (createdNote: any) => {
                        if (!noteCreationContext)
                            return;
                        const { widgetId, viewId, sourceMode } = noteCreationContext;
                        if (sourceMode === 'manual') {
                            try {
                                let currentWidget: any = null;
                                let currentSettings: any = {};
                                let currentSourceMode = 'all';
                                const dbWidget = await db.widgets.get(widgetId);
                                if (dbWidget && dbWidget.viewId === viewId) {
                                    currentSettings = dbWidget.settings || {};
                                    currentSourceMode = currentSettings.sourceMode || 'all';
                                    currentWidget = dbWidget;
                                }
                                if (!currentWidget)
                                    return;
                                if (currentSourceMode !== 'manual')
                                    return;
                                const existingNoteIds: string[] = Array.isArray(currentSettings.selectedNoteIds)
                                    ? currentSettings.selectedNoteIds
                                    : [];
                                if (!existingNoteIds.includes(createdNote.id)) {
                                    const updatedNoteIds = [...existingNoteIds, createdNote.id];
                                    await updateWidgetSettingsAsync(viewId, widgetId, {
                                        ...currentSettings,
                                        selectedNoteIds: updatedNoteIds,
                                    });
                                }
                            }
                            catch (err) {
                                console.error('[Container] Failed to append created note to Custom widget settings:', err);
                            }
                        }
                    };
                    editorContent = (<NoteEditorView key={`note-editor-${activeEditor?.id || 'new'}-${activeEditor?.openInstanceId || 0}`} noteId={isNewNoteEditor ? null : activeEditor?.id} onBack={() => {
                            useUIStore.getState().closeEditor();
                            if (!activeEditor?.props?.isOverlay && !activeEditor?.props?.returnToTimeline) {
                                setSearchValue('');
                                setSuggestionState(null);
                                searchbarRef.current?.clear();
                                useUIStore.getState().setView({ type: 'home' });
                            }
                        }} isOverlay={Boolean(activeEditor?.props?.isOverlay)} initialDraftKey={noteInitialDraftKey} initialDraftContent={noteInitialDraftContent} initialTagIds={noteInitialTagIds} onNoteCreated={handleNoteCreated} hideRightPanel={Boolean(activeEditor?.props?.hideRightPanel)}/>);
                }
                if (activeEditor?.props?.isOverlay && sheetBackground) {
                    return (<div className="relative w-full h-full flex flex-col overflow-hidden">
              {sheetBackground}
              <div style={FUNCTIONAL_EDITOR_SURFACE_STYLE} className="fixed inset-0 z-[10000] backdrop-blur-md bg-black/50 flex flex-col overflow-y-auto">
                <div className="flex-1 min-h-0 pt-6">
                  <div className="h-full w-full flex flex-col overflow-visible" style={{
                            zoom: windowWidth < 1200 ? 0.78 : windowWidth < 1366 ? 0.88 : windowWidth < 1500 ? 0.94 : 1,
                        }}>
                    {editorContent}
                  </div>
                </div>
              </div>
            </div>);
                }
                const isNormalEditorView = (activeEditor?.type === 'note' ||
                    activeEditor?.type === 'link' ||
                    activeEditor?.type === 'snippet' ||
                    activeEditor?.type === 'aiPrompt') &&
                    !activeEditor?.props?.isOverlay &&
                    !isFocusMode;
                return (<div className={`flex-1 min-h-0 pt-6 ${isNormalEditorView ? 'bg-[var(--color-editorBg)] has-[[data-black-editor-surface=true]]:!bg-[var(--color-rootBg)] h-full w-full' : ''}`}>
            <div className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full  '} w-full flex flex-col overflow-visible`} style={{
                        zoom: windowWidth < 1200 ? 0.78 : windowWidth < 1366 ? 0.88 : windowWidth < 1500 ? 0.94 : 1,
                    }}>
              {editorContent}
            </div>
          </div>);
            }
        }
        if (suggestionState &&
            (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
            !suggestionState.isAtMenuOpen &&
            suggestionState.lockedCommand !== 'calendar' &&
            (activeView?.type !== 'allItems' || isStoreLocked) &&
            !isLinkEditModalOpen) {
            return (<div className={`${isBoardSlashDropdownActive ? '' : 'glass-card border border-white/40 border-b-none border-r-none border-l-none dark:border-white/10'} ${!isStoreLocked ? `w-[75vw] -ml-[calc(37.5vw-50%)] max-w-none ${isBoardSlashDropdownActive ? 'mt-0' : 'mt-4'} h-[calc(100vh-200px)]` : 'h-[90%] w-full'} min-h-0 overflow-visible rounded-xl dark:rounded-none dark:bg-transparent`} style={{ border: 'none' }}>
          <BoardView ref={boardViewRef} state={suggestionState} unfilteredSuggestions={unfilteredSuggestionsRef.current} onSheetRedirect={onOpenSpreadsheetMainContainer} onClose={() => {
                    const shorthandFilters = ['/a', '/t', '/n', '/s', '/p', '/l', '/c', '/b'];
                    if (shorthandFilters.includes(searchValue.trim().toLowerCase())) {
                        searchbarRef.current?.clear();
                    }
                    searchbarRef.current?.blur();
                    if (isInitialAltSFocus && onInitialAltSFocusChange) {
                        onInitialAltSFocusChange(false);
                    }
                    handleGoHome();
                }} onExecuteItem={(item: any) => {
                    const cmdDef = item.command || item;
                    const cmdId = cmdDef.id || item.id;
                    const urlTemplate = cmdDef.urlTemplate || '';
                    const isAiCommand = cmdId === 'ai' || ['gpt', 'claude', 'perplexity', 'gemini'].includes(cmdId) || cmdDef.category === 'ai';
                    if (item._kind === 'command' && (isAiCommand || (urlTemplate && urlTemplate.includes('{query}')))) {
                        console.log('[Container] BoardView command clicked, locking command:', cmdId);
                        searchbarRef.current?.lockCommand(cmdId);
                        return true;
                    }
                    return false;
                }}/>
        </div>);
        }
        // Priority 2.5: All Items View (Bookmarks only)
        if (activeView?.type === 'allItems') {
            if ((activeView as any)?.itemType === 'bookmarks') {
                return <div className="flex-1 min-h-0 h-[90%] w-full"></div>;
            }
        }
        // Priority 3.5: Organization Panels
        // OrganizationSettings panel removed
        //   return (
        //     <div
        //       className="fixed top-0 bottom-0 right-0 z-[100] flex items-start pt-[15vh] justify-center pointer-events-none"
        //       style={{ left: showSidebarColumn ? '280px' : '0px' }}>
        //       <div className="w-[500px] h-[400px] pointer-events-auto relative bg-[var(--color-editorBg)] rounded-xl border border-neutral-800 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden translate-x-[8px]">
        //           onClose={() => {
        //             useUIStore.getState().setView({ type: 'home' });
        //           }}
        //           onSuccess={(id: string, name: string) => {
        //             useUIStore.getState().setView({ type: 'home' });
        //           }}
        //         />
        //       </div>
        //     </div>
        //   );
        // }
        // Workspace creation is only allowed from onboarding for now.
        // if (activeView?.type === 'createWorkspace') {
        //   return (
        //     <div
        //       className="fixed top-0 bottom-0 right-0 z-[100] flex items-start pt-[15vh] justify-center pointer-events-none"
        //       style={{ left: showSidebarColumn ? '280px' : '0px' }}>
        //       <div className="w-[500px] h-[340px] pointer-events-auto relative bg-[var(--color-editorBg)] rounded-xl border border-neutral-800 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden translate-x-[8px]">
        //         <CreateWorkspacePanel
        //           onClose={() => {
        //             useUIStore.getState().setView({ type: 'home' });
        //           }}
        //           onSuccess={(id: string, name: string) => {
        //             console.log(`Created Workspace ${name} (${id})`);
        //             useUIStore.getState().setView({ type: 'home' });
        //           }}
        //         />
        //       </div>
        //     </div>
        //   );
        // }
        if (activeView?.type === 'knowledgeGraph') {
            return (<div className="flex-1 min-h-0 h-full max-w-none w-full">
          <KnowledgeExplorerView savedAgents={savedAiAgents} onOrganizationSettings={handleOrganizationSettings} onBoardViewRedirect={onBoardViewRedirect}/>
        </div>);
        }
        if (activeView?.type === 'settings') {
            // Map { type:'settings', section:'...' } → the view.kind shape that SettingsLayout expects.
            const _settingsSection = (activeView as any).section as string | undefined;
            const _settingsView: any = _settingsSection === 'allOrganisations'
                ? { kind: 'allOrganisations' }
                : _settingsSection === 'googleDriveBackup'
                    ? { kind: 'googleDriveBackup', backupStatsId: (activeView as any).backupStatsId }
                        : _settingsSection === 'organisationSettings'
                            ? { kind: 'organisationSettings' }
                            : // profile, billing, appearance, searchView, todoSettings, generalSettings all go here
                                { kind: 'generalSettings', section: _settingsSection };
            return (<div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10" style={{
                    zoom: windowWidth < 1200 ? 0.78 : windowWidth < 1366 ? 0.88 : windowWidth < 1500 ? 0.94 : 1,
                }}>
            <SettingsLayout view={_settingsView} onClose={handleGoHome}/>
          </div>
        </div>);
        }
        const leftSidebarWidth = isLeftSidebarIconOnly
            ? LEFT_SIDEBAR_WIDTHS.iconOnly
            : LEFT_SIDEBAR_WIDTHS.readableCollapsed;
        const catalogWidth = isWidgetEditMode && windowWidth >= WIDGET_CATALOG_MIN_DOCK_VIEWPORT_WIDTH
            ? WIDGET_CATALOG_PANEL_WIDTH
            : 0;
        const fullBleedContentStyle = showSidebarColumn
            ? {
                width: `calc(100vw - ${leftSidebarWidth + catalogWidth}px)`,
                marginLeft: `calc(-50vw + ${(leftSidebarWidth + catalogWidth) / 2}px + 50%)`,
            }
            : {
                width: `calc(100vw - ${catalogWidth}px)`,
                marginLeft: `calc(-50vw + ${catalogWidth / 2}px + 50%)`,
            };
        // Priority 4: Home View
        if (displayHomeView) {
            return (<div className="flex-1 min-h-0 h-full max-w-none" style={fullBleedContentStyle}>
          <WidgetMainContainer isEditMode={isWidgetEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} pendingSelectedWidgetId={pendingSelectedWidgetId} onQuickCommandSelect={commandId => {
                    if (executeRetiredCreateUiAction(commandId)) {
                        return;
                    }
                    const localDef = findCommandByAnyId(commands, commandId);
                    if (localDef && localDef.surface !== 'website') {
                        if (localDef?.behavior === 'instant') {
                            handleCommandExecute(commandId as any);
                            return;
                        }
                    }
                    if (commandId === 'todo') {
                        useUIStore.getState().setSidebar('todoSidebar', { open: true });
                        return;
                    }
                    if (commandId === 'collections') {
                        onOpenSpreadsheetMainContainer?.('collections');
                        return;
                    }
                    searchbarRef.current?.lockCommand(commandId);
                    searchbarRef.current?.focus();
                }}/>
        </div>);
        }
        if (isEmbedded) {
            return null;
        }
        // Priority 6: Default/Welcome -> Defaults to Home View
        if ((suggestionState?.lockedCommand && (suggestionState.lockedCommand as string) !== 'store') ||
            suggestionState?.isAtMenuOpen) {
            return null;
        }
        return (<div className="flex-1 min-h-0 h-full max-w-none" style={fullBleedContentStyle}>
        <WidgetMainContainer isEditMode={isWidgetEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} pendingSelectedWidgetId={pendingSelectedWidgetId} onQuickCommandSelect={commandId => {
                if (executeRetiredCreateUiAction(commandId)) {
                    return;
                }
                if (commandId === 'todo') {
                    useUIStore.getState().setSidebar('todoSidebar', { open: true });
                    return;
                }
                if (commandId === 'collections') {
                    onOpenSpreadsheetMainContainer?.('collections');
                    return;
                }
                searchbarRef.current?.lockCommand(commandId);
                searchbarRef.current?.focus();
            }}/>
      </div>);
    };
    const lastEmittedStateRef = useRef<SuggestionState | null>(null);
    const unfilteredSuggestionsRef = useRef<any[]>([]);
    // Handle suggestion state from Searchbar (like AltS)
    const handleSuggestionStateChange = useCallback((state: SuggestionState | null) => {
        // 1. Check for changes before updating state to avoid render loops
        // We compare critical properties that affect UI rendering.
        const prevState = lastEmittedStateRef.current;
        const isInteractiveState = Boolean(state?.lockedCommand ||
            state?.isAtMenuOpen ||
            state?.activeAiSession ||
            state?.selectedImagesCount ||
            state?.value?.trim() ||
            state?.showEmptySlashDropdown);
        const wasInteractiveState = Boolean(prevState?.lockedCommand ||
            prevState?.isAtMenuOpen ||
            prevState?.activeAiSession ||
            prevState?.selectedImagesCount ||
            prevState?.value?.trim() ||
            prevState?.showEmptySlashDropdown);
        const hasChanged = !prevState ||
            !state ||
            state.isVisible !== prevState.isVisible ||
            state.lockedCommand !== prevState.lockedCommand ||
            state.value !== prevState.value ||
            state.highlightIndex !== prevState.highlightIndex ||
            state.isAtMenuOpen !== prevState.isAtMenuOpen ||
            (isInteractiveState &&
                (state.selectedAIs?.length !== prevState.selectedAIs?.length ||
                    JSON.stringify(state.selectedAIs) !== JSON.stringify(prevState.selectedAIs) ||
                    state.activeAiSession?.id !== prevState.activeAiSession?.id ||
                    state.activeAiSession?.sessionKey !== prevState.activeAiSession?.sessionKey ||
                    state.suggestions?.length !== prevState.suggestions?.length));
        if (hasChanged) {
            if (!state?.value || state.value.trim() === '') {
                if (state?.suggestions && state.suggestions.length > 0) {
                    unfilteredSuggestionsRef.current = state.suggestions;
                }
            }
            lastEmittedStateRef.current = state;
            if (isInteractiveState || wasInteractiveState || !state) {
                setSuggestionState(state);
            }
        }
        // 2. Proactively notify parent of command lock changes to avoid race conditions in UI
        const nextLocked = (state?.lockedCommand as string | null);
        if (nextLocked !== prevLockedRef.current) {
            prevLockedRef.current = nextLocked;
            onLockedCommandChange?.(nextLocked);
        }
        // 3. Only notify parent of menu visibility changes to avoid re-rendering App on item highlight
        const isMenuOpen = !!state?.isAtMenuOpen;
        if (isMenuOpen !== prevIsMenuOpenRef.current) {
            prevIsMenuOpenRef.current = isMenuOpen;
            onMenuStateChange?.(isMenuOpen);
        }
    }, [onMenuStateChange, onLockedCommandChange]);
    const handleAISubmit = useCallback((prompt: string) => {
        searchbarRef.current?.submitAI(prompt);
    }, []);
    const handleAIFileUpload = useCallback(() => {
        searchbarRef.current?.triggerFileUpload();
    }, []);
    const handleAIQueryChange = useCallback((val: string) => {
        // 1. Update the local suggestionState immediately for responsive UI
        setSuggestionState(prev => (prev ? { ...prev, value: val } : null));
        // 2. Synchronize with the Searchbar's internal state (commandPrompt/value)
        // This prevents the searchbar from re-emitting a stale prompt state
        // when it re-renders (e.g. after a file upload).
        searchbarRef.current?.setValue(val);
    }, []);
    const handleCloseTodosView = useCallback(() => {
        handleNavigateBack();
    }, [handleNavigateBack]);
    // When a command is locked (e.g. /ai), close any active editor so the user sees the command interface
    useEffect(() => {
        if (suggestionState?.lockedCommand && !isLinkEditModalOpen) {
            if (activeEditor?.type === 'note' || activeEditor?.type === 'link' || activeView?.type === 'bulk') {
                useUIStore.getState().setView({ type: 'home' });
            }
        }
    }, [suggestionState?.lockedCommand, activeView?.type, isLinkEditModalOpen]);
    const handleSearchbarFocusChange = useCallback((direction: 'up' | 'down') => {
        if (direction === 'down') {
            // DefaultContainer handles its own navigation via global keydown listener
            // No need to call focusFirstItem() here - it causes focus to reset to index 0
        }
        else if (direction === 'up') {
        }
    }, [displayHomeView]);
    // Promise Queue
    const handleCommandExecuteLog = (commandId: string) => { };
    const handleStoreClose = useCallback(() => {
        useUIStore.getState().setView({ type: 'searchSuggestions' });
        // Removed search clear to allow results to persist when closing store
        // setSuggestionState(null);
        // setSearchValue('');
        // searchbarRef.current?.clear();
        setTimeout(() => searchbarRef.current?.focus(), 0);
    }, []);
    const handleToggleFavorite = useCallback(async (item: any) => {
        if (!userId) {
            triggerNotification('Please sign in to manage favorites', 'error');
            return;
        }
        try {
            let itemId = '';
            let itemType = 'snippet';
            // Check if it's a command
            const isCommand = item.source === 'last_used' ||
                item.id === 'ai' ||
                item.type === 'command' ||
                item._kind === 'command' ||
                item.category === 'command';
            if (isCommand) {
                itemType = 'command';
                itemId = item.id;
            }
            else {
                // Unwrap the item if it's a wrapper
                const actualItem = item.item || item.snippet || item.session || item.data || item;
                const category = (actualItem.category || item.category || item._kind || item.type || '').toLowerCase();
                if (category === 'link') {
                    itemType = 'link';
                }
                else if (category === 'note') {
                    itemType = 'note';
                }
                else if (category === 'session' || category === 'sessions' || category === 'tabgroup') {
                    itemType = 'collection';
                }
                else if (category === 'snippet') {
                    itemType = 'snippet';
                }
                else if (category === 'chat_agent' || category === 'agent') {
                    itemType = 'chat_agent';
                }
                else if (category === 'aiprompt' || category === 'prompt') {
                    itemType = 'aiPrompt';
                }
                else {
                    itemType = 'note'; // Fallback
                }
                itemId =
                    actualItem.snippet_id ||
                        actualItem.id ||
                        actualItem.session_id ||
                        actualItem.todo_id ||
                        item.session?.id ||
                        '';
            }
            itemId = extractSnippetIdFromCompoundId(itemId);
            if (!itemId) {
                triggerNotification('Could not resolve item ID to favorite', 'error');
                return;
            }
            const label = item.label ||
                item.snippet?.key ||
                item.snippet?.title ||
                item.snippet?.name ||
                item.key ||
                item.title ||
                item.name ||
                '';
            await toggleFavoriteRecord(userId || 'local_user', itemId, itemType, label);
            triggerNotification('Favorites updated', 'success');
        }
        catch (error) {
            console.error(error);
            triggerNotification('Failed to update favorites', 'error');
        }
    }, [userId, triggerNotification]);
    const handleLockedCommandChangeInternal = useCallback((cmd: any) => {
        if (cmd === null && activeEditor?.type === 'ai') {
            // When clearing an AI command, close editor and return to home view
            useUIStore.getState().closeEditor();
            useUIStore.getState().setView({ type: 'home' });
        }
        onLockedCommandChange?.(cmd);
    }, [onLockedCommandChange, activeView?.type, activeEditor?.type]);
    const handleQueryChange = useCallback((value: string) => {
        setSearchValue(value);
        propOnQueryChange?.(value);
    }, [propOnQueryChange]);
    const defaultPlaceholder = useMemo(() => {
        return 'Type to search';
    }, []);
    // Right-side header/searchbar section.
    // Keep this section independent from editor, board, sheet, and future draggable-region layout changes.
    const renderHeader = () => {
        const isAiLocked = (suggestionState?.lockedCommand as string) === 'ai';
        return (<div className={'flex-shrink-0 relative z-48'}>
        <div className={'flex items-center gap-2'}>
          {/* Left: Search Bar - fully disabled in widget edit mode (no clicks, no Tab, no drag-drop, no focus) */}
          <div className="flex-1 min-w-0 relative">
            <div className={`transition-opacity duration-200 ${isBoardViewOpen ? `${BRAND.dom.cssPrefix}search-results-open cmdos-search-results-open` : ''} ${isWidgetEditMode ? 'pointer-events-none opacity-40 select-none' : ''}`} inert={isWidgetEditMode} style={{
                zoom: windowWidth < 1200 ? 0.78 : windowWidth < 1366 ? 0.88 : windowWidth < 1500 ? 0.94 : 1,
            }}>
              <Searchbar ref={searchbarRef} savedAiAgents={savedAiAgents} hideDynamicIcon={Boolean(suggestionState &&
                (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
                !suggestionState.isAtMenuOpen &&
                suggestionState.lockedCommand !== 'calendar' &&
                (activeView?.type !== 'allItems' || isStoreLocked) &&
                !isLinkEditModalOpen)} disableContextualPopup={true} placeholder={defaultPlaceholder} onSuggestionStateChange={handleSuggestionStateChange} onLockedCommandChange={handleLockedCommandChangeInternal} lockedCommand={activeEditor?.type === 'ai' && !suggestionState?.lockedCommand
                ? 'ai'
                : suggestionState?.lockedCommand} onSnippetSelect={handleSearchSnippetSelect} searchValue={searchValue} onQueryChange={handleQueryChange} onCommandModeExit={() => {
                if (displayHomeView) {
                    setTimeout(() => {
                        searchbarRef.current?.focus();
                    }, 0);
                }
            }} onCommandExecute={handleCommandExecute} onRequestFocusChange={handleSearchbarFocusChange} onNavigateBack={handleNavigateBack} onRequestEditLink={handleHomeLinkEdit} onRequestSnippetDelete={handleHomeDeleteRequest as any} onToggleFavorite={handleToggleFavorite} onSearchbarFocus={onSearchbarFocus} isInitialAltSFocus={isInitialAltSFocus} onInitialAltSFocusChange={onInitialAltSFocusChange} displayHomeView={displayHomeView} onHoverSlashDot={onHoverSlashDot}/>
            </div>
            {/* Drag-drop firewall overlay — sits above the searchbar in edit mode to block
                the browser's native text-drop behavior that bypasses inert/pointer-events */}
            {isWidgetEditMode && (<div className="absolute inset-0 z-[9999] cursor-not-allowed" onPointerDown={e => e.stopPropagation()} onDragOver={e => {
                    e.preventDefault();
                    e.stopPropagation();
                }} onDragEnter={e => {
                    e.preventDefault();
                    e.stopPropagation();
                }} onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                }}/>)}
          </div>
        </div>
      </div>);
    };
    const isEditorExpanded = isCreatingEditorView ||
        activeView?.type === 'bulk' ||
        activeEditor?.type === 'agent' ||
        activeEditor?.type === 'note' ||
        activeEditor?.type === 'aiPrompt' ||
        activeEditor?.type === 'todo' ||
        activeView?.type === 'store' ||
        activeView?.type === 'knowledgeGraph' ||
        activeView?.type === 'todo' ||
        (suggestionState?.lockedCommand as string) === 'ai';
    const isActuallyExpanded = isEditorExpanded || isLinkEditModalOpen;
    const isOrganizationPanelOpen = activeView?.type === 'settings' ||
        activeView?.type === 'createOrganisation';
    const shouldHideMainContent = hideMainContent;
    const shouldHideHeader = isEmbedded ||
        activeView?.type === 'collections' ||
        activeView?.type === 'timeline' ||
        isWorkspaceCollectionView ||
        isSpreadsheetViewOpen ||
        activeEditor?.type === 'session' ||
        activeEditor?.type === 'todo' ||
        activeEditor?.type === 'aiPrompt' ||
        activeView?.type === 'todo' ||
        activeView?.type === 'knowledgeGraph' ||
        (isActuallyExpanded &&
            (suggestionState?.lockedCommand as string) !== 'store' &&
            (suggestionState?.lockedCommand as string) !== 'ai' &&
            activeView?.type !== 'store');
    const isFreshAiCommand = (activeEditor?.type === 'ai' || (suggestionState?.lockedCommand as string) === 'ai') &&
        !suggestionState?.activeAiSession?.prompt;
    const isQueryBasedLockedCommand = Boolean(suggestionState?.lockedCommand &&
        (!isLocalCommandId(commands, suggestionState.lockedCommand) || suggestionState.requiresInlineQuery) &&
        suggestionState.lockedCommand !== 'store' &&
        suggestionState.lockedCommand !== 'ai');
    // Right-side root layout.
    // AppMainContent gives Container the right-side area; Container owns the header, main content router,
    // future draggable-region slot, and local dialogs for this area.
    return (<div style={isNarrowView &&
            !isWorkspaceCollectionView &&
            !isFocusMode &&
            !isEmbedded &&
            !showSidebarColumn &&
            activeView?.type !== 'knowledgeGraph' &&
            activeView?.type !== 'collections' &&
            activeView?.type !== 'timeline'
            ? { transform: 'translateX(-100px)' }
            : undefined} className={`flex h-full flex-col w-full relative ${isFocusMode ||
            isWorkspaceCollectionView ||
            isCreatingEditorView ||
            isLinkEditModalOpen ||
            activeView?.type === 'settings' ||
            activeView?.type === 'collections' ||
            activeView?.type === 'timeline' ||
            activeView?.type === 'knowledgeGraph' ||
            activeView?.type === 'createOrganisation'
            ? 'max-w-none mx-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
            :
                isSpreadsheetViewOpen
                    ? 'w-full mx-auto pr-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
                    : activeEditor?.type === 'agent'
                        ? 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
                        : isOrganizationPanelOpen
                            ? 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
                            : activeView?.type === 'todo' && !activeEditor
                                ? 'max-w-4xl mx-auto pt-0 pb-[5px] min-[1600px]:max-w-5xl min-[1800px]:max-w-6xl max-[1480px]:max-w-3xl max-[1370px]:max-w-2xl max-[1270px]:max-w-xl h-full overflow-visible'
                                : activeView?.type === 'store'
                                    ? `pb-[5px] overflow-visible w-full mx-auto ${showSidebarColumn ? 'max-w-[1800px]' : 'max-w-4xl'} pt-[10vh] ${showSidebarColumn ? 'pl-[8%] pr-[340px]' : ''}`
                                    : activeEditor?.type === 'ai' || (suggestionState?.lockedCommand as string) === 'ai'
                                        ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[10vh]`
                                        : isQueryBasedLockedCommand
                                            ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[10vh]`
                                            : isNarrowView
                                                ? `max-w-[480px] mx-auto pt-[10vh] pb-0 min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] overflow-visible`
                                                : `max-w-[1200px] mx-auto pt-[10vh] pb-0 mt-0 h-full px-8 min-[1600px]:max-w-[1400px] overflow-hidden`}`}>
      {!isOrganizationPanelOpen && (<div className={shouldHideHeader ? 'hidden pointer-events-none opacity-0 h-0 overflow-hidden' : ''}>
          {renderHeader()}
        </div>)}

      {/* Right-side main content router: BoardView, SheetView, HomeView, editors, AI/store, settings, and creation panels. */}
      {activeEditor?.type === 'agent' ||
            activeView?.type === 'todo' ||
            isSpreadsheetViewOpen ||
            !shouldHideMainContent || activeView?.type === 'collections' || activeView?.type === 'timeline' ? (<div className={`flex-1 min-h-0 flex flex-col ${isSpreadsheetViewOpen || isOrganizationPanelOpen || activeView?.type === 'knowledgeGraph' || activeView?.type === 'collections' || activeView?.type === 'timeline' ? 'overflow-hidden' : 'overflow-visible'} ${isSpreadsheetViewOpen || isBoardSlashDropdownActive || isWorkspaceCollectionView || activeView?.type === 'knowledgeGraph' || activeView?.type === 'collections' || activeView?.type === 'timeline' ? 'mt-0' : 'mt-[10px]'}`}>
          <React.Suspense fallback={null}>{renderMainContent()}</React.Suspense>
        </div>) : null}

      {/* Right-side local dialogs and overlays owned by Container. */}
      <React.Suspense fallback={null}>
        <DeleteDialog isOpen={homeDeleteContext.isOpen} onClose={handleCloseHomeDeleteDialog} onConfirm={handleConfirmHomeDelete} title={homeDeleteContext.detail?.commandId === 'delete_link' ? 'Delete Link' : 'Delete Note'} description={homeDeleteContext.detail
            ? `Do you want to delete "${homeDeleteContext.detail.snippetKey}"?`
            : 'Do you want to delete this item?'}/>
      </React.Suspense>

    </div>);
};
export default memo(Container);

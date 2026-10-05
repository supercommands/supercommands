import { AppModals } from './AppModals';
import { AppLeftSidebar } from './AppLeftSidebar';
import { AppMainContent } from './AppMainContent';
import { OnboardingOverlayController } from './OnboardingOverlayController';
import { LEFT_SIDEBAR_WIDTHS } from './useLeftSidebarLayout';
import { RightSideWidget } from '../components/widgets';
// import removed
import { useKeystrokeRecording } from '../../../../shared-components/hotkeys';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { CMDOS_DOCS_URL } from '../../../../storage/API/core/apiConfig';
import { BRAND } from '../../../../shared-components/brandingConfig';
import Branding from '../../../../shared-components/Branding';
import HeaderControls from '../../../../settings/uxLayoutCustomization/headerControls';
import { getDefaultSettingsView } from '../../../../settings/uxLayoutCustomization/defaultSettingsView';
import WarmTintLayer from '../../../../settings/uiPersonalization/WarmTintLayer';
import { hasOnboardingCompletedHint, isOnboardingCompleted, setOnboardingCompletedHint, } from '../../../../storage/localStorage/onboardingStorage';
import { useSpreadsheetStore } from '../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';
import { type SearchbarHandle, type SuggestionState, } from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';
type Organisation = any;
import { useUIStore, HOME_DASHBOARD_REQUEST_EVENT, useIsFullScreenModalOpen, useShowTodosView, useTodoCreatePrefill, useIsLinkEditModalOpen, } from '../../../../shared-components/uiStateManager';
import { detectOS } from '../../../../shared-components/utils/osUtils';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../storage/store/useWidgetDashboardStore';
import { isMainDashboardView } from '../components/widgets/engine/widgetDashboardData';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import useNotification from '../../../../shared-components/notifications/useNotification';
import WallpaperLayer from '../../../../settings/uiPersonalization/WallpaperLayer';
import { useAppearance } from '@extension/ui';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUrlTriggers, type MissingAiPromptInputRequest } from './hooks/useUrlTriggers';
import type { MissingAiPromptTabAttachment } from './MissingAiPromptInputModal';
import { enrichTemporaryPromptWithTabs, readPromptTabContext } from '../../../../shared-components/aiPromptComposer/temporaryPromptComposition';
const MissingAiPromptInputModal = React.lazy(() => import('./MissingAiPromptInputModal').then(m => ({ default: m.MissingAiPromptInputModal })));
import { hasRunnableAiPrompt, runAiPrompt, runDirectAiPrompt } from '../../../../allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import { SESSION_MISSING_AI_PROMPT_INPUT_EVENT, type SessionMissingAiPromptInputEventDetail, } from '../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { useSelectedOrganisation, useSelectedSnippet, } from '../../../../shared-components/localEntitySelectors';
import { startupPerf } from '../startupPerf';
type OnboardingStatus = 'checking' | 'complete' | 'incomplete';
type PendingMissingAiPromptInput = {
    promptRecord?: MissingAiPromptInputRequest['promptRecord'];
    promptId: string;
    editorProps?: unknown;
    title?: string;
    initialPrompt?: string;
    directPrompt?: boolean;
    targets?: SessionMissingAiPromptInputEventDetail['targets'];
};
const executeMissingAiPromptRequest = async (request: PendingMissingAiPromptInput, promptText: string) => {
    const prompt = promptText.trim();
    if (request.targets?.length) {
        await Promise.all(request.targets.map(target => chrome.runtime.sendMessage({
            action: 'open_tab_with_auto_submit',
            url: target.url,
            targetTabId: target.tabId,
            active: false,
            forceNewTab: false,
            autoSubmit: { kind: target.kind, prompt },
        })));
    }
    else if (request.promptRecord) {
        await runAiPrompt(request.promptRecord, prompt);
    }
    else if (request.directPrompt) {
        await runDirectAiPrompt(prompt);
    }
};
const App: React.FC = () => {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    const { theme, themeId } = useAppearance();
    const { isKeystrokeRecordingActive } = useKeystrokeRecording();
    const triggerNotification = useNotification();
    const [isInitialAltSFocus, setIsInitialAltSFocus] = useState(false);
    const [showTutorialButton, setShowTutorialButton] = useState(false);
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const viewDropdownRef = useRef<HTMLDivElement | null>(null);
    const [suggestionState, setSuggestionState] = useState<SuggestionState | null>(null);
    const [missingAiPromptInput, setMissingAiPromptInput] = useState<PendingMissingAiPromptInput | null>(null);
    const [isSendingMissingAiPrompt, setIsSendingMissingAiPrompt] = useState(false);
    const hasLoadedThemeRef = useRef(false);
    const userId = 'local_user';
    const isSpreadsheetViewOpen = useUIStore((s: any) => s.isSheetOpen);
    const activeLockedCommand = useUIStore((s: any) => s.lockedCommand);
    const setIsSpreadsheetViewOpen = useCallback((open: boolean) => {
        if (open) {
            useUIStore.getState().openSheet();
            return;
        }
        console.trace('[ESCAPE][setIsSpreadsheetViewOpen] CLOSING SHEET - called from:');
        useUIStore.getState().closeSheet();
    }, []);
    useEffect(() => {
        if (!isViewDropdownOpen)
            return;
        const handleClickOutside = (event: MouseEvent) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isViewDropdownOpen]);
    const activeView = useUIStore((s: any) => s.activeView);
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const returnToHomeView = useWidgetDashboardStore(state => state.returnToHomeView);
    const activeDashboardView = dashboardState?.views.find(view => view.id === dashboardState.activeViewId);
    const isWorkspaceCollectionView = (!activeView?.type || activeView.type === 'home') &&
        Boolean(activeDashboardView) &&
        !isMainDashboardView(activeDashboardView);
    // Focus the searchbar reactively when entering search/columns layout
    useEffect(() => {
        if (!isSpreadsheetViewOpen && isInitialAltSFocus
            && !document.querySelector('[data-website-popup-layer-host="true"]')) {
            searchbarRef.current?.focus();
        }
    }, [isInitialAltSFocus, isSpreadsheetViewOpen, activeView?.type]);
    const isFullScreenModalOpen = useIsFullScreenModalOpen();
    const showTodosView = useShowTodosView();
    const todoCreatePrefill = useTodoCreatePrefill();
    const isLinkEditModalOpen = useIsLinkEditModalOpen();
    const activeEditor = useUIStore((s: any) => s.activeEditor);
    const previousEditorRef = useRef(activeEditor);
    const [isShortcutsSidebarCompact, setIsShortcutsSidebarCompact] = useState(false);
    // Closing an editor normally returns to Home, but preserve an explicitly
    // selected workspace collection so sidebar navigation can reveal it.
    useEffect(() => {
        const hadEditorOpen = Boolean(previousEditorRef.current);
        previousEditorRef.current = activeEditor;
        if (hadEditorOpen && !activeEditor) {
            setIsShortcutsSidebarCompact(false);
            const currentDashboardState = useWidgetDashboardStore.getState().state;
            const currentDashboardView = currentDashboardState?.views.find(view => view.id === currentDashboardState.activeViewId);
            if (currentDashboardView && !isMainDashboardView(currentDashboardView)) {
                return;
            }
            returnToHomeView();
        }
    }, [activeEditor, returnToHomeView]);
    useEffect(() => {
        const handleHomeDashboardRequest = () => {
            setIsShortcutsSidebarCompact(false);
            returnToHomeView();
        };
        window.addEventListener(HOME_DASHBOARD_REQUEST_EVENT, handleHomeDashboardRequest);
        return () => window.removeEventListener(HOME_DASHBOARD_REQUEST_EVENT, handleHomeDashboardRequest);
    }, [returnToHomeView]);
    const handleCloseTodosView = useCallback(() => {
        useUIStore.getState().setSidebar('todoSidebar', { open: false });
    }, []);
    const [isGlobalCreateMenuOpen, setIsGlobalCreateMenuOpen] = useState(false);
    useEffect(() => {
        (window as any).isGlobalCreateMenuOpen = isGlobalCreateMenuOpen;
        return () => {
            (window as any).isGlobalCreateMenuOpen = false;
        };
    }, [isGlobalCreateMenuOpen]);
    const [isEmbedded, setIsEmbedded] = useState(false);
    const [hasOpenedCreator, setHasOpenedCreator] = useState(false);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('embed') === 'true') {
                setIsEmbedded(true);
            }
        }
    }, []);
    const isAnyEditorOpen = isLinkEditModalOpen || activeEditor?.type === 'todo' || !!todoCreatePrefill;
    useEffect(() => {
        if (!isEmbedded)
            return;
        if (isAnyEditorOpen) {
            if (!hasOpenedCreator) {
                setHasOpenedCreator(true);
            }
        }
        else if (hasOpenedCreator) {
            window.parent.postMessage({ type: BRAND.events.closeEmbedCreator }, '*');
            setHasOpenedCreator(false);
        }
    }, [isAnyEditorOpen, hasOpenedCreator, isEmbedded]);
    const [tabId, setTabId] = useState<number | null>(null);
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs?.getCurrent) {
            chromeAny.tabs.getCurrent((tab: any) => {
                if (tab?.id) {
                    setTabId(tab.id);
                }
            });
        }
    }, []);
    // Shared focus-tracking storage key
    const focusKey = tabId ? `new_tab_focus_${tabId}` : 'new_tab_has_page_focus';
    // Auto-close Sheet UI when navigating to specific views to prevent UI overlaps
    useEffect(() => {
        if (isSpreadsheetViewOpen && (showTodosView || (activeEditor?.type === 'note' && !activeEditor?.props?.isOverlay) || (activeEditor?.type === 'link' && !activeEditor?.props?.isOverlay) || (activeEditor?.type === 'todo' && !activeEditor?.props?.isOverlay))) {
            setIsSpreadsheetViewOpen(false);
        }
    }, [activeView?.type, isSpreadsheetViewOpen]);
    const userIdRef = useRef(userId);
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);
    const isInitialFocusSheet = useMemo(() => {
        if (typeof window === 'undefined')
            return false;
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('focus_sheet_ui_first_column') === 'true';
    }, []);
    const backgroundRefresh = useCallback(() => { }, []);
    const dexieOrganisations = useDbStore(state => state.organisations);
    // Tutorial button visibility is driven by the Dexie workspace list.
    useEffect(() => {
        startupPerf('App:setShowTutorialButton', {
            organisationCount: Array.isArray(dexieOrganisations) ? dexieOrganisations.length : 0,
        });
        setShowTutorialButton(true);
    }, [dexieOrganisations]);
    const onboardingCompletedHintOnBoot = useRef(hasOnboardingCompletedHint());
    const [showTutorial, setShowTutorial] = useState(false);
    const [isOnboardCompleted, setIsOnboardCompleted] = useState<boolean>(() => onboardingCompletedHintOnBoot.current);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>(() => onboardingCompletedHintOnBoot.current ? 'complete' : 'checking');
    const hasEvaluatedOnboarding = useRef(false);
    useEffect(() => {
        if (!hasEvaluatedOnboarding.current) {
            hasEvaluatedOnboarding.current = true;
            isOnboardingCompleted()
                .then((completed: boolean) => {
                startupPerf('onboarding:resolved', {
                    completed,
                    hadBootHint: onboardingCompletedHintOnBoot.current,
                });
                setIsOnboardCompleted(completed);
                setOnboardingStatus(completed ? 'complete' : 'incomplete');
                setShowTutorial(!completed);
            })
                .catch(error => {
                console.error('[App] Error checking onboarding status:', error);
                startupPerf('onboarding:error');
                setOnboardingStatus('complete');
            });
        }
    }, []);
    // Detect OS
    useEffect(() => {
        detectOS().then(os => {
            useUIStore.getState().setOS(os);
        });
    }, []);
    const selectedOrganisation = useSelectedOrganisation();
    const localChatAgents = useDbStore(state => state.chatAgents);
    const savedAgentById = useMemo(() => new Map(localChatAgents.map(agent => [agent.id, agent])), [localChatAgents]);
    useEffect(() => {
        const handleSetViewMode = (e: Event) => {
            const mode = (e as CustomEvent).detail;
            if (mode === 'board') {
                setIsSpreadsheetViewOpen(false);
                searchbarRef.current?.clear();
                setIsInitialAltSFocus(true);
                chrome.storage.local.set({ new_tab_is_board_view_enabled: true });
            }
            else if (mode === 'sheet') {
                setIsSpreadsheetViewOpen(true);
                searchbarRef.current?.clear();
            }
        };
        window.addEventListener('setViewMode', handleSetViewMode);
        // Fired by ViewMenuPanel when user clicks "All" in the sidebar
        const handleOpenBoardViewAll = () => {
            // Set isInitialAltSFocus FIRST so Board View stays alive even when value is cleared
            setIsSpreadsheetViewOpen(false);
            setIsInitialAltSFocus(true);
            // Clear value after the flag is set — Board View stays open via isInitialAltSFocus
            setTimeout(() => {
                if (searchbarRef.current) {
                    searchbarRef.current.clear?.();
                    searchbarRef.current.focus?.();
                }
            }, 20);
        };
        window.addEventListener('alts:open-board-view-all', handleOpenBoardViewAll);
        return () => {
            window.removeEventListener('setViewMode', handleSetViewMode);
            window.removeEventListener('alts:open-board-view-all', handleOpenBoardViewAll);
        };
    }, []);
    useEffect(() => {
        const handleOpenTutorial = () => setShowTutorial(true);
        window.addEventListener('openTutorial', handleOpenTutorial);
        return () => window.removeEventListener('openTutorial', handleOpenTutorial);
    }, []);
    const openSpreadsheetView = useCallback((section?: string) => {
        useUIStore.getState().openSheet(section ?? null);
        if (section === 'collections') {
            const state = useSpreadsheetStore.getState();
            state.setCategoryFilter(['all']);
            state.setVisibilityFilter(['all']);
            state.setSpaceFilter(['all']);
        }
        else if (section) {
            const state = useSpreadsheetStore.getState();
            state.setTargetSection(section);
            // Ensure section is expanded
            if (state.collapsedSections.includes(section)) {
                state.toggleSection(section);
            }
        }
    }, [activeView?.type, isSpreadsheetViewOpen]);
    const openAllCommandShortcuts = useCallback(() => {
        useUIStore.getState().setKnowledgeExplorerMode('graph');
        useUIStore.getState().setView({ type: 'knowledgeGraph' });
    }, []);
    const presentOrRunMissingAiPromptInput = useCallback((request: PendingMissingAiPromptInput) => {
        const promptText = String(request.initialPrompt || '').trim();
        const normalizedRequest = {
            ...request,
            title: String(request.promptRecord?.title || (request.promptRecord as any)?.name || request.title || 'AI Prompt'),
        };
        if (promptText) {
            setIsSendingMissingAiPrompt(true);
            setMissingAiPromptInput(null);
            void executeMissingAiPromptRequest(normalizedRequest, promptText)
                .catch(error => {
                console.error('[App] Failed to execute supplied temporary prompt:', error);
                triggerNotification('Failed to run AI prompt', 'error');
            })
                .finally(() => setIsSendingMissingAiPrompt(false));
            return;
        }
        setIsSendingMissingAiPrompt(false);
        setMissingAiPromptInput(normalizedRequest);
    }, [triggerNotification]);
    const requestMissingAiPromptInput = useCallback((request: MissingAiPromptInputRequest) => {
        presentOrRunMissingAiPromptInput({
            ...request,
            title: String(request.promptRecord?.title || (request.promptRecord as any)?.name || 'AI Prompt'),
        });
    }, [presentOrRunMissingAiPromptInput]);
    useEffect(() => {
        const handleSessionMissingAiPromptInput = (event: Event) => {
            const detail = (event as CustomEvent<SessionMissingAiPromptInputEventDetail>).detail;
            if (!detail?.promptRecord && !detail?.targets?.length && !detail?.directPrompt)
                return;
            if (detail.promptRecord) {
                requestMissingAiPromptInput({
                    promptRecord: detail.promptRecord,
                    promptId: detail.promptId,
                    initialPrompt: detail.initialPrompt,
                });
                return;
            }
            presentOrRunMissingAiPromptInput({
                promptId: detail.promptId,
                title: detail.title || 'Chat Agent',
                initialPrompt: detail.initialPrompt,
                directPrompt: detail.directPrompt,
                targets: detail.targets,
            });
        };
        window.addEventListener(SESSION_MISSING_AI_PROMPT_INPUT_EVENT, handleSessionMissingAiPromptInput);
        return () => {
            window.removeEventListener(SESSION_MISSING_AI_PROMPT_INPUT_EVENT, handleSessionMissingAiPromptInput);
        };
    }, [presentOrRunMissingAiPromptInput, requestMissingAiPromptInput]);
    const closeMissingAiPromptInput = useCallback(() => {
        if (isSendingMissingAiPrompt)
            return;
        setMissingAiPromptInput(null);
    }, [isSendingMissingAiPrompt]);
    const editMissingAiPrompt = useCallback(() => {
        const promptRecord = missingAiPromptInput?.promptRecord;
        if (!promptRecord || isSendingMissingAiPrompt)
            return;
        setMissingAiPromptInput(null);
        useUIStore.getState().openEditor({
            type: 'aiPrompt',
            id: promptRecord.id,
            props: { editMode: true, snippet: promptRecord },
        });
    }, [isSendingMissingAiPrompt, missingAiPromptInput]);
    const sendMissingAiPromptInput = useCallback(async (promptText: string, attachedTabs: MissingAiPromptTabAttachment[]) => {
        if (!missingAiPromptInput || isSendingMissingAiPrompt)
            return;
        setIsSendingMissingAiPrompt(true);
        try {
            const enrichedPrompt = await enrichTemporaryPromptWithTabs(promptText, attachedTabs, readPromptTabContext);
            await executeMissingAiPromptRequest(missingAiPromptInput, enrichedPrompt);
            setMissingAiPromptInput(null);
        }
        catch (error) {
            console.error('[App] Failed to run AI prompt from missing prompt popup:', error);
            triggerNotification('Failed to run AI prompt', 'error');
        }
        finally {
            setIsSendingMissingAiPrompt(false);
        }
    }, [missingAiPromptInput, isSendingMissingAiPrompt, triggerNotification]);
    const selectedSnippet = useSelectedSnippet();
    const snippetBreadCrum = useUIStore((s: any) => s.snippetBreadcrumb);
    const isCreatingNewItem = useUIStore((s: any) => s.activeEditor?.id === 'new');
    const isEditorExpanded = isCreatingNewItem ||
        !!selectedSnippet ||
        activeView?.type === 'bulk'
        ||
            activeView?.type === 'store';
    const isActuallyExpanded = isEditorExpanded || isLinkEditModalOpen;
    const isFocusMode = useUIStore((s: any) => s.isFocusMode);
    const isTodoSidebarOpen = useUIStore((s: any) => s.activeSidebars.todoSidebar.open);
    const isDark = theme.isDark;
    // Filter panel state (managed by SideBar, shown on right side)
    // Ensure Focus Mode is always off on initial load/refresh and return to Home
    useEffect(() => {
        useUIStore.getState().toggleFocusMode(false);
        useUIStore.getState().setSelectedSnippetId(null);
        // Removed closeEditor() to prevent race conditions with useUrlTriggers which opens the editor on load
    }, []);
    // Searchbar ref and handlers - shared between SideBar and Container
    const searchbarRef = useRef<SearchbarHandle | null>(null);
    // Track if any search sub-menu is open to hide main content
    const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
    const [isBoardViewOpen, setIsBoardViewOpen] = useState(false);
    const [isWidgetEditMode, setIsWidgetEditMode] = useState(false);
    const [pendingSelectedWidgetId, setPendingSelectedWidgetId] = useState<string | null>(null);
    const shouldAutoCollapseLeftSidebar = Boolean(activeEditor) &&
        !activeEditor?.props?.isOverlay &&
        ['note', 'snippet', 'link', 'session', 'todo', 'aiPrompt'].includes(String(activeEditor?.type || ''));
    const shouldUseIconOnlyLeftSidebar = shouldAutoCollapseLeftSidebar || isWorkspaceCollectionView || isShortcutsSidebarCompact;
    const handleEnterWidgetEditMode = useCallback((widgetId?: string) => {
        setIsWidgetEditMode(true);
        if (widgetId) {
            setPendingSelectedWidgetId(widgetId);
        }
    }, []);
    const handleExitWidgetEditMode = useCallback(() => {
        setIsWidgetEditMode(false);
        setPendingSelectedWidgetId(null);
    }, []);
    useEffect(() => {
        const isHomeOrDefaultView = !activeView?.type || activeView.type === 'home';
        const shouldExitWidgetEditMode = !isHomeOrDefaultView ||
            isFocusMode ||
            isSpreadsheetViewOpen ||
            showTutorial ||
            isEmbedded ||
            Boolean(activeEditor);
        if (shouldExitWidgetEditMode) {
            setIsWidgetEditMode(false);
            setPendingSelectedWidgetId(null);
        }
    }, [activeEditor, activeView?.type, isEmbedded, isFocusMode, isSpreadsheetViewOpen, showTutorial]);
    // Escape key handler for exiting Widget Edit Mode safely
    useEffect(() => {
        if (!isWidgetEditMode)
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            // Check if any higher priority overlay or modal is active
            const hasActiveModalOrOverlay = isSpreadsheetViewOpen ||
                isFullScreenModalOpen ||
                isGlobalCreateMenuOpen ||
                isLinkEditModalOpen ||
                Boolean(activeEditor) ||
                Boolean((window as any)?.isGlobalCreateMenuOpen);
            // Check if focus is inside an input, textarea, or contentEditable element
            const target = event.target as HTMLElement | null;
            const isInputFocused = target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable);
            if (!hasActiveModalOrOverlay && !isInputFocused) {
                setIsWidgetEditMode(false);
                setPendingSelectedWidgetId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isWidgetEditMode,
        isSpreadsheetViewOpen,
        isFullScreenModalOpen,
        isGlobalCreateMenuOpen,
        isLinkEditModalOpen,
        activeEditor
    ]);
    // Organization panel state - tracks when org panel is open
    const [orgPanelState, setOrgPanelState] = useState<{
        isOpen: boolean;
        orgId?: string;
        orgName?: string;
    }>({ isOpen: false });
    // Search Focus (Omnibox) state for the notice
    const [isOmniboxEnabled, setIsOmniboxEnabled] = useState(true);
    const [isHotkeysHelpOpen, setIsHotkeysHelpOpen] = useState(false);
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
            chromeAny.storage.local.get(['omnibox_override_enabled'], (result: any) => {
                startupPerf('App:omniboxStorageResolved', {
                    enabled: result.omnibox_override_enabled !== false,
                });
                setIsOmniboxEnabled(result.omnibox_override_enabled !== false);
            });
            const handleStorageChange = (changes: {
                [key: string]: chrome.storage.StorageChange;
            }, areaName: string) => {
                if (areaName === 'local' && changes.omnibox_override_enabled) {
                    setIsOmniboxEnabled(changes.omnibox_override_enabled.newValue !== false);
                }
            };
            chromeAny.storage.onChanged.addListener(handleStorageChange);
            return () => {
                chromeAny.storage.onChanged.removeListener(handleStorageChange);
            };
        }
        return undefined;
    }, []);
    useUrlTriggers({
        userId,
        openSpreadsheetView,
        searchbarRef,
        setIsGlobalCreateMenuOpen,
        requestMissingAiPromptInput,
    });
    // Handle lock_command and agent_id from URL (e.g. when opening from a Link Group)
    useEffect(() => {
        if (!searchbarRef.current)
            return;
        const urlParams = new URLSearchParams(window.location.search);
        const lockCommand = urlParams.get('lock_command');
        const agentId = urlParams.get('agent_id');
        if (lockCommand === 'ai' && agentId) {
            // Execute /ai command first in lock mode
            searchbarRef.current.executeCommand('ai', { mode: 'lock' });
            // Find the agent in our data
            const agent = savedAgentById.get(agentId);
            if (agent) {
                // Select it after a short delay to ensure AI UI is ready
                setTimeout(() => {
                    searchbarRef.current?.selectSavedAgent(agent);
                }, 100);
            }
            // Clean up URL parameters after a delay to allow other components to read them
            setTimeout(() => {
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }, 500);
        }
        else if (lockCommand) {
            const cmdId = lockCommand.startsWith('/') ? lockCommand.substring(1) : lockCommand;
            searchbarRef.current.executeCommand(cmdId as any, { mode: 'lock' });
            if (!searchbarRef.current.isLocked) {
                searchbarRef.current.focus();
            }
            // Clean up URL parameters after a delay to allow other components to read them
            setTimeout(() => {
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }, 500);
        }
    }, [savedAgentById]);
    // Global message listener for background notifications (e.g. Toasts, Unified execution)
    useEffect(() => {
        const findSnippetById = (id: string | number) => useDbStore.getState().snippets.find(snippet => String(snippet.id) === String(id));
        const handleMessage = (message: any) => {
            if (message.type === 'SHOW_TOAST') {
                triggerNotification(message.message, message.toastType || 'info');
            }
            else if (message.type === 'EXECUTE_TODO') {
                const { todo } = message;
                const { category, id, value } = todo;
                if (!searchbarRef.current) {
                    console.warn('[App] EXECUTE_TODO: searchbarRef not ready');
                    return;
                }
                if (category === 'command') {
                    // Reverted to 'execute' mode as requested — opens the URL immediately if it's a URL command
                    searchbarRef.current.executeCommand((value || id) as any, { mode: 'execute' });
                    searchbarRef.current.focus();
                }
                else if (['link', 'bookmark', 'snippet', 'note'].includes(category)) {
                    // Connect to centralized snippet execution logic in Searchbar
                    const snippet = findSnippetById(id);
                    if (snippet) {
                        // Force new tab for scheduled todos as requested
                        searchbarRef.current.executeSnippet(snippet, true);
                    }
                    else if (category === 'link' && value) {
                        // Fallback for tabgroups if snippet metadata isn't available
                        const urls = value
                            .split(',')
                            .map((u: string) => u.trim())
                            .filter((u: string) => u.startsWith('http') || u.startsWith('chrome:'));
                        if (urls.length > 0)
                            searchbarRef.current.openUrls(urls, undefined, true);
                    }
                }
            }
            else if (message.type === 'EXECUTE_COMMAND') {
                // Legacy/Direct support
                const { cmdType, cmdId } = message;
                if (!searchbarRef.current)
                    return;
                if (cmdType === 'command')
                    searchbarRef.current.executeCommand(cmdId as any, { mode: 'execute' });
                /* module removed */
            }
            else if (message.type === 'TODOS_UPDATED') {
                window.dispatchEvent(new CustomEvent('todosUpdated'));
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, [triggerNotification]);
    const [isOrgPanelLoading, setIsOrgPanelLoading] = useState(false);
    const pendingLockedCommand = useUIStore((s: any) => s.pendingLockedCommand);
    const pendingAgent = useUIStore((s: any) => s.pendingAgent);
    useEffect(() => {
        if (searchbarRef.current) {
            if (pendingLockedCommand) {
                const { commandId, mode } = pendingLockedCommand;
                // Close Sheet UI if open
                if (isSpreadsheetViewOpen) {
                    setIsSpreadsheetViewOpen(false);
                }
                // Execute the command
                searchbarRef.current?.clear();
                setTimeout(() => {
                    searchbarRef.current?.executeCommand(commandId as any, { mode });
                }, 100);
                // Clear the pending state
                useUIStore.getState().setPendingLockedCommand(null);
            }
            else if (pendingAgent) {
                if (isSpreadsheetViewOpen) {
                    setIsSpreadsheetViewOpen(false);
                }
                setTimeout(() => {
                    searchbarRef.current?.selectSavedAgent(pendingAgent);
                    searchbarRef.current?.focus();
                }, 100);
                useUIStore.getState().setPendingAgent(null);
            }
        }
    }, [pendingLockedCommand, pendingAgent, isSpreadsheetViewOpen]);
    const handleOrganizationPanelChange = useCallback((state: {
        isOpen: boolean;
        orgId?: string;
        orgName?: string;
        loading?: boolean;
    }) => {
        setOrgPanelState({
            isOpen: state.isOpen,
            orgId: state.orgId,
            orgName: state.orgName,
        });
        if (state.loading !== undefined) {
            setIsOrgPanelLoading(state.loading);
        }
    }, []);
    const [createOrganisationModal, setCreateOrganisationModal] = useState<{
        isOpen: boolean;
        defaultAccess: 'public' | 'private' | 'shareonly';
        isPersonalSpace: boolean;
    }>({
        isOpen: false,
        defaultAccess: 'public',
        isPersonalSpace: false,
    });
    const hasActivePopup = activeEditor?.type === 'todo'
        ||
            isCreatingNewItem ||
        isLinkEditModalOpen ||
        isFullScreenModalOpen ||
        isGlobalCreateMenuOpen ||
        createOrganisationModal.isOpen;
    const handleCreateOrganisation = useCallback(() => {
        setIsSpreadsheetViewOpen(false); // Close Sheet UI if open
    }, []);
    // Load UI persistence states
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
            chromeAny.storage.local.get([
                'new_tab_show_favorites',
                'new_tab_terminal_open',
                'new_tab_expanded_organisations',
                'new_tab_is_auto_expand_mode',
                'new_tab_collapsed_organisations',
                'new_tab_collapsed_sections',
                'new_tab_is_dark_mode',
                'new_tab_is_board_view_enabled'
            ], (result: any) => {
                startupPerf('App:uiStorageResolved', {
                    hasShowFavorites: result.new_tab_show_favorites !== undefined,
                    hasAutoExpand: result.new_tab_is_auto_expand_mode !== undefined,
                    hasCollapsedOrganisations: Boolean(result.new_tab_collapsed_organisations),
                    hasCollapsedSections: Boolean(result.new_tab_collapsed_sections),
                });
                if (result.new_tab_show_favorites !== undefined) {
                    useUIStore.getState().setShowFavorites(result.new_tab_show_favorites);
                }
                if (result.new_tab_is_board_view_enabled === undefined) {
                    chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
                }
                if (result.new_tab_expanded_organisations) {
                    useUIStore.getState().expandAllOrganisations(result.new_tab_expanded_organisations);
                }
                if (result.new_tab_is_auto_expand_mode !== undefined) {
                    useUIStore.getState().setIsAutoExpandMode(result.new_tab_is_auto_expand_mode);
                }
                if (result.new_tab_collapsed_organisations) {
                    useUIStore.getState().setCollapsedOrganisations(result.new_tab_collapsed_organisations);
                }
                if (result.new_tab_collapsed_sections) {
                    useUIStore.getState().setCollapsedSections(result.new_tab_collapsed_sections);
                }
                // Mark as loaded so the saving effect (at line 612) can start persisting changes
                hasLoadedThemeRef.current = true;
            });
        }
    }, []);
    // Save UI persistence states on change
    const showFavorites = useUIStore((s: any) => s.showFavorites);
    const expandedOrganisations = useUIStore((s: any) => s.expandedOrganisations);
    const isAutoExpandMode = useUIStore((s: any) => s.isAutoExpandMode);
    const collapsedOrganisations = useUIStore((s: any) => s.collapsedOrganisations);
    const collapsedSections = useUIStore((s: any) => s.collapsedSections);
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local && hasLoadedThemeRef.current) {
            chromeAny.storage.local.set({
                new_tab_show_favorites: showFavorites,
                new_tab_expanded_organisations: expandedOrganisations,
                new_tab_is_auto_expand_mode: isAutoExpandMode,
                new_tab_collapsed_organisations: collapsedOrganisations,
                new_tab_collapsed_sections: collapsedSections,
            });
        }
    }, [
        showFavorites,
        expandedOrganisations,
        isAutoExpandMode,
        collapsedOrganisations,
        collapsedSections
    ]);
    // Listen for storage changes from the GeneralSettingsPanel
    useEffect(() => {
        const handleStorageChange = (changes: {
            [key: string]: any;
        }, areaName: string) => {
            if (areaName === 'local') {
                // Handle changes
            }
        };
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.onChanged) {
            chromeAny.storage.onChanged.addListener(handleStorageChange);
            return () => chromeAny.storage.onChanged.removeListener(handleStorageChange);
        }
        return () => { };
    }, []);
    const { isModalOpen } = useKeyboardShortcuts({
        isKeystrokeRecordingActive,
        searchbarRef,
        setIsViewDropdownOpen,
        setIsGlobalCreateMenuOpen,
    });
    // Handle global chrome command for focus
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (isKeystrokeRecordingActive()) {
                const active = document.activeElement as HTMLElement;
                if (active) {
                    if (message && (message.type === BRAND.events.focusSearch || message.type === BRAND.legacyEvents.focusSearch)) {
                        active.dispatchEvent(new KeyboardEvent('keydown', { key: 's', altKey: true, bubbles: true, cancelable: true }));
                    }
                }
                return;
            }
            if (message && (message.type === BRAND.events.focusSearch || message.type === BRAND.legacyEvents.focusSearch)) {
                window.focus(); // Vital to steal focus back from Omnibox
                setTimeout(() => {
                    if (searchbarRef.current) {
                        searchbarRef.current.focus();
                    }
                }, 100);
            }
            else if (message && message.type === 'focus_sheet_ui_first_column') {
                window.focus(); // Vital to steal focus back from Omnibox
                // Step 1: Trigger Alt+K behavior first to violently steal focus from the Omnibox
                if (searchbarRef.current) {
                    searchbarRef.current.focus();
                }
                // Step 2: Trigger Alt+A behavior
                setTimeout(() => {
                    openSpreadsheetView();
                    // Let SpreadsheetTable's internal logic handle focusing the first data row or search
                    useSpreadsheetStore.getState().setSelectedCell({ rowIndex: 0, colIndex: 0 });
                }, 50);
            }
        };
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(handleMessage);
            return () => chrome.runtime.onMessage.removeListener(handleMessage);
        }
        return undefined;
    }, []);
    // Proactively track focus state and persist it to chrome.storage.local.
    // This is far more reliable than calling document.hasFocus() at keypress time
    // because the act of pressing shortcuts can itself briefly change focus state.
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local)
            return;
        let blurTimeout: any;
        const reportFocus = (hasFocus: boolean) => {
            // Use the per‑tab key (focusKey) defined earlier
            chromeAny.storage.local.set({ [focusKey]: hasFocus });
        };
        // SAFETY: Immediately reset to false on every fresh page load.
        reportFocus(false);
        // After a short delay, read the real focus state.
        const initTimer = setTimeout(() => {
            reportFocus(document.hasFocus());
        }, 200);
        const onFocus = () => {
            if (blurTimeout)
                clearTimeout(blurTimeout);
            reportFocus(true);
        };
        const onBlur = () => {
            if (blurTimeout)
                clearTimeout(blurTimeout);
            // Delay reporting blur by 300ms to avoid false negatives from Alt key combinations
            blurTimeout = setTimeout(() => {
                reportFocus(false);
            }, 300);
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        return () => {
            clearTimeout(initTimer);
            if (blurTimeout)
                clearTimeout(blurTimeout);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
            // Clean up the flag when this tab unmounts
            if (focusKey)
                chromeAny.storage.local.remove(focusKey);
        };
    }, [focusKey]);
    // Automatically focus our custom search bar when the AltS_search_newtab page is opened/rendered
    // Also force window focus to ensure keyboard events (hotkeys) are captured immediately
    useEffect(() => {
        // Force window focus to capture keyboard events immediately
        // This ensures hotkeys work without needing to click on the page first
        window.focus();
        const enterTimeout = window.setTimeout(() => {
            if (searchbarRef.current && !isModalOpen()) {
                searchbarRef.current.focus();
            }
        }, 60); // Match AltS delay (60ms)
        // Listen for visibility changes to recapture focus when the tab becomes active
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                window.focus();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            if (enterTimeout !== undefined) {
                window.clearTimeout(enterTimeout);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isModalOpen]);
    // Load cached data on mount once auth has resolved.
    // This keeps the root local-first without the old Redux bootstrap.
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (hasInitialized.current)
            return;
        hasInitialized.current = true;
        // Reset stuck editor states on fresh tab load / refresh if not triggered by URL parameters
        const hasUrlTrigger = typeof window !== 'undefined' && (window as any).__hasUrlTrigger;
        if (!hasUrlTrigger) {
            useUIStore.getState().clearEditorStates();
        }
    }, []);
    const [commandListCategory, setCommandListCategory] = useState<string>('commands');
    const [activeCommandSection, setActiveCommandSection] = useState<string>('local');
    const [organizationHandlers, setOrganizationHandlers] = useState<{
        onOrganizationSettings: (orgId: string, orgName: string) => void;
        onCreateOrganization: () => void;
    } | null>(null);
    const closeSpreadsheetView = useCallback(() => {
        setIsSpreadsheetViewOpen(false);
        
    }, [activeView?.type]);
    const handleBoardViewRedirectFromSheet = useCallback(() => {
        useUIStore.getState().returnToHome();
        setIsSpreadsheetViewOpen(false);
        setIsInitialAltSFocus(true);
    }, []);
    const handleSearchbarFocus = useCallback((isUserInitiated?: boolean) => {
        if (isUserInitiated) {
            useUIStore.getState().setSidebar('todoSidebar', { open: false });
            console.log('[ESCAPE][handleSearchbarFocus] isUserInitiated=true, closing spreadsheet. activeLockedCommand:', activeLockedCommand);
            setIsSpreadsheetViewOpen(false);
        }
    }, [activeLockedCommand]);
    const handleOrganizationHandlersReady = useCallback((handlers: any) => {
        setOrganizationHandlers({
            onOrganizationSettings: (orgId, orgName) => {
                setIsSpreadsheetViewOpen(false);
                handlers.onOrganizationSettings(orgId, orgName);
            },
            onCreateOrganization: () => {
                setIsSpreadsheetViewOpen(false);
                handlers.onCreateOrganization();
            },
        });
    }, []);
    const handleToggleFavorites = useCallback(() => {
        useUIStore.getState().setShowFavorites(!showFavorites);
    }, [showFavorites]);
    const handleToggleFocusMode = useCallback(() => {
        useUIStore.getState().toggleFocusMode(!isFocusMode);
    }, [isFocusMode]);
    const handleNavigateToListView = useCallback((type: 'notes' | 'links' | 'commands', section?: string) => {
        setIsSpreadsheetViewOpen(false);
        // Explicitly wipe reader and editor states on navigation to guarantee a clean view
        useUIStore.getState().closeSheet();
        useUIStore.getState().clearEditorStates();
        useUIStore.getState().setView({ type: 'home' });
        setCommandListCategory('commands');
        if (section) {
            setActiveCommandSection(section);
        }
        else {
            // Fallback mapping if section is not provided
            const sectionMap: Record<string, string> = {
                notes: 'notes',
                links: 'links',
                commands: 'local',
            };
            setActiveCommandSection(sectionMap[type] || 'local');
        }
    }, []);
    // Handle edit link/Tab Session/prompt from FavoritesPanel (same flow as Container.handleHomeLinkEdit)
    const handleFavoriteLinkEdit = useCallback((item: {
        snippet: any;
        organisation: any;
    }) => {
        const { snippet, organisation } = item;
        if (!snippet)
            return;
        const category = (snippet.category || '').toLowerCase();
        // Links and Tab Sessions: open LinkEditModal
        useUIStore.getState().openEditor({ type: 'link', id: 'edit', props: { editMode: true, snippet } });
    }, []);
    // Ref for the main container to capture keyboard focus
    const mainContainerRef = useRef<HTMLDivElement>(null);
    // Focus the main container on mount to capture keyboard events immediately
    useEffect(() => {
        // Give the searchbar a chance to autoFocus first.
        // Only focus the container if nothing else is focused.
        const t = window.setTimeout(() => {
            const active = document.activeElement as HTMLElement | null;
            const isTextInputFocused = !!active &&
                (active.tagName === 'INPUT' ||
                    active.tagName === 'TEXTAREA' ||
                    active.isContentEditable ||
                    active.getAttribute?.('role') === 'textbox');
            if (!mainContainerRef.current)
                return;
            if (!active || active === document.body) {
                mainContainerRef.current.focus();
            }
            else if (!isTextInputFocused) {
                mainContainerRef.current.focus();
            }
        }, 120);
        return () => window.clearTimeout(t);
    }, []);
    // Watch for mainView changes to forcefully close the Automation Panel (isSpreadsheetViewOpen)
    // so we don't get trapped in a state where AutomationPanel overlays the intended view.
    useEffect(() => {
                if (isSpreadsheetViewOpen) {
            if ((activeEditor?.type === 'todo' && !activeEditor?.props?.isOverlay) ||
                activeEditor?.type === 'agent' ||
                activeEditor?.type === 'ai' ||
                (activeEditor?.type === 'link' && !activeEditor?.props?.isOverlay)) {
                setIsSpreadsheetViewOpen(false);
            }
        }
    }, [
        activeView?.type,
        isLinkEditModalOpen,
        isSpreadsheetViewOpen,
        selectedSnippet?.id,
        isCreatingNewItem,
        activeEditor?.type
    ]);
    // Escape key handler to close organization/billing panels and return to Home
    useEffect(() => {
        const isOrgOrBillingView = activeView?.type === 'createOrganisation' ||
            false;
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            if (isOrgOrBillingView) {
                useUIStore.getState().returnToHome();
                return true;
            }
            return false;
        });
        return unregister;
    }, [activeView?.type]);
    // Context-aware Documentation URL
    const getDocumentationUrl = useCallback((lockedCommand: string | null, currentView: any, linkModalOpen: boolean): string => {
        // Priority 1: Check locked command (Searchbar explicit lock)
        const docMap: Record<string, string> = {
            note: '/notes',
            fullscreennote: '/notes',
            link: '/links',
            links: '/links',
            snippets: '/notes',
            todo: '/todos',
            screenshot: '/screenshots',
            ai: '/commands/ai',
        };
        if (lockedCommand && docMap[lockedCommand]) {
            return `${BRAND.docs.root}${docMap[lockedCommand]}`;
        }
        // Priority 2: Check Link Edit Modal (Overrides main view if open)
        if (linkModalOpen) {
            return BRAND.docs.links;
        }
        // Priority 3: Check current main view (Redux state)
        if (currentView) {
            switch (currentView.kind) {
                case 'noteEditor':
                    return BRAND.docs.notes;
                case 'linkEditor':
                    return BRAND.docs.links;
                case 'todos':
                    return BRAND.docs.todos;
                case 'store':
                    // maybe just docs or specific store docs
                    return BRAND.docs.root;
                case 'allItems':
                    if (currentView.itemType === 'notes')
                        return BRAND.docs.notes;
                    if (currentView.itemType === 'links')
                        return BRAND.docs.links;
                    break;
            }
        }
        return BRAND.docs.root;
    }, []);
    const handleLockedCommandChange = useCallback((commandId: string | null) => {
        useUIStore.getState().setLockedCommand(commandId);
    }, []);
    
    
    const handleOpenGeneralSettings = useCallback(() => {
        useUIStore.getState().setView(getDefaultSettingsView());
    }, []);
    const isKnowledgeGraphView = activeView?.type === 'knowledgeGraph';
    const showSidebarColumn = !isFocusMode && !isEmbedded;
    const isOnboardingDecisionPending = onboardingStatus === 'checking';
    const isFirstRunOnboarding = !onboardingCompletedHintOnBoot.current && onboardingStatus === 'incomplete' && showTutorial;
    const shouldRenderMainApp = !isOnboardingDecisionPending && !isFirstRunOnboarding;
    const shouldShowAppBackground = !isOnboardingDecisionPending && !isFirstRunOnboarding;
    // Keep the selected decoration behind the outer navigation and settings view.
    // Functional views provide their own neutral backing in AppMainContent.
    const shouldShowDecorativeBackground = shouldShowAppBackground && !isSpreadsheetViewOpen;
    useEffect(() => {
        startupPerf('App:commit', {
            renderCount: renderCountRef.current,
            themeId,
            onboardingStatus,
            showTutorial,
            shouldRenderMainApp,
            activeViewType: activeView?.type || 'none',
            activeEditorType: activeEditor?.type || 'none',
            isSpreadsheetViewOpen,
            suggestionVisible: Boolean(suggestionState),
        });
    });
    return (<DndProvider backend={HTML5Backend}>
      <div ref={mainContainerRef} tabIndex={-1} className={`flex h-screen text-[var(--color-textPrimary)] !rounded-none relative overflow-hidden outline-none ${shouldShowAppBackground ? 'bg-[var(--color-rootBg)]' : 'bg-white'}`} style={isEmbedded ? { background: 'transparent' } : undefined}>
        {isEmbedded && (<style>{`
            body, html, html.dark, html.dark body {
              background: transparent !important;
              background-image: none !important;
            }
            /* Hide top padding and margins */
            .pt-\\[56px\\], .pt-\\[64px\\] {
              padding-top: 0px !important;
            }
            .main-content-layout {
              margin-left: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
            }
          `}</style>)}
        {!isEmbedded && shouldShowDecorativeBackground && <WallpaperLayer />}
        {!isEmbedded && shouldShowAppBackground && <WarmTintLayer />}
        <div id="ai-history-anchor"/>
        {shouldRenderMainApp && (<>
            {/* Global Branding - Always visible in top left */}
            {!isEmbedded && !isSpreadsheetViewOpen && showSidebarColumn && (<div className="absolute top-0 left-0 z-[10000] pointer-events-auto flex h-12 items-center justify-start pl-4" style={{
                    width: shouldUseIconOnlyLeftSidebar
                        ? LEFT_SIDEBAR_WIDTHS.iconOnly
                        : LEFT_SIDEBAR_WIDTHS.readableCollapsed,
                }}>
                <Branding className="!p-0 !gap-0" showAvatar={false} showText={false} onClick={() => {
                    if (isSpreadsheetViewOpen)
                        setIsSpreadsheetViewOpen(false);
                    useUIStore.getState().closeEditor();
                    useUIStore.getState().returnToHome();
                }}/>
              </div>)}

            {/* Floating Right-Center Control Group */}
            {!isEmbedded &&
                !isSpreadsheetViewOpen &&
                !isFocusMode &&
                !activeEditor &&
                !isKnowledgeGraphView &&
                !isWorkspaceCollectionView &&
                activeView?.type !== 'collections' &&
                activeView?.type !== 'timeline' && (<HeaderControls isWidgetEditMode={isWidgetEditMode} onToggleWidgetEditMode={() => setIsWidgetEditMode(prev => !prev)} onOpenCommandShortcuts={openAllCommandShortcuts}/>)}

            <div className={isSpreadsheetViewOpen ? 'hidden' : 'contents'}>
              <AppLeftSidebar showSidebarColumn={showSidebarColumn} backgroundRefresh={backgroundRefresh} openSpreadsheetView={openSpreadsheetView} searchbarRef={searchbarRef} setIsSpreadsheetViewOpen={setIsSpreadsheetViewOpen} savedAgentById={savedAgentById} handleNavigateToListView={handleNavigateToListView} handleFavoriteLinkEdit={handleFavoriteLinkEdit} isIconOnly={shouldUseIconOnlyLeftSidebar} onOpenShortcuts={() => setIsShortcutsSidebarCompact(true)} onOpenCommands={() => setIsShortcutsSidebarCompact(false)}/>
            </div>

            <AppMainContent isViewDropdownOpen={isViewDropdownOpen} isFullScreenModalOpen={isFullScreenModalOpen} theme={theme} hasActivePopup={hasActivePopup} isLinkEditModalOpen={isLinkEditModalOpen} setSuggestionState={setSuggestionState} backgroundRefresh={backgroundRefresh} searchbarRef={searchbarRef} isSpreadsheetViewOpen={isSpreadsheetViewOpen} openSpreadsheetView={openSpreadsheetView} handleCreateOrganisation={handleCreateOrganisation} closeSpreadsheetView={closeSpreadsheetView} handleBoardViewRedirectFromSheet={handleBoardViewRedirectFromSheet} setIsSearchMenuOpen={setIsSearchMenuOpen} setIsBoardViewOpen={setIsBoardViewOpen} isInitialAltSFocus={isInitialAltSFocus} setIsInitialAltSFocus={setIsInitialAltSFocus} setIsGlobalCreateMenuOpen={setIsGlobalCreateMenuOpen} commandListCategory={commandListCategory} setCommandListCategory={setCommandListCategory} activeCommandSection={activeCommandSection} setActiveCommandSection={setActiveCommandSection} handleOrganizationHandlersReady={handleOrganizationHandlersReady} handleOrganizationPanelChange={handleOrganizationPanelChange} handleNavigateToListView={handleNavigateToListView} activeLockedCommand={activeLockedCommand} isSearchMenuOpen={isSearchMenuOpen} handleLockedCommandChange={handleLockedCommandChange} handleSearchbarFocus={handleSearchbarFocus} setIsViewDropdownOpen={setIsViewDropdownOpen} isFocusMode={isFocusMode} isEmbedded={isEmbedded} isCreatingNewItem={isCreatingNewItem} isWidgetEditMode={isWidgetEditMode} onEnterWidgetEditMode={handleEnterWidgetEditMode} onExitWidgetEditMode={handleExitWidgetEditMode} pendingSelectedWidgetId={pendingSelectedWidgetId} selectedSnippet={selectedSnippet} showSidebarColumn={showSidebarColumn} isLeftSidebarIconOnly={shouldUseIconOnlyLeftSidebar}/>
          </>)}

        <OnboardingOverlayController show={showTutorial && !isOnboardingDecisionPending} onboardingCompleted={isOnboardCompleted} onClose={() => setShowTutorial(false)} onMarkCompleted={() => {
            setOnboardingCompletedHint(true);
            setIsOnboardCompleted(true);
            setOnboardingStatus('complete');
        }} reload={backgroundRefresh}/>

        {shouldRenderMainApp && !isEmbedded && !isSpreadsheetViewOpen && isWidgetEditMode && (<RightSideWidget onClose={() => setIsWidgetEditMode(false)}/>)}

        {/* TodoFloatingPreview is now rendered inside CreateTodoSelectionView for perfect vertical alignment */}
      </div>

      {shouldRenderMainApp && (<AppModals createOrganisationModal={createOrganisationModal} setCreateOrganisationModal={setCreateOrganisationModal} backgroundRefresh={backgroundRefresh} isGlobalCreateMenuOpen={isGlobalCreateMenuOpen} setIsGlobalCreateMenuOpen={setIsGlobalCreateMenuOpen} openSpreadsheetView={openSpreadsheetView} searchbarRef={searchbarRef}/>)}

      {shouldRenderMainApp && missingAiPromptInput && (<React.Suspense fallback={null}>
          <MissingAiPromptInputModal title={missingAiPromptInput.title} rules={String((missingAiPromptInput.promptRecord as (NonNullable<typeof missingAiPromptInput.promptRecord> & {
                description?: string;
            }) | undefined)?.description
                || missingAiPromptInput.promptRecord?.rules
                || missingAiPromptInput.promptRecord?.prompt
                || '')} initialPrompt={missingAiPromptInput.initialPrompt} allowEmpty={Boolean(missingAiPromptInput.promptRecord &&
                !missingAiPromptInput.directPrompt &&
                hasRunnableAiPrompt(missingAiPromptInput.promptRecord))} isSending={isSendingMissingAiPrompt} onClose={closeMissingAiPromptInput} onEdit={missingAiPromptInput.promptRecord ? editMissingAiPrompt : undefined} onSend={sendMissingAiPromptInput}/>
        </React.Suspense>)}
    </DndProvider>);
};
export default App;

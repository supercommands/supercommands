import { AppModals } from './AppModals';
import { AppLeftSidebar } from './AppLeftSidebar';
import { AppMainContent } from './AppMainContent';
// import removed
import { useKeystrokeRecording } from '../../../../shared-components/hotkeys';
import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FiHelpCircle } from 'react-icons/fi';
import { CMDOS_DOCS_URL } from '../../../../storage/API/core/apiConfig';
import { AppTodoSidebar } from './AppTodoSidebar';
import Branding from '../../../../shared-components/Branding';
import { HeaderControls, getDefaultSettingsView } from '../../../../settings';
import { isOnboardingCompleted } from '../../../../storage/localStorage/onboardingStorage';
import { TutorialOverlay } from '../../../../welcomeGuide/TutorialOverlay';
import { useSpreadsheetStore } from '../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';

import {
  type SearchbarHandle,
  type SuggestionState,
} from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';
type Workspace = any;
type SavedAutomation = any;
import {
  useUIStore,
  useIsFullScreenModalOpen,
  useShowTodosView,
  useTodoCreatePrefill,
  useIsLinkEditModalOpen,
} from '../../../../shared-components/uiStateManager';
import { detectOS } from '../../../../shared-components/utils/osUtils';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { useDbStore } from '../../../../storage/store/useDbStore';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import useNotification from '../../../../shared-components/notifications/useNotification';
import { getUserId } from '../../../../storage/API/core/api';
import WallpaperLayer from '../../../../settings/uiPersonalization/WallpaperLayer';
import { useAppearance } from '@extension/ui';

import { useAuthSync } from './hooks/useAuthSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUrlTriggers } from './hooks/useUrlTriggers';

import {
  useSelectedWorkspace,
  useSelectedFolder,
  useSelectedSnippet,
} from '../../../../shared-components/localEntitySelectors';

const App: React.FC = () => {
  const { theme, themeId } = useAppearance();

  const { isKeystrokeRecordingActive } = useKeystrokeRecording();
  const triggerNotification = useNotification();

  const [isInitialAltSFocus, setIsInitialAltSFocus] = useState(false);

  const [showTutorialButton, setShowTutorialButton] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const [suggestionState, setSuggestionState] = useState<SuggestionState | null>(null);

  const hasLoadedThemeRef = useRef(false);
  const { authChecked, userId, isLoggedIn } = useAuthSync();
  const isSpreadsheetViewOpen = useUIStore((s: any) => s.isSheetOpen);
  const activeLockedCommand = useUIStore((s: any) => s.lockedCommand);
  const [isAutomationActive, setIsAutomationActive] = useState(false);
  const setIsSpreadsheetViewOpen = useCallback((open: boolean) => {
    if (open) {
      useUIStore.getState().openSheet();
      return;
    }
    console.trace('[ESCAPE][setIsSpreadsheetViewOpen] CLOSING SHEET - called from:');
    useUIStore.getState().closeSheet();
  }, []);


  useEffect(() => {
    if (!isViewDropdownOpen) return;
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

  // Focus the searchbar reactively when entering search/columns layout
  useEffect(() => {
    if (!isSpreadsheetViewOpen && isInitialAltSFocus) {
      searchbarRef.current?.focus();
    }
  }, [isInitialAltSFocus, isSpreadsheetViewOpen, activeView?.type]);
  const isFullScreenModalOpen = useIsFullScreenModalOpen();
  const showTodosView = useShowTodosView();
  const todoCreatePrefill = useTodoCreatePrefill();
  const isLinkEditModalOpen = useIsLinkEditModalOpen();
  const activeEditor = useUIStore((s: any) => s.activeEditor);
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
    if (!isEmbedded) return;

    if (isAnyEditorOpen) {
      if (!hasOpenedCreator) {
        setHasOpenedCreator(true);
      }
    } else if (hasOpenedCreator) {
      window.parent.postMessage({ type: 'tasklabs:close-embed-creator' }, '*');
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
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('focus_sheet_ui_first_column') === 'true';
  }, []);

  const backgroundRefresh = useCallback(() => {}, []);
  const dexieWorkspaces = useDbStore(state => state.workspaces);

  // Tutorial button visibility is driven by the Dexie workspace list.
  useEffect(() => {
    setShowTutorialButton(true);
  }, [dexieWorkspaces, isLoggedIn]);

  const [showTutorial, setShowTutorial] = useState(false);
  const [isOnboardCompleted, setIsOnboardCompleted] = useState<boolean>(true);
  const hasEvaluatedCloudData = useRef(false);

  useEffect(() => {
    if (authChecked && !hasEvaluatedCloudData.current) {
      isOnboardingCompleted().then((completed: boolean) => {
        setIsOnboardCompleted(completed);
        setShowTutorial(!completed);
      });
      hasEvaluatedCloudData.current = true;
    }
  }, [authChecked]);

  // Detect OS
  useEffect(() => {
    detectOS().then(os => {
      useUIStore.getState().setOS(os);
    });
  }, []);

  const selectedTeam = useUIStore((s: any) => s.selectedTeam);
  const teamList = useMemo(() => (selectedTeam ? [selectedTeam] : []), [selectedTeam]);
  const selectedWorkspace = useSelectedWorkspace();
  const selectedFolder = useSelectedFolder();

  const savedAgentById = useMemo(() => {
    const map = new Map<string, any>();

    const getStepsCount = (automation: any): number => {
      if (Array.isArray(automation?.steps)) return automation.steps.length;
      if (Array.isArray(automation?.automation_steps)) return automation.automation_steps.length;
      return 0;
    };

    const getInputsCount = (automation: any): number => {
      if (Array.isArray(automation?.inputs)) return automation.inputs.length;
      if (Array.isArray(automation?.automation_inputs)) return automation.automation_inputs.length;
      return 0;
    };

    const isSavedAgent = (automation: any): boolean => {
      const steps = automation?.automation_steps || automation?.steps || [];
      if (!Array.isArray(steps)) return false;

      return steps.some((s: any) => {
        const moduleId = String(
          s?.module_id || s?.moduleId || s?.module || s?.module_key || s?.type || '',
        ).toLowerCase();
        return moduleId === '5' || moduleId === 'agent' || s?.config?.agentId === 'all_ai' || s?.config?.isAllAi;
      });
    };

    const put = (automation: any, workspaceId?: string, folderId?: string, forceIsAgent = false) => {
      if (!automation) return;
      if (!forceIsAgent && !isSavedAgent(automation)) return;

      const id = String(automation?.id || automation?.automation_id || '');
      if (!id) return;

      const candidate = {
        ...automation,
        id,
        workspace_id: automation?.workspace_id || workspaceId,
        folder_id: automation?.folder_id || folderId,
      };

      const existing = map.get(id);
      if (!existing) {
        map.set(id, candidate);
        return;
      }

      const existingScore = getStepsCount(existing) * 10 + getInputsCount(existing);
      const incomingScore = getStepsCount(candidate) * 10 + getInputsCount(candidate);
      if (incomingScore > existingScore) {
        map.set(id, candidate);
      }
    };

    const walkFolders = (folders: any[], workspaceId: string) => {
      (folders || []).forEach(folder => {
        (folder?.automations || []).forEach((automation: any) => {
          put(automation, workspaceId, folder?.folder_id);
        });

        if (Array.isArray(folder?.folders) && folder.folders.length > 0) {
          walkFolders(folder.folders, workspaceId);
        }
      });
    };

    teamList.forEach(team => {
      (team?.workspaces || []).forEach((workspace: any) => {
        (workspace?.workspace_automations || []).forEach((automation: any) => {
          put(automation, workspace?.workspace_id);
        });

        // ≡ƒÜÇ Add support for specialized agent arrays (Chat Agents, Agents)
        (workspace?.workspace_chat_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id, undefined, true);
        });
        (workspace?.chat_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id, undefined, true);
        });
        (workspace?.workspace_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id, undefined, true);
        });

        walkFolders(workspace?.folders || [], workspace?.workspace_id);
      });
    });

    return map;
  }, [teamList]);

  useEffect(() => {
    const handleSetViewMode = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      if (mode === 'board') {
        setIsSpreadsheetViewOpen(false);
        searchbarRef.current?.clear();
        setIsInitialAltSFocus(true);
        chrome.storage.local.set({ new_tab_is_board_view_enabled: true });
      } else if (mode === 'sheet') {
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
  }, [isLoggedIn]);

  useEffect(() => {
    const handleOpenTutorial = () => setShowTutorial(true);
    window.addEventListener('openTutorial', handleOpenTutorial);
    return () => window.removeEventListener('openTutorial', handleOpenTutorial);
  }, []);

  const openSpreadsheetView = useCallback(
    (section?: string) => {
      useUIStore.getState().openSheet(section ?? null);

      if (section === 'saved-automation') {
        useSpreadsheetStore.getState().setCategoryFilter(['automation', 'agent', 'module']);
      } else if (section === 'collections') {
        const state = useSpreadsheetStore.getState();
        state.setCategoryFilter(['all']);
        state.setVisibilityFilter(['all']);
        state.setSpaceFilter(['all']);
      } else if (section) {
        const state = useSpreadsheetStore.getState();
        state.setTargetSection(section);
        // Ensure section is expanded
        if (state.collapsedSections.includes(section)) {
          state.toggleSection(section);
        }
      }
    },
    [activeView?.type, isSpreadsheetViewOpen],
  );

  const selectedSnippet = useSelectedSnippet();
  const snippetBreadCrum = useUIStore((s: any) => s.snippetBreadcrumb);
  const isCreatingNewItem = useUIStore((s: any) => s.activeEditor?.id === 'new');
  const isEditorExpanded =
    isCreatingNewItem ||
    !!selectedSnippet ||
    activeView?.type === 'bulk' ||
    false ||
    activeView?.type === 'store' ||
    showTodosView;
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

  // Organization panel state - tracks when org panel is open
  const [orgPanelState, setOrgPanelState] = useState<{
    isOpen: boolean;
    orgId?: string;
    orgName?: string;
  }>({ isOpen: false });

  // Shared helper: close every open view/overlay so shortcuts always land cleanly.
  // actionType is the pending action type for the UnsavedChangesDialog to execute after confirmation.
  const dismissAllViews = useCallback(
    (actionType: 'SHORTCUT_BOARD_VIEW' | 'SHORTCUT_CREATE_MENU' = 'SHORTCUT_BOARD_VIEW') => {
      // Navigate back to home (closes noteEditor, linkEditor, orgSettings, etc.)
      useUIStore.getState().setView({ type: 'home' });
      // Close panels / overlays
      setIsSpreadsheetViewOpen(false);
      setOrgPanelState({ isOpen: false });
      setIsGlobalCreateMenuOpen(false);
    },
    [setIsSpreadsheetViewOpen, setOrgPanelState, setIsGlobalCreateMenuOpen],
  );

  // Alt+S/Focus Initialization Flow – dismiss everything then enable board view
  const handleAltSInitialization = useCallback(
    (forceBoardView?: boolean) => {
      dismissAllViews('SHORTCUT_BOARD_VIEW');

      if (forceBoardView) {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
        }
      } else if (!isInitialAltSFocus) {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
        }
      }
      setIsInitialAltSFocus(true);
    },
    [dismissAllViews, isInitialAltSFocus, setIsInitialAltSFocus],
  );

  // Search Focus (Omnibox) state for the notice
  const [isOmniboxEnabled, setIsOmniboxEnabled] = useState(true);
  const [isHotkeysHelpOpen, setIsHotkeysHelpOpen] = useState(false);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['omnibox_override_enabled'], (result: any) => {
        setIsOmniboxEnabled(result.omnibox_override_enabled !== false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
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
    dismissAllViews,
    handleAltSInitialization,
  });

  // Handle lock_command and agent_id from URL (e.g. when opening from a Link Group)
  useEffect(() => {
    if (!searchbarRef.current) return;

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
    } else if (lockCommand) {
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
    const findSnippetById = (id: string | number) => {
      const actualId = String(id);
      for (const team of teamList || []) {
        for (const ws of team.workspaces || []) {
          const wsSnippet = ws.workspace_snippets?.find((s: any) => String(s.id) === actualId);
          if (wsSnippet) return wsSnippet;
          for (const folder of ws.folders || []) {
            const fSnippet = folder.snippets?.find((s: any) => String(s.id) === actualId);
            if (fSnippet) return fSnippet;
          }
        }
      }
      return null;
    };

    const handleMessage = (message: any) => {
      if (message.type === 'SHOW_TOAST') {
        triggerNotification(message.message, message.toastType || 'info');
      } else if (message.type === 'EXECUTE_TODO') {
        const { todo } = message;
        const { category, id, value, automationObj, key } = todo;

        if (!searchbarRef.current) {
          console.warn('[App] EXECUTE_TODO: searchbarRef not ready');
          return;
        }

        if (category === 'command') {
          // Reverted to 'execute' mode as requested — opens the URL immediately if it's a URL command
          searchbarRef.current.executeCommand((value || id) as any, { mode: 'execute' });
          searchbarRef.current.focus();
        } else if (category === 'module') {
          /* executeModule removed */
          searchbarRef.current.focus();
        } else if (category === 'automation') {
          if (automationObj) {
            searchbarRef.current.activateAutomation(automationObj);
          } else {
            console.warn('[App] EXECUTE_TODO: automationObj missing');
          }
          searchbarRef.current.focus();
        } else if (['link', 'bookmark', 'snippet', 'note'].includes(category)) {
          // Connect to centralized snippet execution logic in Searchbar
          const snippet = findSnippetById(id);
          if (snippet) {
            // Force new tab for scheduled todos as requested
            searchbarRef.current.executeSnippet(snippet, true);
          } else if (category === 'link' && value) {
            // Fallback for tabgroups if snippet metadata isn't available
            const urls = value
              .split(',')
              .map((u: string) => u.trim())
              .filter((u: string) => u.startsWith('http') || u.startsWith('chrome:'));
            if (urls.length > 0) searchbarRef.current.openUrls(urls, undefined, true);
          }
        }
      } else if (message.type === 'EXECUTE_COMMAND') {
        // Legacy/Direct support
        const { cmdType, cmdId } = message;
        if (!searchbarRef.current) return;
        if (cmdType === 'command') searchbarRef.current.executeCommand(cmdId as any, { mode: 'execute' });
        /* module removed */
      } else if (message.type === 'EXECUTE_AUTOMATION') {
        // Legacy/Direct support
        if (!searchbarRef.current) return;
        if (message.automation) searchbarRef.current.activateAutomation(message.automation);
      } else if (message.type === 'TODOS_UPDATED') {
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [triggerNotification, teamList]);

  const [isOrgPanelLoading, setIsOrgPanelLoading] = useState(false);

  const pendingLockedCommand = useUIStore((s: any) => s.pendingLockedCommand);
  const pendingAutomation = useUIStore((s: any) => s.pendingAutomation);
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
      } else if (pendingAutomation) {
        if (isSpreadsheetViewOpen) {
          setIsSpreadsheetViewOpen(false);
        }
        searchbarRef.current?.clear();
        setTimeout(() => {
          searchbarRef.current?.activateAutomation(pendingAutomation);
          searchbarRef.current?.focus();
        }, 100);
        useUIStore.getState().setPendingAutomation(null);
      } else if (pendingAgent) {
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
  }, [pendingLockedCommand, pendingAutomation, pendingAgent, isSpreadsheetViewOpen]);

  const handleOrganizationPanelChange = useCallback(
    (state: { isOpen: boolean; orgId?: string; orgName?: string; loading?: boolean }) => {
      setOrgPanelState({
        isOpen: state.isOpen,
        orgId: state.orgId,
        orgName: state.orgName,
      });
      if (state.loading !== undefined) {
        setIsOrgPanelLoading(state.loading);
      }
    },
    [],
  );

  const [createWorkspaceModal, setCreateWorkspaceModal] = useState<{
    isOpen: boolean;
    defaultAccess: 'public' | 'private' | 'shareonly';
    isPersonalSpace: boolean;
    targetTeamId?: string;
  }>({
    isOpen: false,
    defaultAccess: 'public',
    isPersonalSpace: false,
  });

  const hasActivePopup =
    activeEditor?.type === 'todo' ||
    false ||
    isCreatingNewItem ||
    isLinkEditModalOpen ||
    isFullScreenModalOpen ||
    isGlobalCreateMenuOpen ||
    createWorkspaceModal.isOpen;

  const handleCreateWorkspace = useCallback(() => {
    setIsSpreadsheetViewOpen(false); // Close Sheet UI if open
  }, []);

  // Load UI persistence states
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(
        [
          'new_tab_show_favorites',
          'new_tab_terminal_open',
          'new_tab_expanded_workspaces',
          'new_tab_expanded_folders',
          'new_tab_is_auto_expand_mode',
          'new_tab_collapsed_workspaces',
          'new_tab_collapsed_folders',
          'new_tab_collapsed_sections',
          'new_tab_is_sidebar_collapsed',
          'new_tab_is_dark_mode',
          'new_tab_is_board_view_enabled',
        ],
        (result: any) => {
          if (result.new_tab_show_favorites !== undefined) {
            useUIStore.getState().setShowFavorites(result.new_tab_show_favorites);
          }
          if (result.new_tab_is_board_view_enabled === undefined) {
            chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
          }

          if (result.new_tab_expanded_workspaces) {
            useUIStore.getState().expandAllWorkspaces(result.new_tab_expanded_workspaces);
          }
          if (result.new_tab_expanded_folders) {
            useUIStore.getState().expandAllFolders(result.new_tab_expanded_folders);
          }
          if (result.new_tab_is_auto_expand_mode !== undefined) {
            useUIStore.getState().setIsAutoExpandMode(result.new_tab_is_auto_expand_mode);
          }
          if (result.new_tab_collapsed_workspaces) {
            useUIStore.getState().setCollapsedWorkspaces(result.new_tab_collapsed_workspaces);
          }
          if (result.new_tab_collapsed_folders) {
            useUIStore.getState().setCollapsedFolders(result.new_tab_collapsed_folders);
          }
          if (result.new_tab_collapsed_sections) {
            useUIStore.getState().setCollapsedSections(result.new_tab_collapsed_sections);
          }

          // Mark as loaded so the saving effect (at line 612) can start persisting changes
          hasLoadedThemeRef.current = true;
        },
      );
    }
  }, []);

  // Save UI persistence states on change
  const showFavorites = useUIStore((s: any) => s.showFavorites);
  const expandedWorkspaces = useUIStore((s: any) => s.expandedWorkspaces);
  const expandedFolders = useUIStore((s: any) => s.expandedFolders);
  const isAutoExpandMode = useUIStore((s: any) => s.isAutoExpandMode);
  const collapsedWorkspaces = useUIStore((s: any) => s.collapsedWorkspaces);
  const collapsedFolders = useUIStore((s: any) => s.collapsedFolders);
  const collapsedSections = useUIStore((s: any) => s.collapsedSections);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local && hasLoadedThemeRef.current) {
      chromeAny.storage.local.set({
        new_tab_show_favorites: showFavorites,

        new_tab_expanded_workspaces: expandedWorkspaces,
        new_tab_expanded_folders: expandedFolders,
        new_tab_is_auto_expand_mode: isAutoExpandMode,
        new_tab_collapsed_workspaces: collapsedWorkspaces,
        new_tab_collapsed_folders: collapsedFolders,
        new_tab_collapsed_sections: collapsedSections,
      });
    }
  }, [
    showFavorites,

    expandedWorkspaces,
    expandedFolders,
    isAutoExpandMode,
    collapsedWorkspaces,
    collapsedFolders,
    collapsedSections,
  ]);

  // Listen for storage changes from the GeneralSettingsPanel
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      if (areaName === 'local') {
        // Handle changes
      }
    };
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => chromeAny.storage.onChanged.removeListener(handleStorageChange);
    }
    return () => {};
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
          if (message && message.type === 'tasklabs:focus-search') {
            active.dispatchEvent(
              new KeyboardEvent('keydown', { key: 's', altKey: true, bubbles: true, cancelable: true }),
            );
          } else if (message && message.type === 'tasklabs:open-create-menu') {
            active.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'c', altKey: true, bubbles: true, cancelable: true }),
            );
          }
        }
        return;
      }

      if (message && message.type === 'tasklabs:force-board-view') {
        window.focus();
        setTimeout(() => {
          handleAltSInitialization(true);
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 100);
      } else if (message && message.type === 'tasklabs:focus-search') {
        window.focus(); // Vital to steal focus back from Omnibox
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 100);
      } else if (message && message.type === 'focus_sheet_ui_first_column') {
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
      } else if (message && message.type === 'tasklabs:open-create-menu') {
        window.focus(); // Vital to steal focus back from Omnibox
        dismissAllViews('SHORTCUT_CREATE_MENU');
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
          setIsGlobalCreateMenuOpen(true);
        }, 100);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
    return undefined;
  }, [dismissAllViews, handleAltSInitialization]);

  // Proactively track focus state and persist it to chrome.storage.local.
  // This is far more reliable than calling document.hasFocus() at keypress time
  // because the act of pressing Alt+C can itself briefly change focus state.
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

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
      if (blurTimeout) clearTimeout(blurTimeout);
      reportFocus(true);
    };

    const onBlur = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      // Delay reporting blur by 300ms to avoid false negatives from Alt key combinations
      blurTimeout = setTimeout(() => {
        reportFocus(false);
      }, 300);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      clearTimeout(initTimer);
      if (blurTimeout) clearTimeout(blurTimeout);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      // Clean up the flag when this tab unmounts
      if (focusKey) chromeAny.storage.local.remove(focusKey);
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
    if (!authChecked) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Reset stuck editor states on fresh tab load / refresh if not triggered by URL parameters
    const hasUrlTrigger = typeof window !== 'undefined' && (window as any).__hasUrlTrigger;
    if (!hasUrlTrigger) {
      useUIStore.getState().clearEditorStates();
    }
  }, [authChecked]);
  const [commandListCategory, setCommandListCategory] = useState<string>('commands');
  const [activeCommandSection, setActiveCommandSection] = useState<string>('local');
  const [organizationHandlers, setOrganizationHandlers] = useState<{
    onOrganizationSettings: (orgId: string, orgName: string) => void;
    onCreateOrganization: () => void;
    onWorkspaceShare: (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => void;
  } | null>(null);

  const closeSpreadsheetView = useCallback(() => {
    setIsSpreadsheetViewOpen(false);
    const isOrgView =
      activeView?.type === 'organizationSettings' ||
      activeView?.type === 'createWorkspace' ||
      activeView?.type === 'workspaceShare';
  }, [activeView?.type]);

  const handleBoardViewRedirectFromSheet = useCallback(() => {
    useUIStore.getState().setView({ type: 'home' });
    setIsSpreadsheetViewOpen(false);
    setIsInitialAltSFocus(true);
  }, []);

  const handleSearchbarFocus = useCallback(
    (isUserInitiated?: boolean) => {
      if (isUserInitiated) {
        useUIStore.getState().setSidebar('todoSidebar', { open: false });
        if (activeLockedCommand !== 'saved-automation') {
          console.log('[ESCAPE][handleSearchbarFocus] isUserInitiated=true, closing spreadsheet. activeLockedCommand:', activeLockedCommand);
          setIsSpreadsheetViewOpen(false);
        }
      }
      if (isUserInitiated && activeView?.type === 'home') {
        handleAltSInitialization();
      }
    },
    [activeLockedCommand, handleAltSInitialization, activeView?.type],
  );


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
      onWorkspaceShare: (wsId, wsName, orgId, wsType) => {
        setIsSpreadsheetViewOpen(false);
        handlers.onWorkspaceShare(wsId, wsName, orgId, wsType);
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

    setCommandListCategory('commands');
    if (section) {
      setActiveCommandSection(section);
    } else {
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
  const handleFavoriteLinkEdit = useCallback((item: { snippet: any; workspace: any; folder: any }) => {
    const { snippet, workspace, folder } = item;
    if (!snippet) return;

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
      const isTextInputFocused =
        !!active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable ||
          active.getAttribute?.('role') === 'textbox');

      if (!mainContainerRef.current) return;
      if (!active || active === document.body) {
        mainContainerRef.current.focus();
      } else if (!isTextInputFocused) {
        mainContainerRef.current.focus();
      }
    }, 120);

    return () => window.clearTimeout(t);
  }, []);

  // Watch for mainView changes to forcefully close the Automation Panel (isSpreadsheetViewOpen)
  // so we don't get trapped in a state where AutomationPanel overlays the intended view.
  useEffect(() => {
    if (
      activeView?.type === 'subscriptions' ||
      activeView?.type === 'manageSubscription' ||
      activeView?.type === 'organizationSettings' ||
      false
    ) {
      // Clean up active editors when transitioning to organization/billing views
      if (selectedSnippet?.id) useUIStore.getState().setSelectedSnippetId(null);
      if (isCreatingNewItem) useUIStore.getState().closeEditor();
      if (isLinkEditModalOpen) useUIStore.getState().closeEditor();
    }
    if (isSpreadsheetViewOpen) {
      if (
        (activeEditor?.type === 'todo' && !activeEditor?.props?.isOverlay) ||
        activeEditor?.type === 'agent' ||
        activeEditor?.type === 'ai' ||
        (activeEditor?.type === 'link' && !activeEditor?.props?.isOverlay)
      ) {
        setIsSpreadsheetViewOpen(false);
      }
    }
  }, [
    activeView?.type,
    isLinkEditModalOpen,
    isSpreadsheetViewOpen,
    selectedSnippet?.id,
    isCreatingNewItem,
    activeEditor?.type,
  ]);

  // Escape key handler to close organization/billing panels and return to Home
  useEffect(() => {
    const isOrgOrBillingView =
      activeView?.type === 'subscriptions' ||
      activeView?.type === 'manageSubscription' ||
      activeView?.type === 'organizationSettings' ||
      activeView?.type === 'createWorkspace' ||
      activeView?.type === 'sharedFolderCreation' ||
      false;

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (isOrgOrBillingView) {
        useUIStore.getState().setView({ type: 'home' });
        return true;
      }
      return false;
    });

    return unregister;
  }, [activeView?.type]);

  // Context-aware Documentation URL

  const getDocumentationUrl = useCallback(
    (lockedCommand: string | null, currentView: any, linkModalOpen: boolean): string => {
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
        return `${CMDOS_DOCS_URL}${docMap[lockedCommand]}`;
      }

      // Priority 2: Check Link Edit Modal (Overrides main view if open)
      if (linkModalOpen) {
        return `${CMDOS_DOCS_URL}/links`;
      }

      // Priority 3: Check current main view (Redux state)
      if (currentView) {
        switch (currentView.kind) {
          case 'noteEditor':
            return `${CMDOS_DOCS_URL}/notes`;
          case 'linkEditor':
            return `${CMDOS_DOCS_URL}/links`;
          case 'todos':
            return `${CMDOS_DOCS_URL}/todos`;
          case 'store':
            // maybe just docs or specific store docs
            return CMDOS_DOCS_URL;
          case 'allItems':
            if (currentView.itemType === 'notes') return `${CMDOS_DOCS_URL}/notes`;
            if (currentView.itemType === 'links') return `${CMDOS_DOCS_URL}/links`;
            break;
        }
      }

      return CMDOS_DOCS_URL;
    },
    [],
  );

  const handleLockedCommandChange = useCallback((commandId: string | null) => {
    useUIStore.getState().setLockedCommand(commandId);
  }, []);

  const [todoDisplayMode] = useChromeStorage<'collapse' | 'data-blur' | 'pin'>('todo_display_mode', 'collapse');

  const handleOpenSubscriptions = useCallback(() => {
    useUIStore.getState().setView({ type: 'subscriptions' });
  }, []);

  const handleOpenManageSubscription = useCallback(() => {
    useUIStore.getState().setView({ type: 'manageSubscription' });
  }, []);

  const handleOpenGeneralSettings = useCallback(() => {
    useUIStore.getState().setView(getDefaultSettingsView(isLoggedIn));
  }, [isLoggedIn]);

  const showSidebarColumn = !isFocusMode && !isEmbedded;

  if (!authChecked) {
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="flex h-screen text-neutral-900 !rounded-none dark:!rounded-none dark:text-white relative overflow-hidden outline-none bg-[var(--color-rootBg)]" />
      </DndProvider>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        ref={mainContainerRef}
        tabIndex={-1}
        className="flex h-screen text-neutral-900 !rounded-none dark:!rounded-none dark:text-white relative overflow-hidden outline-none bg-[var(--color-rootBg)]"
        style={isEmbedded ? { background: 'transparent' } : undefined}>
        {isEmbedded && (
          <style>{`
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
          `}</style>
        )}
        {!isEmbedded && <WallpaperLayer />}
        <div id="ai-history-anchor" />
        {/* Global Branding & Controls - Always visible in top left */}
        {!isEmbedded && !showTutorial && !isSpreadsheetViewOpen && (
          <div className="absolute top-0 left-0 w-[280px] p-2.5 z-[10000] pointer-events-auto flex items-center justify-between">
            <Branding
              className="!p-0 !gap-0"
              showAvatar={false}
              onClick={() => {
                if (isSpreadsheetViewOpen) setIsSpreadsheetViewOpen(false);
              }}
            />
            {!isFocusMode && (
              <div className="flex items-center gap-2">
                <HeaderControls
                  showFavorites={showFavorites}
                  onToggleFavorites={handleToggleFavorites}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={handleToggleFocusMode}
                  isLoggedIn={isLoggedIn && userId !== 'local_user'}
                  direction="down"
                  onOpenSubscriptions={handleOpenSubscriptions}
                  onOpenManageSubscription={handleOpenManageSubscription}
                  onCommandListCategoryChange={setCommandListCategory}
                  commandListCategory={commandListCategory}
                  onOpenGeneralSettings={handleOpenGeneralSettings}
                  onOpenOrganizationSettings={(orgId: string, orgName: string) => {
                    organizationHandlers?.onOrganizationSettings(orgId, orgName);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tutorial Button - Top Right */}
        {!isEmbedded && !showTutorial && showTutorialButton && !isSpreadsheetViewOpen && !activeEditor && activeView?.type === 'home' && (
          <div className="absolute top-4 right-6 z-[10000] pointer-events-auto">
            <button
              onClick={() => setShowTutorial(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all backdrop-blur-sm border border-white/5 shadow-sm"
              title="Show Tutorial">
              <FiHelpCircle size={18} />
            </button>
          </div>
        )}

        {showTutorial && isOnboardCompleted && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

        <div className={showTutorial || isSpreadsheetViewOpen ? 'hidden' : 'contents'}>
          <AppLeftSidebar
            showSidebarColumn={showSidebarColumn}
            hasActivePopup={hasActivePopup}
            backgroundRefresh={backgroundRefresh}
            openSpreadsheetView={openSpreadsheetView}
            searchbarRef={searchbarRef}
            setIsSpreadsheetViewOpen={setIsSpreadsheetViewOpen}
            savedAgentById={savedAgentById}
            handleNavigateToListView={handleNavigateToListView}
            handleFavoriteLinkEdit={handleFavoriteLinkEdit}
          />
        </div>

        <AppMainContent
          isViewDropdownOpen={isViewDropdownOpen}
          isFullScreenModalOpen={isFullScreenModalOpen}
          theme={theme}
          hasActivePopup={hasActivePopup}
          isLinkEditModalOpen={isLinkEditModalOpen}
          setSuggestionState={setSuggestionState}
          isLoggedIn={isLoggedIn}
          teams={teamList}
          backgroundRefresh={backgroundRefresh}
          searchbarRef={searchbarRef}
          isSpreadsheetViewOpen={isSpreadsheetViewOpen}
          openSpreadsheetView={openSpreadsheetView}
          handleCreateWorkspace={handleCreateWorkspace}
          closeSpreadsheetView={closeSpreadsheetView}
          handleBoardViewRedirectFromSheet={handleBoardViewRedirectFromSheet}
          setIsSearchMenuOpen={setIsSearchMenuOpen}
          setIsBoardViewOpen={setIsBoardViewOpen}
          isInitialAltSFocus={isInitialAltSFocus}
          setIsInitialAltSFocus={setIsInitialAltSFocus}
          setIsGlobalCreateMenuOpen={setIsGlobalCreateMenuOpen}
          setIsAutomationActive={setIsAutomationActive}
          commandListCategory={commandListCategory}
          setCommandListCategory={setCommandListCategory}
          activeCommandSection={activeCommandSection}
          setActiveCommandSection={setActiveCommandSection}
          handleOrganizationHandlersReady={handleOrganizationHandlersReady}
          handleOrganizationPanelChange={handleOrganizationPanelChange}
          handleNavigateToListView={handleNavigateToListView}
          activeLockedCommand={activeLockedCommand}
          isSearchMenuOpen={isSearchMenuOpen}
          handleLockedCommandChange={handleLockedCommandChange}
          handleSearchbarFocus={handleSearchbarFocus}
          setIsViewDropdownOpen={setIsViewDropdownOpen}
          isFocusMode={isFocusMode}
          isEmbedded={isEmbedded}
          isCreatingNewItem={isCreatingNewItem}
          selectedSnippet={selectedSnippet}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
          showSidebarColumn={showSidebarColumn}
        />

        {/* TodoFloatingPreview is now rendered inside CreateTodoSelectionView for perfect vertical alignment */}
      </div>

      <AppModals
        createWorkspaceModal={createWorkspaceModal}
        setCreateWorkspaceModal={setCreateWorkspaceModal}
        backgroundRefresh={backgroundRefresh}
        isGlobalCreateMenuOpen={isGlobalCreateMenuOpen}
        setIsGlobalCreateMenuOpen={setIsGlobalCreateMenuOpen}
        openSpreadsheetView={openSpreadsheetView}
        searchbarRef={searchbarRef}
      />

      {!showTutorial &&
        activeView?.type === 'home' &&
        !activeLockedCommand &&
        !isSpreadsheetViewOpen &&
        !isBoardViewOpen &&
        !activeEditor &&
        !todoCreatePrefill && (
          <AppTodoSidebar
            isEmbedded={isEmbedded}
            isSpreadsheetViewOpen={isSpreadsheetViewOpen}
            isBoardViewOpen={isBoardViewOpen}
            isActuallyExpanded={isActuallyExpanded && !showTodosView}
            isLoggedIn={isLoggedIn}
          />
        )}
    </DndProvider>
  );
};

export default App;

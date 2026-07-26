import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import ReactDOM from 'react-dom';
import { useAppearance } from '@extension/ui';
import {
  runAutomation,
  type SavedAutomation,
  type SavedAutomation as ExecutionAutomation,
} from '../../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';
import clsx from 'clsx';

import ModelSelector from '../../../../allObjectFolder/src/createObject/ChatAgent/ModelSelector';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { findCommandByAnyId, isLocalCommandId } from '../../../../shared-components/commands';
import { resolveAutomationIconMeta } from '../../../../shared-components/icons/automationDynamicIcon';
import {
  extractUrlsFromSnippet,
  resolvePrimaryAction,
} from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaLink,
  FaNetworkWired,
  FaBook,
  FaPlus,
  FaHashtag,
  FaChevronRight,
  FaChevronLeft,
  FaLayerGroup,
  FaSun,
  FaMoon,
  FaFileAlt,
  FaHome,
  FaChevronDown,
} from 'react-icons/fa';
import { FiCreditCard, FiTerminal, FiSettings, FiCheck, FiLayout } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { AiOutlineEnter } from 'react-icons/ai';
import { BsPinAngle, BsPinAngleFill, BsList, BsGrid, BsTable, BsLayoutSidebarInsetReverse } from 'react-icons/bs';

import DeleteDialog from '../../../../shared-components/modals/deleteDialog';
import HomeView, { type HomeViewHandle } from '../landingPage/views/HomeView';

import type { SnippetActionDetail } from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type { InteractiveItem } from '../landingPage/views/defaultContainer';
import { AI_GROUP, type CommandId } from '../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { getCommandServices } from '../commands/commandServices';
import { commandRegistry } from '../../../../shared-components/commands/registry';
import { CommandContext } from '../../../../shared-components/commands/types';
import { type LocalCommandId } from '../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

import type { FolderData } from '../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { WorkspaceData } from '../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { SnippetRecord } from '../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { EditSnippetScreen } from '../../../../allObjectFolder/src/createObject/snippets/SnippetEditorScreen';
import { NoteEditorView, CreateTodoView } from '../../../../allObjectFolder/src';
import { AiPromptEditorView } from '../../../../allObjectFolder/src/createObject/aiPrompt';

import { useUIStore } from '../../../../shared-components/uiStateManager';

import { getUserId } from '../../../../storage/API/core/api';
import LinkEditorView from '../../../../allObjectFolder/src/createObject/links/ui/LinkEditorView';
import SessionEditorView from '../../../../allObjectFolder/src/createObject/session/ui/SessionEditorView';
import AutomationDashboard from '../../../../allObjectFolder/src/createObject/automationBeta/dashboard/automationDashboard';
import { deleteSnippet, updateSnippet } from '../../../../allObjectFolder/src/createObject/snippets/snippetData';
import { nowUtc } from '../../../../shared-components/utils';
import { format, isSameDay } from 'date-fns';
import { toggleFavoriteRecord } from '../../../../shared-components/favorites/favoriteData';
import {
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { deleteLink } from '../../../../allObjectFolder/src/createObject/links/linkData';
import { deleteTodo, createTodo } from '../../../../allObjectFolder/src/createObject/todos/todoData';
import { deleteNote } from '../../../../allObjectFolder/src/createObject/notes/noteData';
import { deleteSession } from '../../../../allObjectFolder/src/createObject/session/sessionData';
import { deleteAiPrompt } from '../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { deleteChatAgent } from '../../../../allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { deleteAutomation } from '../../../../allObjectFolder/src/createObject/automationBeta/automationData';
import { db } from '../../../../storage/indexDB/dbConfig';
import { saveHotkey, clearHotkey } from '../../../../shared-components/hotkeys';
import { saveShortcut, clearShortcut } from '../../../../shared-components/shortcuts';
import Searchbar, {
  type SearchbarHandle,
  type SuggestionState,
  type WorkspaceItemSuggestion as SnippetSuggestion,
} from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';
import ChatAgent from '../../../../allObjectFolder/src/createObject/ChatAgent';
import AutomationSavePrompt from '../../../../allObjectFolder/src/createObject/automationBeta/searchIntegration/automationSavePrompt';
import useNotification from '../../../../shared-components/notifications/useNotification';

import UnsavedChangesDialog from '../../../../shared-components/modals/unsavedChangesDialog';
import { useConvertibleItems } from '../../../../allObjectFolder/src/createObject/todos/todoHooks';
import CreateWorkspacePanel from '../../../../settings/allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import CreateFolderPanel from '../../../../settings/allWorkspaceManager/folders/ui/CreateFolderPanel';

import AutomationCapabilitiesMenu from '../../../../allObjectFolder/src/createObject/automationBeta/searchIntegration/automationCapabilitiesMenu';
import MyAutomationsList from '../../../../allObjectFolder/src/createObject/automationBeta/searchIntegration/myAutomationsList';
import BoardView from '../../../../shared-components/BoardView/BoardView';
import OnboardingCards from '../../../../welcomeGuide/OnboardingCards';
import { isOnboardingCompleted } from '../../../../storage/localStorage/onboardingStorage';
import { storageDebug } from '../../../../shared-components/utils/storageDebugLogger';

import AutomationActionMenu from '../../../../allObjectFolder/src/createObject/automationBeta/utilities/automationActionMenu';

import { SettingsLayout, GeneralSettingsPanel, AllWorkspacesPanel } from '../../../../settings';
import SpreadsheetMainContainer from '../../../../shared-components/spreadsheetUi/ui/spreadsheetMainContainer';

type Snippet = SnippetRecord & {
  key?: string;
  value?: string | { urls?: string[]; names?: string[] };
  category?: string;
};
type Folder = FolderData & { snippets?: Snippet[]; folders?: Folder[] };
type Workspace = WorkspaceData & { folders?: Folder[]; workspace_snippets?: Snippet[] };
type Team = {
  team_id?: string;
  team_name?: string;
  workspaces?: Workspace[];
  storageMode?: string;
  migrationStatus?: string;
};

interface ContainerProps {
  reload: () => void;
  teams: Team[];
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
    onWorkspaceShare: (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => void;
  }) => void;
  onOrganizationPanelChange?: (state: { isOpen: boolean; orgId?: string; orgName?: string; loading?: boolean }) => void;
  onSearchbarFocus?: (isUserInitiated: boolean) => void; // Called when main searchbar gains focus
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  hideMainContent?: boolean; // Hide main content (keep searchbar visible)
  isLoggedIn: boolean;
  onLockedCommandChange?: (commandId: string | null) => void;
  onMenuStateChange?: (isOpen: boolean) => void;
  onAutomationActiveChange?: (isActive: boolean) => void;
  onQueryChange?: (value: string) => void;
  showTutorialTrigger?: number;
  onTutorialTriggerConsumed?: () => void;
  isSpreadsheetViewOpen?: boolean;
  onOpenSpreadsheetMainContainer?: (section?: string) => void;
  onCloseSpreadsheetMainContainer?: () => void;
  onCreateWorkspace?: () => void;
  showSidebarColumn?: boolean;
  isInitialAltSFocus?: boolean;
  onInitialAltSFocusChange?: (val: boolean) => void;
  onBoardViewOpenChange?: (isOpen: boolean) => void;
  /** Called after user confirms unsaved-changes dialog triggered by Alt+S */
  onShortcutBoardView?: () => void;
  showTutorial?: boolean;
  setShowTutorial?: React.Dispatch<React.SetStateAction<boolean>>;
  /** Called after user confirms unsaved-changes dialog triggered by Alt+C */
  onShortcutCreateMenu?: () => void;
  onSuggestionStateChange?: (state: SuggestionState | null) => void;
  onHoverSlashDot?: () => void;
  onBoardViewRedirect?: () => void;
  onTutorialVisibilityChange?: (visible: boolean) => void;
}

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-1">
    {keys.map(key => (
      <span
        key={key}
        className="rounded border border-white/20 bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 shadow-sm leading-none">
        {key}
      </span>
    ))}
  </span>
);

const Container: React.FC<ContainerProps> = ({
  reload,
  teams,
  searchbarRef,
  onMenuStateChange,
  onAutomationActiveChange,
  searchValue: propSearchValue,

  onSnippetSelectFromSearch,

  commandListCategory,
  onCommandListCategoryChange,
  activeCommandSection,
  onCommandSectionChange,

  onOrganizationSettings,
  onCreateOrganization,
  onOrganizationHandlersReady,
  onOrganizationPanelChange,
  onSearchbarFocus,
  onNavigateToListView,
  hideMainContent,
  isLoggedIn,
  onLockedCommandChange,
  onQueryChange: propOnQueryChange,
  showTutorialTrigger,
  onTutorialTriggerConsumed,
  isSpreadsheetViewOpen,
  onOpenSpreadsheetMainContainer,
  onCloseSpreadsheetMainContainer,
  onCreateWorkspace,
  showSidebarColumn,
  isInitialAltSFocus,
  onInitialAltSFocusChange,
  onBoardViewOpenChange,
  onShortcutBoardView,
  onShortcutCreateMenu,
  onSuggestionStateChange,
  onHoverSlashDot,
  onBoardViewRedirect,
  onTutorialVisibilityChange,
  showTutorial = false,
  setShowTutorial,
}) => {
  const [storeTab, setStoreTab] = useState<'catalog' | 'saved'>('catalog');
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);

  const homeViewRef = useRef<HomeViewHandle>(null);
  const boardViewRef = useRef<any>(null);

  // Clear any persisted dirty/draft states on app initialization (e.g. refresh)
  useEffect(() => {
    useUIStore.getState().setDraftAutomation(null);
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

  const setSuggestionState = useCallback(
    (val: SuggestionState | null | ((prev: SuggestionState | null) => SuggestionState | null)) => {
      setSuggestionStateInternal(val);
    },
    [],
  );
  const prevIsMenuOpenRef = useRef(false);
  const prevIsAutomationActiveRef = useRef(false);
  const [searchValue, setSearchValue] = useState('');
  const prevLockedRef = useRef<string | null>(null);
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [agentSpeakerProps, setAgentSpeakerProps] = useState<any>(null);
  const activeView = useUIStore(s => s.activeView);
  const activeEditor = useUIStore(s => s.activeEditor);
  const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
  const [isAutomationSavePromptOpen, setIsAutomationSavePromptOpen] = useState(false);
  const [localAutomations, setLocalAutomations] = useState<any[]>([]);
  const [localSavedAutomations, setLocalSavedAutomations] = useState<any[]>([]);
  const [installedModules, setInstalledModules] = useState<any[]>([]);
  const sameJson = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  useEffect(() => {
    useDbStore.getState().initDbSync();
  }, []);

  const commands = useDbStore(state => state.commands);

  const fetchInstalledModulesWithMetadata = useCallback(
    async (forceCloud = false) => {
      if (isLoggedIn === false) return;
      const chromeAny = (window as any).chrome;
      const now = Date.now();

      try {
        // 1. Check shared storage for the last sync timestamp across ALL tabs
        const storage = await chromeAny.storage.local.get(['installed_modules', 'last_module_fetch_timestamp']);
        const lastFetch = storage.last_module_fetch_timestamp || 0;
        const isCoolingDown = now - lastFetch < 2 * 60 * 60 * 1000; // 2-hour cooldown per user request

        // 2. Load from cache immediately
        if (storage.installed_modules && Array.isArray(storage.installed_modules)) {
          setInstalledModules(prev => (sameJson(prev, storage.installed_modules) ? prev : storage.installed_modules));
          // If we are cooling down and not forced, we are done!
          if (isCoolingDown && !forceCloud) return;
        }
      } catch (err) {
        console.error('Failed to fetch installed modules in Container:', err);
      }
    },
    [isLoggedIn],
  );

  const lockedCommand = suggestionState?.lockedCommand;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isStoreLocked = (lockedCommand as string) === 'store' || (lockedCommand as string) === 'saved-automation';
      if (isStoreLocked && e.key === 'Tab') {
        e.preventDefault();
        setStoreTab(prev => {
          const nextTab = prev === 'catalog' ? 'saved' : 'catalog';
          const nextCmd = nextTab === 'catalog' ? 'store' : 'saved-automation';
          if (lockedCommand !== nextCmd) {
            const currentVal = searchbarRef.current?.getValue() || '';
            searchbarRef.current?.lockCommand(nextCmd, currentVal);
          }
          return nextTab;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockedCommand]);

  useEffect(() => {
    if (lockedCommand === 'saved-automation') {
      setStoreTab('saved');
    } else if (lockedCommand === 'store') {
      setStoreTab('catalog');
    }
  }, [lockedCommand]);

  useEffect(() => {
    const withIconMeta = (automation: any) => {
      if (!automation || typeof automation !== 'object') return automation;
      if (automation.iconMeta?.mode && Array.isArray(automation.iconMeta?.hosts)) return automation;
      return {
        ...automation,
        iconMeta: resolveAutomationIconMeta(automation),
      };
    };

    const persistIconMeta = async (automations: any[]) => {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local?.get || !chromeAny?.storage?.local?.set) return;

      try {
        const snapshot = await chromeAny.storage.local.get(['automations', 'saved_automations']);
        const map = snapshot?.automations;
        if (map && typeof map === 'object' && !Array.isArray(map)) {
          let hasChanges = false;
          const nextMap: Record<string, any> = { ...map };
          Object.entries(nextMap).forEach(([key, value]) => {
            if (!value || typeof value !== 'object') return;
            if (value.iconMeta?.mode && Array.isArray(value.iconMeta?.hosts)) return;
            nextMap[key] = { ...value, iconMeta: resolveAutomationIconMeta(value) };
            hasChanges = true;
          });
          if (hasChanges) {
            await chromeAny.storage.local.set({ automations: nextMap });
          }
        }

        const legacy = snapshot?.saved_automations;
        if (Array.isArray(legacy)) {
          const nextLegacy = legacy.map((item: any) => withIconMeta(item));
          const changed = nextLegacy.some((item: any, index: number) => item !== legacy[index]);
          if (changed) {
            await chromeAny.storage.local.set({ saved_automations: nextLegacy });
          }
        }
      } catch (error) {
        console.warn('[Container] Failed to persist automation iconMeta', error);
      }
    };

    const toAutomationArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    };

    const getAiLocals = (local: any[]) =>
      local.filter((auto: any) => {
        const hasAiStep =
          auto.steps?.some(
            (s: any) =>
              String(s.moduleId || s.module_id) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          ) ||
          auto.automation_steps?.some(
            (s: any) =>
              String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
        return hasAiStep;
      });

    // Load local automations from storage.
    // `automations` is the canonical synced map used by Searchbar and hotkeys.
    chrome.storage.local.get(['automations', 'saved_automations'], result => {
      const syncedAutomations = toAutomationArray(result.automations).map(withIconMeta);
      const legacyAutomations = toAutomationArray(result.saved_automations).map(withIconMeta);
      const local = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;
      const nextAiLocals = getAiLocals(local);
      setLocalSavedAutomations(prev => (sameJson(prev, local) ? prev : local));
      setLocalAutomations(prev => (sameJson(prev, nextAiLocals) ? prev : nextAiLocals));
      persistIconMeta(local);
    });

    // Listen for storage changes to keep localAutomations in sync
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.automations || changes.saved_automations) {
        const syncedAutomations = toAutomationArray(changes.automations?.newValue).map(withIconMeta);
        const legacyAutomations = toAutomationArray(changes.saved_automations?.newValue).map(withIconMeta);
        const local = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;
        const nextAiLocals = getAiLocals(local);
        setLocalSavedAutomations(prev => (sameJson(prev, local) ? prev : local));
        setLocalAutomations(prev => (sameJson(prev, nextAiLocals) ? prev : nextAiLocals));
        persistIconMeta(local);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    // Initial fetch for installed modules
    const fetchInstalled = async () => {
      const cached = await chrome.storage.local.get(['installed_modules']);
      if (cached?.installed_modules) {
        setInstalledModules(prev => (sameJson(prev, cached.installed_modules) ? prev : cached.installed_modules));
      }
      // Also trigger a fresh fetch from API to ensure metadata (icons, etc.) are up to date
      fetchInstalledModulesWithMetadata();
    };
    fetchInstalled();

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.installed_modules) {
        const nextInstalled = changes.installed_modules.newValue || [];
        setInstalledModules(prev => (sameJson(prev, nextInstalled) ? prev : nextInstalled));
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [fetchInstalledModulesWithMetadata]);

  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbAutomations = useDbStore(state => state.automations);
  const dbTodos = useDbStore(state => state.todos);
  const dbHotkeysMap = useDbStore(state => state.hotkeysMap);
  const dbChatAgents = useDbStore(state => state.chatAgents);
  const dbAiPrompts = useDbStore(state => state.aiPrompts);

  const [activeTodoId, setActiveTodoId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeEditor?.type !== 'todo') {
      setActiveTodoId(null);
    }
  }, [activeEditor?.type]);

  const handleLoadTodo = useCallback(
    (todo: any) => {
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
    },
    [dbHotkeysMap],
  );

  const handleDeleteTodoById = useCallback(
    async (id: string) => {
      try {
        await db.todos.delete(id);
        await deleteTodo(id);
        if (activeTodoId === id) {
          setActiveTodoId(null);
          useUIStore.getState().setTodoCreatePrefill(null);
        }
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: id });
        }
      } catch (e) {
        console.error('[Container] Failed to delete todo from table:', e);
      }
    },
    [activeTodoId],
  );

  const handleUpdateTodoField = useCallback(async (id: string, field: string, value: any) => {
    try {
      const todo = await db.todos.get(id);
      if (!todo) return;

      const chromeAny = (window as any).chrome;
      if (field === 'title') {
        await db.todos.update(id, { name: value, updatedAt: Date.now() });
        if (chromeAny?.storage?.local) {
          const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
          const localTodos = result.local_todos || [];
          const updated = localTodos.map((t: any) =>
            String(t.snippet_id || t.id || t.todo_id) === String(id) ? { ...t, key: value, title: value } : t,
          );
          await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
        }
      } else if (field === 'shortcut') {
        await db.todos.update(id, { shortcut: value, updatedAt: Date.now() });
        if (value) {
          await saveShortcut(id, id, value, todo.name, 'todo');
        } else {
          await clearShortcut(id, id, 'todo');
        }
        if (chromeAny?.storage?.local) {
          const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
          const localTodos = result.local_todos || [];
          const updated = localTodos.map((t: any) =>
            String(t.snippet_id || t.id || t.todo_id) === String(id) ? { ...t, shortcut: value } : t,
          );
          await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
        }
      }
      const currentPrefill = useUIStore.getState().todoCreatePrefill;
      if (currentPrefill) {
        const prevId =
          (currentPrefill as any).todo_id || (currentPrefill as any).id || (currentPrefill as any).snippet_id;
        if (String(prevId) === String(id)) {
          useUIStore.getState().setTodoCreatePrefill({
            ...currentPrefill,
            ...(field === 'title' ? { title: value, key: value } : {}),
            ...(field === 'shortcut' ? { shortcut: value } : {}),
          });
        }
      }
    } catch (e) {
      console.error('[Container] Failed to update todo inline field:', e);
    }
  }, []);

  const isReturningUser = useMemo(() => {
    return isOnboardingDone;
  }, [isOnboardingDone]);

  const getWorkspaceIdForFolder = useCallback(
    (folderId: string | null | undefined): string | null => {
      if (!folderId) return null;
      const folder = dbFolders.find((item: any) => String(item.id) === String(folderId));
      return folder?.workspaceId ?? null;
    },
    [dbFolders],
  );

  const isAiAutomation = useCallback((automation: any): boolean => {
    const steps = automation?.automation_steps || automation?.steps || [];
    return (
      Array.isArray(steps) &&
      steps.some(
        (s: any) => String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
      )
    );
  }, []);

  const collectAiAgentsFromWorkspace = useCallback(
    (workspaceId: string): SavedAutomation[] => {
      const agents: SavedAutomation[] = [];

      dbAutomations.forEach((auto: any) => {
        const autoWorkspaceId = String(auto.workspaceId || auto.workspace_id || '');
        const autoFolderId = String(auto.folderId || auto.folder_id || '');
        const folderWorkspaceId = getWorkspaceIdForFolder(autoFolderId);
        const belongsToWorkspace = autoWorkspaceId === String(workspaceId) || folderWorkspaceId === String(workspaceId);
        if (!belongsToWorkspace || !isAiAutomation(auto)) return;

        if (!agents.find(a => String(a.id) === String(auto.id))) {
          agents.push({
            ...auto,
            workspace_id: workspaceId,
            folder_id: autoFolderId || null,
          });
        }
      });

      return agents;
    },
    [dbAutomations, getWorkspaceIdForFolder, isAiAutomation],
  );

  // --- Saved AI Agents for AICommandLockedUI ---
  const savedAiAgents = useMemo(() => {
    const agents: any[] = [];

    dbWorkspaces.forEach((workspace: any) => {
      collectAiAgentsFromWorkspace(workspace.id).forEach(agent => {
        if (!agents.find(a => String(a.id) === String(agent.id))) {
          agents.push(agent);
        }
      });
    });

    dbAutomations.forEach((auto: any) => {
      const isDedicatedAgent =
        auto?.type === 'chat_agent' ||
        auto?.category === 'chat_agent' ||
        auto?.category === 'agent' ||
        auto?.kind === 'agent';
      if (!isDedicatedAgent) return;

      if (!agents.find(a => String(a.id) === String(auto.id))) {
        agents.push({
          ...auto,
          workspace_id: auto.workspaceId || auto.workspace_id || null,
          folder_id: auto.folderId || auto.folder_id || null,
        });
      }
    });

    // Merge real ChatAgent records from Dexie (AI prompt editors)
    dbChatAgents.forEach((agent: any) => {
      if (!agents.find(a => String(a.id) === String(agent.id))) {
        agents.push({
          ...agent,
          workspace_id: agent.workspaceId || agent.workspace_id || null,
          folder_id: agent.folderId || agent.folder_id || null,
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
          workspace_id: prompt.workspaceId || prompt.workspace_id || null,
          folder_id: prompt.folderId || prompt.folder_id || null,
          category: 'agent',
          type: 'chat_agent',
        });
      }
    });

    // 2. Merge with Local Automations
    localAutomations.forEach(localAuto => {
      if (!agents.find(a => String(a.id) === String(localAuto.id))) {
        agents.push(localAuto);
      }
    });

    return agents;
  }, [dbAutomations, dbWorkspaces, dbChatAgents, dbAiPrompts, localAutomations, collectAiAgentsFromWorkspace]);

  const savedAutomations = useMemo(() => {
    const automationMap = new Map<string, any>();
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
    const put = (automation: any) => {
      const key = String(
        automation?.id ||
          automation?.automation_id ||
          `${automation?.name || 'automation'}-${automation?.timestamp || automation?.created_at || ''}`,
      );
      const existing = automationMap.get(key);
      if (!existing) {
        automationMap.set(key, automation);
        return;
      }

      const existingScore = getStepsCount(existing) * 10 + getInputsCount(existing);
      const incomingScore = getStepsCount(automation) * 10 + getInputsCount(automation);
      if (incomingScore > existingScore) {
        automationMap.set(key, automation);
      }
    };

    dbAutomations.forEach((auto: any) => {
      put({
        ...auto,
        workspace_id: auto.workspaceId || auto.workspace_id || getWorkspaceIdForFolder(auto.folderId || auto.folder_id),
        folder_id: auto.folderId || auto.folder_id || null,
      });
    });

    localSavedAutomations.forEach(put);

    return Array.from(automationMap.values()).sort((a: any, b: any) => {
      const aTime = new Date(a?.updated_at || a?.created_at || a?.timestamp || 0).getTime();
      const bTime = new Date(b?.updated_at || b?.created_at || b?.timestamp || 0).getTime();
      return bTime - aTime;
    });
  }, [dbAutomations, getWorkspaceIdForFolder, localSavedAutomations]);

  const handleSelectSavedAgent = (agent: any) => {
    searchbarRef.current?.selectSavedAgent(agent);
  };

  const handleNewChat = () => {
    searchbarRef.current?.newAiChat();
  };

  // Get state from Zustand/Dexie-backed UI state
  const selectedTeam = useUIStore((s: any) => s.selectedTeam);
  const selectedWorkspaceId = useUIStore((s: any) => s.selectedWorkspaceId);
  const selectedWorkspace = React.useMemo(() => {
    const ws = dbWorkspaces.find((item: any) => item.id === selectedWorkspaceId) || null;
    if (!ws) return null;
    return {
      ...(ws as any),
      workspace_id: (ws as any).workspace_id || ws.id,
      workspace_name: (ws as any).workspace_name || ws.workspaceName,
      folders: [],
      workspace_snippets: [],
      workspace_automations: [],
    } as any;
  }, [dbWorkspaces, selectedWorkspaceId]);
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const selectedFolder = React.useMemo(() => {
    const folder = dbFolders.find((item: any) => item.id === selectedFolderId) || null;
    if (!folder) return null;
    return {
      ...(folder as any),
      folder_id: (folder as any).folder_id || folder.id,
      workspace_id: (folder as any).workspace_id || folder.workspaceId,
    } as any;
  }, [dbFolders, selectedFolderId]);
  const selectedSnippetRawId = useUIStore((s: any) => s.selectedSnippetId);
  const selectedSnippetRaw = React.useMemo(() => {
    const snippet =
      dbSnippets.find(
        (item: any) =>
          item.id === selectedSnippetRawId || (item as any).item || (item as any).snippet_id === selectedSnippetRawId,
      ) || null;
    if (!snippet) return null;
    return {
      ...(snippet as any),
      snippet_id: (snippet as any).snippet_id || snippet.id,
    } as any;
  }, [dbSnippets, selectedSnippetRawId]);
  const snippetBreadCrum = useUIStore((s: any) => s.snippetBreadcrumb);
  const isCreatingNewItem = activeEditor?.id === 'new';

  // Guard the editor state with Zustand's activeEditor to prevent stale state bugs
  const selectedSnippet = activeEditor ? selectedSnippetRaw : null;
  const isCreatingEditorView =
    activeEditor?.type === 'note' ||
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

  useEffect(() => {
    if (isSpreadsheetViewOpen) {
      fetchInstalledModulesWithMetadata();
    }
  }, [isSpreadsheetViewOpen, fetchInstalledModulesWithMetadata]);

  // Auto-close LinkEditModal on navigation (folder/workspace change) or view switch.
  // This matches RichEditor behavior: navigating via sidebar should reset the view.
  // Auto-close LinkEditModal on navigation (folder/workspace change) or view switch.
  // REMOVED: This causes the modal to close immediately after creation because setting workspace/folder triggers this effect.
  // The user should manually close the modal or it should be handled explicitly.
  /*
  useEffect(() => {
    if (isLinkEditModalOpen) {

    }
  }, [selectedFolder?.folder_id, selectedWorkspace?.workspace_id, selectedTeam?.team_id]);
  */

  const [isCheckingTutorial, setIsCheckingTutorial] = useState(true);
  const tutorialVideoSrc = 'https://drive.google.com/file/d/1IyGR9rKItnPPwXdw8RJkNcfnf7HNdfmz/view?usp=sharing';

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const completed = await isOnboardingCompleted();
        setIsOnboardingDone(completed);
        if (completed) {
          setIsCheckingTutorial(false);
          return;
        }
      } catch (error) {
        console.error('[Container] Error checking onboarding status:', error);
      }

      // Do NOT show tutorial overlay automatically on startup/refresh
      setIsCheckingTutorial(false);
    };
    checkTutorial();
  }, []);

  useEffect(() => {
    if (showTutorial) {
      isOnboardingCompleted().then(completed => {
        setIsOnboardingDone(completed);
      });
    }
  }, [showTutorial]);

  const handleCloseTutorial = useCallback(async () => {
    setShowTutorial?.(false);
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
      chromeAny.storage.local.set({ tutorial_watched: true });
    }
    // 1. Refresh all data (snippets, workspaces) and AWAIT it
    await (reload() as any);

    // 2. Trigger favorites re-sync by toggling the trigger.
    // useFavoritesSync listens for this change, clears its internal cache, and fetches cloud favs.
    try {
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('user_fav_sync_trigger', (res: any) => {
          const val = res.user_fav_sync_trigger || 0;
          chromeAny.storage.local.set({ user_fav_sync_trigger: val + 1 });
        });
      }
    } catch (e) {
      console.error('[Container] Failed to trigger favorites sync:', e);
    }
  }, [reload, onTutorialTriggerConsumed]);

  // Load and sync favorites
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    // Initial load
    chromeAny.storage.local.get('myFavouriteItems', (res: { myFavouriteItems?: Record<string, any[]> }) => {
      const nextValue = res.myFavouriteItems || {};
      setFavoritesMapping(prev => (sameJson(prev, nextValue) ? prev : nextValue));
    });

    // Listener
    const handleChange = (changes: { [key: string]: any }, area: string) => {
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
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSelectedWorkspaceId(null);

    // dispatch(setShowTodosView(false)); // REMOVED: keep Todos open if user pinned it

    const urlParams = new URLSearchParams(window.location.search);
    const hasLockParam = urlParams.get('lock_command') || urlParams.get('open_note') || urlParams.get('trigger_hotkey');

    // Clear search and scroll
    setSearchValue('');
    // COLLAPSE EVERYTHING - critical for "fresh start" feel
    // useUIStore.getState().expandAllWorkspaces({});
    // dispatch(expandAllFolders({}));

    // Ensure local state is reset

    // Clear suggestion state
    setSuggestionState(null);

    // RESET TO HOME VIEW - ensures fresh start on refresh/new tab
    // Specifically clear any pending AI/Command locks via the ref if it's available after mount
    useUIStore.getState().setView({ type: 'home' });

    // Explicitly clear AI lock on next tick to ensure Searchbar is ready
    // BUT skip this if the URL has a lock_command (e.g. from opening an agent in a collection)
    setTimeout(() => {
      if (searchbarRef.current) {
        if (!hasLockParam) {
          searchbarRef.current.lockCommand(null);
        } else {
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
  const activeLinkSnippet = useUIStore((s: any) => s.linkEditPrefill?.snippet || null);
  const scrollToFolderId = useUIStore((s: any) => s.scrollToFolderId);

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
    useUIStore.getState().setView({ type: 'home' });
    // Reset search state to ensure we return to the Homepage view (no "Keep typing..." message)
    if (isCreatingNewItem || selectedWorkspace || selectedFolder) {
      // Removed searchValue and searchbar clear to allow persistent suggestions
      // setSearchValue('');
      //
      // setSuggestionState(null);

      // Full Reset to Homepage (Fresh state)
      useUIStore.getState().setSelectedWorkspaceId(null);
      useUIStore.getState().setSelectedFolderId(null);
      useUIStore.getState().setSelectedSnippetId(null);
      useUIStore.getState().setSnippetBreadcrumb(null);
      // useUIStore.getState().setShowFavorites(false); // REMOVED: Respect user choice

      if (searchbarRef.current) {
        // searchbarRef.current.clear();
        searchbarRef.current.blur();
      }
    } else {
      // Only focus if we were NOT clearing search (meaning we were probably already in a clean state)
      setTimeout(() => {
        if (!isModalOpen() && searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 0);
    }
  };

  const [userId, setUserId] = useState('');

  const viewMode = useUIStore((s: any) => s.viewMode);
  const triggerNotification = useNotification();
  const [homeDeleteContext, setHomeDeleteContext] = useState<{
    isOpen: boolean;
    detail: SnippetActionDetail | null;
  }>({ isOpen: false, detail: null });

  // Organization handlers - these set the view and call parent callbacks
  const handleOrganizationSettings = useCallback(
    (orgId: string, orgName: string) => {
      useUIStore.getState().setView({ type: 'organizationSettings', orgId, orgName });
      onOrganizationSettings?.(orgId, orgName);
    },
    [onOrganizationSettings],
  );

  const handleCreateWorkspace = useCallback(() => {
    useUIStore.getState().setView({ type: 'createWorkspace' });
    onCreateWorkspace?.();
  }, [onCreateWorkspace]);

  const handleCreateFolder = useCallback(() => {
    useUIStore.getState().setView({ type: 'createFolder' });
  }, []);

  const handleCreateOrganization = useCallback(() => {
    useUIStore.getState().setView({ type: 'createWorkspace' });
    onCreateOrganization?.();
  }, [onCreateOrganization]);

  const handleWorkspaceShare = useCallback(
    (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => {
      useUIStore.getState().setView({
        type: 'workspaceShare',
        workspaceId,
      });
    },
    [],
  );

  // Expose handlers to parent (App) so it can pass them to SideBar
  useEffect(() => {
    if (onOrganizationHandlersReady) {
      onOrganizationHandlersReady({
        onOrganizationSettings: handleOrganizationSettings,
        onCreateOrganization: handleCreateOrganization,
        onWorkspaceShare: handleWorkspaceShare,
      });
    }
  }, [onOrganizationHandlersReady, handleOrganizationSettings, handleCreateOrganization, handleWorkspaceShare]);

  // Notify parent when organization panel opens/closes
  useEffect(() => {
    if (
      activeView?.type === 'organizationSettings' ||
      activeView?.type === 'createWorkspace' ||
      activeView?.type === 'createFolder' ||
      activeView?.type === 'workspaceShare'
    ) {
      onOrganizationPanelChange?.({
        isOpen: true,
        orgId: (activeView as any)?.orgId,
        orgName: (activeView as any)?.orgName,
      });
    } else {
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
      const isAiLocked =
        suggestionState?.lockedCommand === 'ai' ||
        suggestionState?.lockedCommand === 'gpt' ||
        suggestionState?.lockedCommand === 'perplexity' ||
        suggestionState?.lockedCommand === 'claude' ||
        suggestionState?.lockedCommand === 'gemini';

      if (!isInEditor && !isAiLocked && !isModalOpen() && searchbarRef.current) {
        searchbarRef.current.focus();
      }
    }, 0);
    return () => window.clearTimeout(focusTimeout);
  }, [
    selectedWorkspace,
    selectedFolder,
    selectedSnippet,
    isCreatingNewItem,
    isModalOpen,
    suggestionState?.lockedCommand,
  ]);

  // Focus search bar when folder is selected (matching AltS handleFolderViewRequested behavior)
  // When folder is clicked, focus search bar so user can immediately search within folder
  useEffect(() => {
    const isAiLocked =
      suggestionState?.lockedCommand === 'ai' ||
      suggestionState?.lockedCommand === 'gpt' ||
      suggestionState?.lockedCommand === 'perplexity' ||
      suggestionState?.lockedCommand === 'claude' ||
      suggestionState?.lockedCommand === 'gemini';
    if (selectedFolder && selectedWorkspace && !selectedSnippet && !isCreatingNewItem && !isAiLocked) {
      // Removed search clearing to allow persistent suggestions during sidebar navigation
      // searchbarRef.current?.clear();
      setTimeout(() => {
        if (!isModalOpen() && searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 0);
    }
  }, [
    selectedFolder?.folder_id,
    selectedWorkspace?.workspace_id,
    selectedSnippet,
    isCreatingNewItem,
    isModalOpen,
    suggestionState?.lockedCommand,
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
    if (
      isCreatingNewItem &&
      activeEditor?.type !== 'ai' &&
      activeEditor?.type !== 'aiPrompt' &&
      activeEditor?.type !== 'agent'
    ) {
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
    const isAiLocked =
      suggestionState?.lockedCommand === 'ai' ||
      suggestionState?.lockedCommand === 'gpt' ||
      suggestionState?.lockedCommand === 'perplexity' ||
      suggestionState?.lockedCommand === 'claude' ||
      suggestionState?.lockedCommand === 'gemini';

    if (isAiLocked && activeEditor && activeEditor.type !== 'ai') {
      useUIStore.getState().closeEditor();
    }
  }, [suggestionState?.lockedCommand, activeEditor]);

  // CLEAR BREADCRUMB: Auto-switch back to home view when editor states are cleared
  useEffect(() => {
    const isEmbedded =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
    // If we're in noteEditor mode but all the editor states are cleared, go back to home
    if (activeEditor?.type === 'note' && !selectedSnippet && !isCreatingNewItem && !snippetBreadCrum && !isEmbedded) {
      useUIStore.getState().setView({ type: 'home' });
    }
  }, [activeView?.type, selectedSnippet, isCreatingNewItem, snippetBreadCrum]);

  // NEW ITEM CREATION: Auto-switch to noteEditor when creating new item
  useEffect(() => {
    if (
      isCreatingNewItem &&
      activeEditor?.type !== 'note' &&
      activeEditor?.type !== 'link' &&
      activeEditor?.type !== 'session' &&
      activeEditor?.type !== 'ai' &&
      activeEditor?.type !== 'aiPrompt' &&
      activeEditor?.type !== 'agent' &&
      activeEditor?.type !== 'todo'
    ) {
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
    : selectedSnippet || (snippetBreadCrum && memoizedSnippet.current) || null;

  // Clear the memoized snippet when navigating back to workspace view or home
  useEffect(() => {
    // CLEAR BREADCRUMB: Clear memoized snippet when going back to workspace view OR home view
    // Original condition: selectedWorkspace && !snippetBreadCrum && !selectedSnippet
    // Updated to also clear when going to home (no workspace selected)
    if (!snippetBreadCrum && !selectedSnippet) {
      memoizedSnippet.current = null;
    }
  }, [selectedWorkspace, snippetBreadCrum, selectedSnippet]);

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
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark, isSpreadsheetViewOpen]);

  const trimmedSearch = (debouncedSearchTerm || '').trim();

  const isAiLocked =
    suggestionState?.lockedCommand === 'ai' ||
    suggestionState?.lockedCommand === 'gpt' ||
    suggestionState?.lockedCommand === 'claude' ||
    suggestionState?.lockedCommand === 'perplexity' ||
    suggestionState?.lockedCommand === 'gemini';
  const isStoreLocked =
    (suggestionState?.lockedCommand as string) === 'store' ||
    (suggestionState?.lockedCommand as string) === 'saved-automation';

  const hasSearchTerm =
    trimmedSearch.length > 0 ||
    searchValue.trim().length > 0 ||
    (suggestionState?.value?.trim().length ?? 0) > 0 ||
    ((suggestionState?.selectedImagesCount ?? 0) > 0 && !suggestionState?.lockedCommand);

  const isEmbedded =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  const shouldShowSuggestions =
    !isEmbedded &&
    (hasSearchTerm || suggestionState?.isVisible || isStoreLocked) &&
    !isAiLocked &&
    !isLinkEditModalOpen;

  const displayHomeView =
    !isEmbedded &&
    !isLinkEditModalOpen &&
    !selectedSnippet &&
    !isCreatingNewItem &&
    !activeEditor &&
    trimmedSearch.length === 0 &&
    !suggestionState?.lockedCommand &&
    !suggestionState?.isAtMenuOpen;

  const isNarrowView = (displayHomeView && !isStoreLocked) || (shouldShowSuggestions && !isStoreLocked);

  const isBoardViewOpen = !!(
    !isStoreLocked &&
    suggestionState &&
    shouldShowSuggestions &&
    suggestionState.isVisible !== false &&
    !suggestionState.isAtMenuOpen &&
    !suggestionState.isAutomationActive &&
    suggestionState.lockedCommand !== 'calendar' &&
    suggestionState.lockedCommand !== 'upload_drive' &&
    (activeView?.type !== 'allItems' || isStoreLocked) &&
    !isLinkEditModalOpen
  );

  useEffect(() => {
    onBoardViewOpenChange?.(isBoardViewOpen);
  }, [isBoardViewOpen, onBoardViewOpenChange]);

  const actionWorkspace = selectedWorkspace ?? dbWorkspaces[0] ?? null;
  const canCreateContent = Boolean(actionWorkspace);

  // When HomeView appears (search is cleared), ensure the first item is selected
  // and the search bar preview is updated to match it
  useEffect(() => {
    if (displayHomeView && homeViewRef.current) {
      // Use a small delay to ensure HomeView has rendered and computed interactiveItems
      const timeoutId = setTimeout(() => {
        homeViewRef.current?.focusFirstItem();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayHomeView]);

  // When search value becomes empty and we're in HomeView, ensure preview is restored
  // This handles the case when command mode exits (via Backspace/Escape) and value is empty
  // Also handles when the inline query box is cleared - we need to restore preview for the first item
  useEffect(() => {
    if (displayHomeView && homeViewRef.current && !searchValue.trim()) {
      // Trigger focusFirstItem to ensure the preview is restored for the first item
      // This ensures the search bar shows the correct icon/placeholder after exiting command mode
      // or clearing the inline query box
      const timeoutId = setTimeout(() => {
        homeViewRef.current?.focusFirstItem();
        // Also request preview restore from Searchbar to ensure it's updated
        // searchbarRef.current?.requestPreviewRestore();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayHomeView, searchValue]);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const user_id = await getUserId();
        setUserId(user_id);
      } catch (error) {
      } finally {
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    // Force dark mode only (temporarily disable light mode switching).

    document.documentElement.classList.add('dark');
    chrome.storage.local.set({ theme: 'dark' });
  }, []);

  const toggleDarkMode = () => {
    // Theme switching is temporarily disabled; keep dark mode enforced.

    document.documentElement.classList.add('dark');
    chrome.storage.local.set({ theme: 'dark' });
  };

  const resolveWorkspace = (workspaceOverride?: Workspace | null): Workspace | null => {
    if (workspaceOverride) return workspaceOverride;
    if (selectedWorkspace) return selectedWorkspace;
    return null; // Do NOT default to the first workspace automatically
  };

  const handleAddNote = (workspaceOverride?: Workspace | null) => {
    // Only use an override or currently selected workspace; do NOT default to the first one in the team
    const workspaceToUse = workspaceOverride || selectedWorkspace || null;

    useUIStore.getState().setSnippetBreadcrumb({
      workspace_id: workspaceToUse?.workspace_id || null,
      workspace_name: workspaceToUse?.workspace_name || null,
      folder_id: null,
      folder_name: null,
    });
    // If we have a workspace, use it; otherwise clear the selection
    useUIStore.getState().setSelectedWorkspaceId(workspaceToUse ? workspaceToUse.workspace_id : null);
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSelectedSnippetId(null);
  };

  const handleAddLink = (folderId?: string, workspaceOverride?: Workspace | null) => {
    const workspaceToUse = resolveWorkspace(workspaceOverride);
    if (!workspaceToUse) {
      triggerNotification('Select or create a workspace first', 'info');
      return;
    }

    useUIStore.getState().openEditor({ type: 'link', id: 'new' });
  };

  const handleGoHome = () => {
    useUIStore.getState().clearEditorStates();
    useUIStore.getState().setSelectedWorkspaceId(null);
    useUIStore.getState().setSelectedFolderId(null);
    setSuggestionState(null);
    setSearchValue('');
    useUIStore.getState().setView({ type: 'home' });
    // Focus search bar when going home (matching AltS behavior)
    setTimeout(() => {
      searchbarRef.current?.focus();
    }, 0);
  };

  const handleNavigateBack = useCallback(
    (forceNavigate?: any) => {
      const shouldForce = forceNavigate === true;
      const isEditorOpen =
        isLinkEditModalOpen ||
        isCreatingNewItem ||
        activeEditor !== null ||
        [
          'noteEditor',
          'linkEditor',
          'aiEditor',
          'agentPanel',
          'todos',
          'bulk',
          'organizationSettings',
          'createWorkspace',
          'createFolder',
          'sharedFolderCreation',
          'workspaceShare',
        ].includes(activeView?.type);
      if (isEditorOpen || selectedSnippet) {
        useUIStore.getState().setSelectedSnippetId(null);

        useUIStore.getState().clearEditorStates();
        useUIStore.getState().setSelectedWorkspaceId(null);
        useUIStore.getState().setSelectedFolderId(null);
        useUIStore.getState().setSnippetBreadcrumb(null);
        setSuggestionState(null);
        setSearchValue('');
        useUIStore.getState().closeEditor();
        useUIStore.getState().setView({ type: 'home' });
        setTimeout(() => searchbarRef.current?.focus(), 0);
        return;
      } else if (selectedFolder) {
        // Logic for "Back" when inside a Folder
        useUIStore.getState().setSelectedFolderId(null);
        // Collapse the folder in the sidebar
        // folder collapse handled by setSelectedFolderId
        useUIStore.getState().setSnippetBreadcrumb({
          workspace_id: selectedWorkspace!.workspace_id,
          workspace_name: selectedWorkspace!.workspace_name,
          folder_id: null,
          folder_name: null,
        });
      } else if (selectedWorkspace) {
        // Logic for "Back" when inside a Workspace (going to Home)
        useUIStore.getState().setSelectedWorkspaceId(null);
        useUIStore.getState().setSnippetBreadcrumb(null);
        // Collapse all workspaces in the sidebar
        useUIStore.getState().expandAllWorkspaces({});
      }
      // Removed suggestion state and search clear to show results persistently during navigation
      // setSuggestionState(null);
      // setSearchValue('');
      // searchbarRef.current?.clear();
      setTimeout(() => searchbarRef.current?.focus(), 0);
    },
    [
      selectedFolder,
      selectedWorkspace,
      selectedSnippet,
      isCreatingNewItem,
      isLinkEditModalOpen,
      activeView?.type,
      activeEditor,
    ],
  );

  const handleHomeLinkEdit = useCallback((item: SnippetSuggestion) => {
    const snippet = (item as any).item || (item as any).snippet;
    if (!snippet) return;

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

  const handleRequestOpenUrls = useCallback(
    (urls: string[], title?: string) => {
      searchbarRef.current?.openUrls(urls, title);
    },
    [searchbarRef],
  );

  const handleHomeSnippetSelect = useCallback(
    async (item: SnippetSuggestion) => {
      const searchItem = (item as any).item || (item as any).snippet;
      const { workspace, folder } = item;

      // 1. Navigation to grid view (Workspace/Folder selection)
      if (!searchItem && workspace) {
        useUIStore.getState().setSelectedWorkspaceId(workspace ? workspace.workspace_id : null);
        useUIStore.getState().setSelectedFolderId(folder ? folder.folder_id : null);
        useUIStore.getState().setView({ type: 'home' });
        return;
      }

      if (!searchItem) return;

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
        } else {
          const itemValue = searchItem.value as any;
          if (itemValue && Array.isArray(itemValue.urls)) {
            sessionUrls = itemValue.urls;
          } else if (Array.isArray(itemValue)) {
            sessionUrls = itemValue;
          }
          sessionNames = Array.isArray(itemValue?.names) ? itemValue.names : [];
        }

        chrome.runtime.sendMessage({
          action: 'start_session',
          sessionId: searchItem.snippet_id || searchItem.id,
          sessionName: searchItem.key || 'Untitled Tab Session',
          workspaceId: workspace?.workspace_id || null,
          folderId: folder?.folder_id || null,
          initialUrls: sessionUrls,
          initialNames: sessionNames,
          openSettings: sessionRecord?.sessionOpenSettings || (searchItem as any).sessionOpenSettings,
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

      if (workspace) {
        useUIStore.getState().setSelectedWorkspaceId(workspace ? workspace.workspace_id : null);
        useUIStore.getState().setSelectedFolderId(folder ? folder.folder_id : null);
        useUIStore.getState().viewSnippet({
          snippet: searchItem,
          breadcrumb: {
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder?.folder_id || null,
            folder_name: folder?.folder_name || null,
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
    },
    [handleRequestOpenUrls],
  );

  // Handle snippet selection from search (like AltS)
  const handleSearchSnippetSelect = useCallback(
    (item: SnippetSuggestion) => {
      if (!item.workspace) return;

      // Clear and blur search bar (matching AltS behavior)
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      handleHomeSnippetSelect(item);
    },
    [handleHomeSnippetSelect],
  );

  const normalizeAutomationForExecution = useCallback((automation: any) => {
    const mapSteps = (steps: any[]): any[] =>
      (steps || []).map((step: any, index: number) => {
        const rawSubSteps = Array.isArray(step?.subSteps) ? step.subSteps : step?.sub_steps || [];
        return {
          ...step,
          id: step?.id || `step-${index + 1}`,
          moduleId: String(step?.moduleId || step?.module_id || step?.module || step?.module_key || step?.type || ''),
          config: step?.config || step?.params || step?.parameters || {},
          subSteps: Array.isArray(rawSubSteps) ? mapSteps(rawSubSteps) : [],
        };
      });

    const rawSteps = Array.isArray(automation?.steps)
      ? automation.steps
      : Array.isArray(automation?.automation_steps)
        ? automation.automation_steps
        : [];

    return {
      ...automation,
      id: String(automation?.id || automation?.automation_id || automation?.name || 'automation'),
      steps: mapSteps(rawSteps),
      inputs: automation?.inputs || automation?.automation_inputs || [],
    };
  }, []);

  const handleAutomationSelect = useCallback(
    (automation: SavedAutomation) => {
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      const normalized = normalizeAutomationForExecution(automation);
      runAutomation(normalized as any);
    },
    [normalizeAutomationForExecution],
  );

  const handleAutomationEdit = useCallback(
    (automation: SavedAutomation) => {
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      const normalizedAuto = normalizeAutomationForExecution(automation);

      useUIStore
        .getState()
        .openEditor({ type: 'agent', id: 'new', isNew: true, props: { editMode: true, automation: normalizedAuto } });
    },
    [normalizeAutomationForExecution],
  );

  const handleRunAutomationFromAiPanel = useCallback(
    (automation: any) => {
      // Use the searchbar's built-in locking mechanism to ensure state sync and prevent render loops
      searchbarRef.current?.lockCommand(null);

      useUIStore.getState().setView({ type: 'home' });
      const invokeActivation = (attempt: number) => {
        if (searchbarRef.current?.activateAutomation) {
          // Pass the raw automation; searchbar's activateAutomation handles normalization
          searchbarRef.current.activateAutomation(automation);
          return;
        }
        if (attempt >= 10) {
          triggerNotification('Search bar is not ready yet. Please try again.', 'warning');
          return;
        }
        setTimeout(() => invokeActivation(attempt + 1), 40);
      };
      setTimeout(() => invokeActivation(0), 10);
    },
    [searchbarRef, triggerNotification],
  );

  const handleEditAutomationFromAiPanel = useCallback(
    (automation: SavedAutomation) => {
      setSuggestionState(prev => (prev ? { ...prev, lockedCommand: null, value: '' } : prev));
      handleAutomationEdit(automation);
    },
    [handleAutomationEdit],
  );

  const handleExecuteModuleFromAiPanel = useCallback(
    (module: any) => {
      const moduleId = String(module?.module_id || module?.id || '');
      if (!moduleId) return;

      // Use the searchbar's built-in locking mechanism to ensure state sync and prevent render loops
      searchbarRef.current?.lockCommand(null);

      useUIStore.getState().setView({ type: 'home' });
      const invokeModule = (attempt: number) => {
        if (searchbarRef.current?.executeModule) {
          searchbarRef.current.executeModule(moduleId);
          return;
        }
        if (attempt >= 10) {
          triggerNotification('Search bar is not ready yet. Please try again.', 'warning');
          return;
        }
        setTimeout(() => invokeModule(attempt + 1), 40);
      };
      setTimeout(() => invokeModule(0), 10);
    },
    [searchbarRef, triggerNotification],
  );

  // Expose handler to parent (App) so it can pass to SideBar
  useEffect(() => {
    if (onSnippetSelectFromSearch) {
      (window as any).__containerSnippetSelectHandler = handleSearchSnippetSelect;
    }
  }, [handleSearchSnippetSelect, onSnippetSelectFromSearch]);

  const handleHomeDeleteRequest = useCallback(
    async (detail: SnippetActionDetail) => {
      if (!detail) return;
      storageDebug.warn('Container.handleHomeDeleteRequest', 'Delete requested from home/search UI', {
        detail,
        selectedTeamId: selectedTeam?.team_id,
        selectedTeamStorageMode: selectedTeam?.storageMode,
      });

      try {
        // Show loading status
        useUIStore.getState().setCommandStatus({ status: 'loading', message: `Deleting "${detail.snippetKey}"...` });

        if (detail.commandId === 'delete_folder') {
          await deleteSnippet(detail.snippetId);
        } else if (detail.snippetId.startsWith('note_')) {
          await deleteNote(detail.snippetId);
        } else if (
          detail.snippetId.startsWith('link_') ||
          detail.snippetId.startsWith('bookmark_') ||
          (detail.commandId as string) === 'delete_link'
        ) {
          await deleteLink(detail.snippetId);
        } else if (detail.snippetId.startsWith('todo_') || (detail.commandId as string) === 'delete_todo') {
          await deleteTodo(detail.snippetId);
          window.dispatchEvent(new CustomEvent('todosUpdated'));
        } else if (detail.snippetId.startsWith('session_') || (detail.commandId as string) === 'delete_session') {
          await deleteSession(detail.snippetId);
        } else if (
          detail.snippetId.startsWith('prompt_') ||
          detail.snippetId.startsWith('aiPrompt_') ||
          (detail.commandId as string) === 'delete_prompt'
        ) {
          await deleteAiPrompt(detail.snippetId);
        } else if (
          detail.snippetId.startsWith('agent_') ||
          detail.snippetId.startsWith('chatAgent_') ||
          (detail.commandId as string) === 'delete_agent'
        ) {
          await deleteChatAgent(detail.snippetId);
        } else if (detail.snippetId.startsWith('automation_') || (detail.commandId as string) === 'delete_automation') {
          await deleteAutomation(detail.snippetId);
        } else {
          await deleteSnippet(detail.snippetId);
        }

        // Show success status in footer
        useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted successfully' });
        // Clear status after delay
        setTimeout(() => {
          useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
        }, 3000);

        reload();
        storageDebug.warn('Container.handleHomeDeleteRequest', 'Delete completed', { detail });
        if (
          selectedSnippet &&
          (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)
        ) {
          useUIStore.getState().setSelectedSnippetId(null);
          useUIStore.getState().setSnippetBreadcrumb(null);
        }
      } catch (error: any) {
        console.error('Delete failed, performing local fallback delete:', error);
        storageDebug.error('Container.handleHomeDeleteRequest', 'Delete failed', error, {
          detail,
          selectedTeamId: selectedTeam?.team_id,
          selectedTeamStorageMode: selectedTeam?.storageMode,
        });

        // Local fallback deletion from Dexie tables so it is removed from UI
        try {
          const sid = detail.snippetId;
          await db.notes.delete(sid);
          await db.links.delete(sid);
          await db.snippets.delete(sid);
          await db.todos.delete(sid);
          await db.sessions.delete(sid);
          await db.aiPrompts.delete(sid);
          await db.chatAgents.delete(sid);
          await db.automations.delete(sid);
          window.dispatchEvent(new CustomEvent('todosUpdated'));
        } catch (localErr) {
          console.error('Local fallback delete failed:', localErr);
        }

        const message = error?.response?.data?.error || error?.message || 'Failed to delete';
        useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted locally' });
        // Clear status after delay
        setTimeout(() => {
          useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
        }, 3000);
        reload();
      }
    },
    [deleteSnippet, deleteLink, deleteTodo, deleteNote, reload, selectedSnippet, selectedTeam],
  );

  const handleCloseHomeDeleteDialog = useCallback(() => {
    setHomeDeleteContext({ isOpen: false, detail: null });
  }, []);

  const handleConfirmHomeDelete = useCallback(async () => {
    const detail = homeDeleteContext.detail;
    if (!detail) return;

    // Close dialog immediately for better UX
    setHomeDeleteContext({ isOpen: false, detail: null });

    try {
      // Show loading status
      useUIStore.getState().setCommandStatus({ status: 'loading', message: `Deleting "${detail.snippetKey}"...` });

      if (detail.commandId === 'delete_folder') {
        await deleteSnippet(detail.snippetId);
      } else if (detail.snippetId.startsWith('note_')) {
        await deleteNote(detail.snippetId);
      } else if (
        detail.snippetId.startsWith('link_') ||
        detail.snippetId.startsWith('bookmark_') ||
        (detail.commandId as string) === 'delete_link'
      ) {
        await deleteLink(detail.snippetId);
      } else if (detail.snippetId.startsWith('todo_') || (detail.commandId as string) === 'delete_todo') {
        await deleteTodo(detail.snippetId);
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      } else if (detail.snippetId.startsWith('session_') || (detail.commandId as string) === 'delete_session') {
        await deleteSession(detail.snippetId);
      } else if (
        detail.snippetId.startsWith('prompt_') ||
        detail.snippetId.startsWith('aiPrompt_') ||
        (detail.commandId as string) === 'delete_prompt'
      ) {
        await deleteAiPrompt(detail.snippetId);
      } else if (
        detail.snippetId.startsWith('agent_') ||
        detail.snippetId.startsWith('chatAgent_') ||
        (detail.commandId as string) === 'delete_agent'
      ) {
        await deleteChatAgent(detail.snippetId);
      } else if (detail.snippetId.startsWith('automation_') || (detail.commandId as string) === 'delete_automation') {
        await deleteAutomation(detail.snippetId);
      } else {
        await deleteSnippet(detail.snippetId);
      }

      // Show success status in footer
      useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted successfully' });
      // Clear status after delay
      setTimeout(() => {
        useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
      }, 3000);

      reload();
      storageDebug.warn('Container.handleConfirmHomeDelete', 'Confirmed delete completed', { detail });
      if (
        selectedSnippet &&
        (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)
      ) {
        useUIStore.getState().setSelectedSnippetId(null);
        useUIStore.getState().setSnippetBreadcrumb(null);
      }
    } catch (error: any) {
      console.error('Delete failed, performing local fallback delete:', error);
      storageDebug.error('Container.handleConfirmHomeDelete', 'Confirmed delete failed', error, {
        detail,
        selectedTeamId: selectedTeam?.team_id,
        selectedTeamStorageMode: selectedTeam?.storageMode,
      });

      // Local fallback deletion from Dexie tables so it is removed from UI
      try {
        const sid = detail.snippetId;
        await db.notes.delete(sid);
        await db.links.delete(sid);
        await db.snippets.delete(sid);
        await db.todos.delete(sid);
        await db.sessions.delete(sid);
        await db.aiPrompts.delete(sid);
        await db.chatAgents.delete(sid);
        await db.automations.delete(sid);
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      } catch (localErr) {
        console.error('Local fallback delete failed:', localErr);
      }

      const message = error?.response?.data?.error || error?.message || 'Failed to delete';
      useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted locally' });
      // Clear status after delay
      setTimeout(() => {
        useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
      }, 3000);
      reload();
    }
  }, [
    deleteSnippet,
    deleteLink,
    deleteTodo,
    deleteNote,
    homeDeleteContext.detail,
    reload,
    selectedSnippet,
    selectedTeam,
  ]);

  // Allow DefaultContainer (HomeView) to return focus back to the search bar
  const handleRequestFocusSearch = useCallback(() => {
    if (searchbarRef.current) {
      searchbarRef.current.focus();
    }
  }, [searchbarRef]);

  // Handle command preview (matching AltS behavior)
  // This must clear immediately when navigating to notes to ensure icon updates synchronously.
  const handleCommandPreview = useCallback((commandId: CommandId | 'ai' | null) => {
    if (!searchbarRef.current) return;
    if (commandId) {
      searchbarRef.current.previewCommand(commandId);
    } else {
      searchbarRef.current.clearCommandPreview();
    }
  }, []);

  // Global keyboard handler for closing command list with Escape/Backspace

  const handleInteractiveItemHighlight = useCallback((item: InteractiveItem | null) => {
    if (!searchbarRef.current) return;

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

  const handleCommandExecute = useCallback(
    async (
      commandId: CommandId | LocalCommandId | 'ai',
      options?: { prompt?: string; files?: { base64: string; filename: string }[] },
    ) => {
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
      // Special case: don't clear for view-locking commands like 'saved-automation'
      if (commandId !== 'saved-automation' && (commandId as any) !== 'store') {
        setSearchValue('');
        setSuggestionState(null);
        searchbarRef.current?.clear();
      }

      const context: CommandContext = {
        prompt: options?.prompt,
        files: options?.files,
        state: useDbStore.getState(),
        previouslySelectedFolder: null,
        services: getCommandServices(useDbStore.getState(), {
          toast: (msg, type) => triggerNotification(msg, type || 'info'),
          navigation: (view: any) => {
            // Handle specific view requests from commands
            if (view.kind === 'noteEditor') {
              console.log('[Container] Navigation requested for noteEditor');
              useUIStore.getState().openEditor({ type: 'note', id: 'new', props: view.noteProps });
            } else if (view.kind === 'linkEditor') {
              console.log('[Container] Navigation requested for linkEditor');
              useUIStore.getState().openEditor({ type: 'link', id: 'new', props: view.linkProps });
            } else if (view.kind === 'sessionEditor') {
              useUIStore.getState().openEditor({ type: 'session', id: 'new', props: view.sessionProps });
            } else if (view.kind === 'folderEditor') {
              useUIStore.getState().openCreateFolder();
            } else if (view.kind === 'agentPanel') {
              useUIStore.getState().openEditor({ type: 'agent', id: 'new', props: view.agentProps });
            } else if (view.kind === 'custom') {
              if (commandId === 'createprompt') {
                useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
              }
            } else if (view.kind === 'store') {
              useUIStore.getState().setView({ type: 'store' });
            } else if (view.kind === 'allItems') {
              // Don't clear search bar - user can filter items using main searchbar
              setSuggestionState(null);
              useUIStore.getState().setView({ type: 'allItems', itemType: view.itemType });
              // Ensure focus logic runs after render
              setTimeout(() => {
                searchbarRef.current?.focus();
              }, 10);
            } else if (view.kind === 'createWorkspace') {
              useUIStore.getState().openCreateWorkspace();
            } else if (view.kind === 'createFolder') {
              useUIStore.getState().openCreateFolder();
            } else if (view.kind === 'workspaceShare') {
            } else if (commandId === 'showallnotes') {
              setSuggestionState(null);
              useUIStore.getState().setView({ type: 'allItems', itemType: 'notes' });
              // Ensure focus logic runs after render
              setTimeout(() => {
                searchbarRef.current?.focus();
              }, 10);
            } else if (commandId === 'showalllinks') {
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

      await commandRegistry.execute(commandId as string, context);
    },
    [triggerNotification, handleReload, isLoggedIn, onNavigateToListView, onCommandListCategoryChange],
  );

  // Handle Link Creation
  // Removed broken useEffect that unconditionally forced link editor on any new item creation

  // Handle Note Creation - switch to noteEditor when creating new note
  useEffect(() => {
    if (
      isCreatingNewItem &&
      snippetBreadCrum &&
      (snippetBreadCrum.workspace_id || snippetBreadCrum.folder_id) &&
      activeEditor?.type !== 'link' &&
      activeEditor?.type !== 'session' &&
      activeEditor?.type !== 'todo' &&
      activeEditor?.type !== 'agent' &&
      activeEditor?.type !== 'ai' &&
      activeEditor?.type !== 'aiPrompt'
    ) {
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
    const items: any[] = [...dbConvertibleItems];

    commands.forEach(cmd => {
      items.push({
        id: `cmd-${cmd.id}`,
        name: cmd.label,
        category: 'command',
        data: { ...cmd, key: cmd.label, value: cmd.id },
      });
    });
    return items;
  }, [commands, dbConvertibleItems]);

  const [asyncItems, setAsyncItems] = useState<any[]>([]);
  useEffect(() => {
    const loadModules = async () => {
      const storage: any = await new Promise(resolve => chrome.storage.local.get(['installed_modules'], resolve));
      const localModules = storage.installed_modules || [];
      const mapModules = (modules: any[]) =>
        modules.map((m: any) => ({
          id: `mod-${m.id || m.installation_id || m.module_id || m.installationId}`,
          name: m.name || m.module_name || m.label || 'Untitled Module',
          category: 'module',
          data: m,
        }));
      if (Array.isArray(localModules) && localModules.length > 0) {
        setAsyncItems(mapModules(localModules));
      }
    };
    loadModules();
    const listener = (changes: any) => {
      if (changes.installed_modules) {
        loadModules();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const finalConvertibleItems = useMemo(() => {
    return [...convertibleItems, ...asyncItems];
  }, [convertibleItems, asyncItems]);

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
      if (!snippetId && data.type !== 'custom') throw new Error('Failed to identify item ID');

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
        } catch (e) {
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
            } else {
              dt = targetDate;
              dt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0);
            }
          } else {
            const randomMs = Math.floor(Math.random() * (eodMs - nowMs));
            dt = new Date(nowMs + randomMs);
          }

          if (!isNaN(dt.getTime())) {
            deadline = dt.toISOString();
          }
        } catch (e) {
          console.warn('[Container] Failed to set anytime deadline:', e);
          deadline = nowUtc();
        }
      }

      // Save or Update todo
      const existingTodoId =
        data.todoId ||
        todoCreatePrefill?.todo_id ||
        (todoCreatePrefill?.snippet_id && todoCreatePrefill?.is_todo_type ? todoCreatePrefill.snippet_id : undefined);
      if (existingTodoId) {
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
            const updated = localTodos.map((t: any) =>
              String(t.snippet_id || t.id) === sid
                ? {
                    ...t,
                    key: data.title,
                    title: data.title,
                    value: data.description,
                    event_deadline: deadline,
                    is_recurring: data.scheduleType === 'recurring',
                    recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                    is_anytime: isAnytime,
                    config: configFromSelection,
                    tags: data.tags || [],
                    shortcut: data.shortcut || '',
                  }
                : t,
            );
            await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
          }
        } else {
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
            const localTodos = result.local_todos || [];
            const bestTodoId = existingTodoId;
            const updated = localTodos.map((t: any) =>
              String(t.snippet_id || t.id || t.todo_id) === String(bestTodoId || sid)
                ? {
                    ...t,
                    key: data.title,
                    title: data.title,
                    value: data.description,
                    event_deadline: deadline,
                    is_recurring: data.scheduleType === 'recurring',
                    recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                    is_done: todoCreatePrefill?.is_done || false,
                    config: configFromSelection,
                    tags: data.tags || [],
                    shortcut: data.shortcut || '',
                  }
                : t,
            );
            await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
          }

          try {
            const bestTodoId = existingTodoId;
            if (sid) {
              try {
                await updateSnippet(sid, {
                  config: configFromSelection,
                });
              } catch (updateErr) {
                console.warn('[Container] updateSnippet failed (item may not be a snippet):', updateErr);
              }
            }
          } catch (cloudError) {
            console.error('[Container] Cloud sync failed for edit:', cloudError);
          }

          // Update Dexie database
          try {
            const todoId = String(existingTodoId || sid);
            const updateReferences =
              Array.isArray(data.selectedItems) && data.selectedItems.length > 0
                ? data.selectedItems.map((item: any) => ({
                    type: item.category || 'snippet',
                    id: item.id || item.snippet_id,
                  }))
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
              scheduleTime: new Date(deadline).getTime(),
              recurringType: (data.recurringCycle as any) || undefined,
              scheduleType: data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
              references: updateReferences,
              tagIds: data.tagIds || [],
              shortcut: data.shortcut || '',
              updatedAt: Date.now(),
            });
            if (data.shortcut !== undefined) {
              if (data.shortcut) {
                await saveShortcut(todoId, todoId, data.shortcut, data.title, 'todo');
              } else {
                await clearShortcut(todoId, todoId, 'todo');
              }
            }
            if (data.hotkey !== undefined) {
              if (data.hotkey) {
                await saveHotkey(todoId, todoId, data.hotkey, data.title, 'todo');
              } else {
                await clearHotkey(todoId, todoId, 'todo');
              }
            }
            if (data.isFavorite !== undefined) {
              const compoundId = getItemCompoundId({ id: todoId, _kind: 'todo' });
              const currentFavs = useDbStore.getState().favorites || [];
              const isFav = currentFavs.some((f: any) => f.itemId === compoundId);
              if (data.isFavorite !== isFav) {
                await toggleFavoriteRecord(compoundId, 'todo', data.title);
              }
            }
          } catch (dbError) {
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
      } else if (['custom'].includes(data.type)) {
        const storageResult = await new Promise<any>(resolve =>
          chromeAny.storage.local.get(['lastNoteDestination', 'user', 'local_todos'], resolve),
        );
        const lastDest = storageResult.lastNoteDestination;
        const localTodos = storageResult.local_todos || [];

        let targetWorkspaceId = lastDest?.workspace_id;
        const targetFolderId = lastDest?.folder_id;

        if (!targetWorkspaceId && dbWorkspaces.length > 0) {
          targetWorkspaceId = dbWorkspaces[0].id;
        }

        const taskValue = data.description;
        let todoIdVal = `local-temp-${Date.now()}`;

        // Save to Dexie database first to get the correct entity ID
        try {
          const newTodo = await createTodo(
            data.title,
            [],
            data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
            new Date(deadline).getTime(),
            data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
            data.description,
          );
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
              await saveHotkey(todoIdVal, todoIdVal, data.hotkey, data.title, 'todo');
            }
            if (data.isFavorite) {
              const compoundId = getItemCompoundId({ id: todoIdVal, _kind: 'todo' });
              await toggleFavoriteRecord(compoundId, 'todo', data.title);
            }
          }
        } catch (dbError) {
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
          folder_id: targetFolderId || '',
          workspace_id: targetWorkspaceId || null,
          is_anytime: isAnytime,
          tags: data.tags || [],
          shortcut: data.shortcut || '',
        };

        await new Promise<void>(resolve =>
          chromeAny.storage.local.set({ local_todos: [optimisticTask, ...localTodos] }, resolve),
        );

        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(todoIdVal),
            deadline: deadline || nowUtc(),
            is_anytime: isAnytime,
          });
        }
      } else {
        const rawId =
          String(snippetId).includes('-') &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(snippetId))
            ? String(snippetId).split('-').slice(1).join('-')
            : snippetId;

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
          value: ['automation', 'module', 'command', 'agent', 'chat_agent', 'install'].includes(cat)
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
          folder_id: data.folderId || data.item?.folder_id || '',
          workspace_id: data.workspaceId || data.item?.workspace_id || null,
          tagIds: data.tagIds || [],
          is_anytime: isAnytime,
          config: configFromSelection,
        };

        // Save to Dexie database
        try {
          let references: any[] = [];
          if (Array.isArray(data.selectedItems)) {
            references = data.selectedItems.map((item: any) => ({
              type: item.category || 'snippet',
              id: item.id || item.snippet_id,
            }));
          } else if (data.item) {
            references = [
              {
                type: data.type || 'note',
                id: rawId,
              },
            ];
          }
          const newTodo = await createTodo(
            data.title,
            references,
            data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
            new Date(deadline).getTime(),
            data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
            data.description,
          );
          if (newTodo && newTodo.id) {
            const compoundId = getItemCompoundId({
              id: newTodo.id,
              workspace_id: data.workspaceId,
              folder_id: data.folderId,
              snippet: { id: newTodo.id, category: 'todo' },
            });
            await db.todos.update(newTodo.id, {
              tagIds: data.tagIds || [],
              workspaceId: data.workspaceId || null,
              folderId: data.folderId || null,
              shortcut: data.shortcut || '',
            } as any);
            if (data.shortcut) {
              await saveShortcut(newTodo.id, compoundId, data.shortcut, data.title, 'todo');
            }
            if (data.hotkey) {
              await saveHotkey(newTodo.id, compoundId, data.hotkey, 'todo');
            }
            if (data.isFavorite) {
              await toggleFavoriteRecord(compoundId, 'todo', data.title);
            }
          }
        } catch (dbError) {
          console.error('[Container] Failed to create Dexie todo (selection):', dbError);
        }

        if (chromeAny?.storage?.local) {
          const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
          const localTodos = result.local_todos || [];
          await new Promise<void>(resolve =>
            chromeAny.storage.local.set({ local_todos: [optimisticTask, ...localTodos] }, resolve),
          );
        }

        const finalTask = { ...optimisticTask, todo_id: String(rawId) };
        const freshResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
        const freshTodos = (freshResult.local_todos || []).map((t: any) =>
          t.snippet_id === String(rawId) ? finalTask : t,
        );
        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: freshTodos }, resolve));

        if (rawId) {
          try {
            await updateSnippet(rawId, {
              config: configFromSelection,
            });
          } catch (updateErr) {
            console.warn('[Container] updateSnippet failed (item may not be a snippet):', updateErr);
          }
        }

        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(rawId),
            deadline: deadline || nowUtc(),
            is_anytime: isAnytime,
          });
        }
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (e) {
      console.error('[Container] handleCreateFromSelection failed:', e);
      throw e;
    }
  };

  // We no longer move focus explicitly from the search bar into HomeView here.
  // DefaultContainer listens to global keydown events (like AltS) and
  // handles ArrowUp/ArrowDown navigation while the search input stays focused.

  // Determines what to render in the main content area
  const renderMainContent = () => {
    // Priority -1: Sheet UI
    let sheetBackground: React.ReactNode = null;
    if (isSpreadsheetViewOpen) {
      sheetBackground = (
        <div className="flex-1 w-full flex overflow-auto p-[1px] relative">
          <SpreadsheetMainContainer
            onClose={onCloseSpreadsheetMainContainer}
            savedAutomations={savedAutomations}
            savedAgents={savedAiAgents}
            onCreateOrganization={handleCreateOrganization}
            onOrganizationSettings={handleOrganizationSettings}
            onCreateWorkspace={onCreateWorkspace}
            isLoggedIn={isLoggedIn}
            onRequireLogin={() => {}}
            onBoardViewRedirect={onBoardViewRedirect}
          />
        </div>
      );

      // If we are not opening an overlay editor, just return the spreadsheet UI
      if (!activeEditor?.props?.isOverlay) {
        return sheetBackground;
      }
    }

    const isAiLocked =
      suggestionState?.lockedCommand === 'ai' ||
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
      return (
        <div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div
            className="flex-1 h-full min-h-0 relative rounded-xl dark:rounded-none overflow-visible"
            style={{ border: 'none' }}>
            <ChatAgent
              key="ai-editor"
              state={aiState as SuggestionState}
              initialTab="agents"
              isMac={isMac}
              isLoggedIn={isLoggedIn}
              savedAutomations={savedAutomations}
              onSelectSavedAgent={handleSelectSavedAgent}
              onRunAutomation={handleRunAutomationFromAiPanel}
              onEditAutomation={handleEditAutomationFromAiPanel}
              onExecuteModule={handleExecuteModuleFromAiPanel}
              onQueryChange={handleAIQueryChange}
              onClose={() => {
                handleNavigateBack();
              }}
            />
          </div>
        </div>
      );
    }

    // Priority 1: Editor
    const showEditor = activeEditor?.type === 'note' || activeEditor?.type === 'link';

    if (activeEditor?.type === 'session') {
      const editorComponent = (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-visible">
            <SessionEditorView
              isOpen={true}
              onClose={() => useUIStore.getState().closeEditor()}
              session={activeEditor?.props?.session || activeEditor?.props?.snippet || null}
              prefill={activeEditor?.props?.prefill || null}
              reload={reload}
            />
          </div>
        </div>
      );

      if (activeEditor?.props?.isOverlay && sheetBackground) {
        return (
          <div className="relative w-full h-full">
            {sheetBackground}
            <div className="absolute inset-0 z-[1000] backdrop-blur-sm bg-black/20 flex flex-col">
              {editorComponent}
            </div>
          </div>
        );
      }

      return editorComponent;
    }

    if (activeEditor?.type === 'todo') {
      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-visible">
            <CreateTodoView
              items={finalConvertibleItems}
              onCreateTodo={async (data: any) => {
                await handleCreateFromSelection(data);
                if (!data.createMore) {
                  useUIStore.getState().setTodoCreatePrefill(null);
                  useUIStore.getState().closeEditor();
                  setActiveTodoId(null);
                } else {
                  useUIStore.getState().setTodoCreatePrefill(null);
                  setActiveTodoId(null);
                }
              }}
              initialItem={
                todoCreatePrefill ||
                activeEditor?.props?.prefill ||
                activeEditor?.props?.item ||
                activeEditor?.props?.snippet
              }
              isEditMode={
                !!(
                  todoCreatePrefill?.todo_id ||
                  activeEditor?.props?.prefill?.todo_id ||
                  activeEditor?.props?.item?.id ||
                  activeEditor?.props?.snippet?.id ||
                  (activeEditor?.id && activeEditor.id !== 'new' && activeEditor.id !== 'todo-create')
                )
              }
              onClose={() => {
                useUIStore.getState().setTodoCreatePrefill(null);
                useUIStore.getState().closeEditor();
                setActiveTodoId(null);
              }}
              existingTodos={dbTodos}
              activeTodoId={
                activeTodoId ||
                (activeEditor?.id === 'new' || activeEditor?.id === 'todo-create' ? null : activeEditor?.id)
              }
              onLoadTodo={handleLoadTodo}
              onDeleteTodo={handleDeleteTodoById}
              hotkeysMap={dbHotkeysMap}
              onUpdateItemField={handleUpdateTodoField}
            />
          </div>
        </div>
      );
    }

    // Agent Panel
    if (activeEditor?.type === 'agent') {
      const agentProps = activeEditor?.props || {};
      return (
        <div className="flex-1 min-h-0 w-full flex flex-col items-center transition-all duration-300 px-4">
          <div className="h-[90%] flex justify-center bg-transparent transition-all duration-300 rounded-xl overflow-hidden w-full max-w-[1440px] ">
            <div
              className={`flex flex-col overflow-hidden transition-all duration-[400ms] ease-in-out rounded-xl  shadow-2xl border border-white/10 w-full max-w-[840px] md:min-w-[840px]`}>
              <AutomationDashboard
                isOpen={true}
                onClose={handleNavigateBack}
                editMode={agentProps.editMode}
                automation={agentProps.automation}
                reload={handleReload}
                onPickerToggle={setIsAgentPickerOpen}
                onSpeakerPropsChange={setAgentSpeakerProps}
              />
            </div>
          </div>
        </div>
      );
    }

    // AI Prompt Generator
    if (activeEditor?.type === 'aiPrompt') {
      return (
        <div className="flex-1 min-h-0 pt-6 flex flex-col">
          <div className="flex-1 w-full flex flex-col overflow-visible">
            <AiPromptEditorView
              aiPromptId={activeEditor?.id === 'new' ? null : activeEditor?.id}
              onBack={() => {
                useUIStore.getState().closeEditor();
                useUIStore.getState().setView({ type: 'home' });
              }}
              isFullScreenMode={false}
            />
          </div>
        </div>
      );
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

      const isSnippetMode =
        activeEditor?.props?.snippet?.category === 'snippet' ||
        activeEditor?.props?.snippet?.type === 'snippet' ||
        activeEditor?.props?.category === 'snippet';

      const hotkeySnippet =
        isSnippetMode && activeEditor?.id !== 'new'
          ? useDbStore.getState().snippets.find(s => s.id === activeEditor?.id)
          : null;

      if (activeEditor?.type === 'note' || activeEditor?.type === 'link') {
        let editorContent: React.ReactNode = null;

        if (activeEditor?.type === 'link') {
          editorContent = (
            <LinkEditorView
              isOpen={true}
              onClose={() => {
                useUIStore.getState().closeEditor();
                if (!activeEditor?.props?.isOverlay) {
                  setSearchValue('');
                  setSuggestionState(null);
                  searchbarRef.current?.clear();
                  useUIStore.getState().setView({ type: 'home' });
                }
              }}
              link={activeEditor?.props?.snippet || activeLinkSnippet || null}
              prefill={activeEditor?.props?.prefill || linkEditPrefill || null}
              reload={reload}
            />
          );
        } else if (isSnippetMode) {
          editorContent = (
            <EditSnippetScreen
              selectedSnippet={activeEditor?.props?.snippet || hotkeySnippet || effectiveSnippet}
              isCreatingNew={activeEditor?.id === 'new'}
              snippetBreadCrum={snippetBreadCrum}
              reload={handleReload}
              favoritesMapping={favoritesMapping}
              setFavoritesMapping={data => setFavoritesMapping(data)} // fix type mismatch if any
              onBack={() => {
                useUIStore.getState().closeEditor();
                if (!activeEditor?.props?.isOverlay) {
                  setSearchValue('');
                  setSuggestionState(null);
                  searchbarRef.current?.clear();
                  useUIStore.getState().setView({ type: 'home' });
                }
              }}
              initialDraftKey={activeEditor?.props?.initialDraftKey}
              initialDraftContent={activeEditor?.props?.initialDraftContent}
              category="snippet"
            />
          );
        } else {
          editorContent = (
            <NoteEditorView
              noteId={activeEditor?.id === 'new' ? null : activeEditor?.id}
              onBack={() => {
                useUIStore.getState().closeEditor();
                if (!activeEditor?.props?.isOverlay) {
                  setSearchValue('');
                  setSuggestionState(null);
                  searchbarRef.current?.clear();
                  useUIStore.getState().setView({ type: 'home' });
                }
              }}
              initialDraftKey={
                activeEditor?.props?.initialDraftKey ||
                activeEditor?.props?.snippet?.title ||
                activeEditor?.props?.snippet?.name ||
                activeEditor?.props?.snippet?.key
              }
              initialDraftContent={
                activeEditor?.props?.initialDraftContent ||
                activeEditor?.props?.snippet?.body ||
                activeEditor?.props?.snippet?.content ||
                activeEditor?.props?.snippet?.value
              }
            />
          );
        }

        if (activeEditor?.props?.isOverlay && sheetBackground) {
          return (
            <div className="relative w-full h-full">
              {sheetBackground}
              <div className="absolute inset-0 z-[1000] backdrop-blur-sm bg-black/20 flex flex-col">
                <div className="flex-1 min-h-0 pt-6">
                  <div className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full'} w-full flex flex-col overflow-visible bg-[var(--color-appBg)]`}>
                    {editorContent}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="flex-1 min-h-0 pt-6">
            <div className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full  '} w-full flex flex-col overflow-visible`}>
              {editorContent}
            </div>
          </div>
        );
      }
    }

    // Priority 2: Absolute Persistent Search Suggestions (Overlays secondary views)

    const isBoardSlashDropdownActive = (() => {
      const val = (suggestionState?.value || '').replace(/\u00A0/g, ' ');
      if (!val.startsWith('/')) return false;
      const textAfterSlash = val.slice(1).toUpperCase();
      const aliases = ['A', 'T', 'N', 'S', 'P', 'L', 'C', 'B'];
      const hasSpaceMatch = aliases.some(alias => textAfterSlash.startsWith(alias + ' '));
      return !hasSpaceMatch;
    })();

    if (
      suggestionState &&
      (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
      !suggestionState.isAtMenuOpen &&
      !suggestionState.isAutomationActive &&
      suggestionState.lockedCommand !== 'calendar' &&
      suggestionState.lockedCommand !== 'upload_drive' &&
      (activeView?.type !== 'allItems' || isStoreLocked) &&
      !isLinkEditModalOpen
    ) {
      return (
        <div
          className={`${isBoardSlashDropdownActive ? '' : 'glass-card border border-white/40 border-b-none border-r-none border-l-none dark:border-white/10'} ${!isStoreLocked ? 'w-[75vw] -ml-[calc(37.5vw-50%)] max-w-none mt-4 h-[calc(100vh-200px)]' : 'h-[90%] w-full'} min-h-0 overflow-visible rounded-xl dark:rounded-none dark:bg-transparent`}
          style={{ border: 'none' }}>
          {isStoreLocked ? (
            storeTab === 'catalog' ? (
              <AutomationCapabilitiesMenu
                query={suggestionState.value}
                onTabChange={setStoreTab}
                activeTab={storeTab}
                onExecuteModule={handleExecuteModuleFromAiPanel}
                onClose={() => searchbarRef.current?.lockCommand(null)}
              />
            ) : (
              <MyAutomationsList
                automations={savedAutomations}
                query={suggestionState.value}
                onRunAutomation={handleRunAutomationFromAiPanel}
                onEditAutomation={handleEditAutomationFromAiPanel}
                onExecuteModule={handleExecuteModuleFromAiPanel}
                onTabChange={setStoreTab}
                activeTab={storeTab}
                onClose={() => searchbarRef.current?.lockCommand(null)}
                userId={userId}
              />
            )
          ) : (
            <BoardView
              ref={boardViewRef}
              state={suggestionState}
              unfilteredSuggestions={unfilteredSuggestionsRef.current}
              isLoggedIn={isLoggedIn}
              onSheetRedirect={onOpenSpreadsheetMainContainer}
              onClose={() => {
                const shorthandFilters = ['/a', '/t', '/n', '/s', '/p', '/l', '/c', '/b'];
                if (shorthandFilters.includes(searchValue.trim().toLowerCase())) {
                  searchbarRef.current?.clear();
                }
                searchbarRef.current?.blur();
                if (isInitialAltSFocus && onInitialAltSFocusChange) {
                  onInitialAltSFocusChange(false);
                }
                handleGoHome();
              }}
              onExecuteItem={(item: any) => {
                const cmdDef = item.command || item;
                const cmdId = cmdDef.id || item.id;
                const urlTemplate = cmdDef.urlTemplate || '';
                const isAiCommand =
                  cmdId === 'ai' ||
                  ['gpt', 'claude', 'perplexity', 'gemini'].includes(cmdId) ||
                  cmdDef.category === 'ai';

                if (item._kind === 'command' && (isAiCommand || (urlTemplate && urlTemplate.includes('{query}')))) {
                  console.log('[Container] BoardView command clicked, locking command:', cmdId);
                  searchbarRef.current?.lockCommand(cmdId);
                  return true;
                }
                return false;
              }}
            />
          )}
        </div>
      );
    }

    // Priority 3.5: Store & Module Detail
    if (activeView?.type === 'store') {
      const aiState = suggestionState || {
        lockedCommand: 'ai',
        value: '',
        isSuggestionVisible: false,
        showAIHistoryPanel: false,
        isVisible: true,
        selectedAIs: [],
      };
      return (
        <div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div
            className="glass-card border border-white/40 border-b-none border-r-none border-l-none dark:border-white/10 flex-1 min-h-0 relative rounded-xl dark:rounded-none dark:bg-transparent overflow-visible"
            style={{ border: 'none' }}>
            <ChatAgent
              key="ai-store"
              state={aiState as SuggestionState}
              initialTab="skills"
              isMac={isMac}
              isLoggedIn={isLoggedIn}
              savedAutomations={savedAutomations}
              onSelectSavedAgent={handleSelectSavedAgent}
              onRunAutomation={handleRunAutomationFromAiPanel}
              onEditAutomation={handleEditAutomationFromAiPanel}
              onExecuteModule={handleExecuteModuleFromAiPanel}
              onQueryChange={(val: string) =>
                setSuggestionState(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    value: val,
                  };
                })
              }
              onClose={handleStoreClose}
            />
          </div>
        </div>
      );
    }

    // Priority 2.5: All Items View (Bookmarks only)
    if (activeView?.type === 'allItems') {
      if ((activeView as any)?.itemType === 'bookmarks') {
        return <div className="flex-1 min-h-0 h-[90%] w-full"></div>;
      }
    }

    // Priority 3.5: Organization Panels
    // OrganizationSettings panel removed

    if (activeView?.type === 'createFolder') {
      return (
        <div
          className="fixed top-0 bottom-0 right-0 z-[100] flex items-start pt-[15vh] justify-center pointer-events-none"
          style={{ left: showSidebarColumn ? '280px' : '0px' }}>
          <div className="w-[500px] h-[400px] pointer-events-auto relative bg-[var(--color-editorBg)] rounded-xl border border-neutral-800 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden translate-x-[8px]">
            <CreateFolderPanel
              onClose={() => {
                useUIStore.getState().setView({ type: 'home' });
              }}
              onSuccess={(id, name) => {
                console.log(`Created Folder ${name} (${id})`);
                useUIStore.getState().setView({ type: 'home' });
              }}
            />
          </div>
        </div>
      );
    }

    if (activeView?.type === 'createWorkspace') {
      return (
        <div
          className="fixed top-0 bottom-0 right-0 z-[100] flex items-start pt-[15vh] justify-center pointer-events-none"
          style={{ left: showSidebarColumn ? '280px' : '0px' }}>
          <div className="w-[500px] h-[340px] pointer-events-auto relative bg-[var(--color-editorBg)] rounded-xl border border-neutral-800 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden translate-x-[8px]">
            <CreateWorkspacePanel
              onClose={() => {
                useUIStore.getState().setView({ type: 'home' });
              }}
              onSuccess={(id, name) => {
                console.log(`Created Workspace ${name} (${id})`);
                useUIStore.getState().setView({ type: 'home' });
              }}
            />
          </div>
        </div>
      );
    }

    if (activeView?.type === 'workspaceShare') {
      return null;
    }

    if (activeView?.type === 'settings') {
      // Map { type:'settings', section:'...' } → the view.kind shape that SettingsLayout expects.
      const _settingsSection = (activeView as any).section as string | undefined;
      const _settingsView: any =
        _settingsSection === 'allWorkspaces'
          ? { kind: 'allWorkspaces' }
          : _settingsSection === 'googleDriveBackup'
            ? { kind: 'googleDriveBackup' }
            : _settingsSection === 'importCloudData'
              ? { kind: 'importCloudData' }
              : _settingsSection === 'workspaceSettings'
                ? { kind: 'workspaceSettings' }
                : // profile, billing, appearance, searchView, todoSettings, generalSettings all go here
                  { kind: 'generalSettings', section: _settingsSection };

      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10">
            <SettingsLayout view={_settingsView} onClose={handleGoHome} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      );
    }

    // Priority 4: Home View
    if (displayHomeView) {
      return (
        <div className="flex-1 min-h-0 h-[70%] w-full">
          <HomeView
            onRequestOpenUrls={handleRequestOpenUrls}
            ref={homeViewRef}
            onQuickCommandSelect={commandId => {
              const localDef = findCommandByAnyId(commands, commandId);
              if (localDef && localDef.surface !== 'website') {
                if (localDef?.behavior === 'instant') {
                  handleCommandExecute(commandId as any);
                  return;
                }
              }
              if (commandId === 'saved-automation') {
                onOpenSpreadsheetMainContainer?.('saved-automation');
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
            }}
            onSnippetSelect={handleHomeSnippetSelect as any}
            onRequestSnippetDelete={handleHomeDeleteRequest as any}
            onRequestLinkEdit={handleHomeLinkEdit as any}
            onHighlightChange={handleInteractiveItemHighlight}
            onRequestFocusSearch={handleRequestFocusSearch}
            onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
            isCommandLocked={!!suggestionState?.lockedCommand}
            isSuggestionVisible={suggestionState?.isVisible}
            inlineNotification={inlineNotification}
            onNavigateToListView={onNavigateToListView}
            isLoggedIn={isLoggedIn}
            onOpenContextMenu={(x, y, fav) => boardViewRef.current?.openContextMenu?.(x, y, fav)}
          />
          <div className="hidden">
            <BoardView
              ref={boardViewRef}
              state={suggestionState}
              unfilteredSuggestions={unfilteredSuggestionsRef.current}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
      );
    }

    if (isEmbedded) {
      return null;
    }

    // Priority 6: Default/Welcome -> Defaults to Home View
    if (
      (suggestionState?.lockedCommand && (suggestionState.lockedCommand as string) !== 'store') ||
      suggestionState?.isAtMenuOpen
    ) {
      return null;
    }

    return (
      <div className="flex-1 min-h-0 h-[70%] w-full">
        <HomeView
          ref={homeViewRef}
          onQuickCommandSelect={commandId => {
            if (commandId === 'todo') {
              useUIStore.getState().setSidebar('todoSidebar', { open: true });
              return;
            }
            if (commandId === 'collections') {
              onOpenSpreadsheetMainContainer?.('collections');
              return;
            }
            if (commandId === 'saved-automation') {
              onOpenSpreadsheetMainContainer?.('saved-automation');
              return;
            }
            searchbarRef.current?.lockCommand(commandId);
            searchbarRef.current?.focus();
          }}
          onSnippetSelect={handleHomeSnippetSelect as any}
          onRequestSnippetDelete={handleHomeDeleteRequest as any}
          onRequestLinkEdit={handleHomeLinkEdit as any}
          onHighlightChange={handleInteractiveItemHighlight}
          onRequestFocusSearch={handleRequestFocusSearch}
          onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
          isCommandLocked={!!suggestionState?.lockedCommand}
          isAtMenuOpen={suggestionState?.isAtMenuOpen}
          isSuggestionVisible={suggestionState?.isVisible}
          onNavigateToListView={onNavigateToListView}
          isLoggedIn={isLoggedIn}
          onOpenContextMenu={(x, y, fav) => boardViewRef.current?.openContextMenu?.(x, y, fav)}
        />
        <div className="hidden">
          <BoardView
            ref={boardViewRef}
            state={suggestionState}
            unfilteredSuggestions={unfilteredSuggestionsRef.current}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    );
  };

  const lastEmittedStateRef = useRef<SuggestionState | null>(null);
  const unfilteredSuggestionsRef = useRef<any[]>([]);

  // Handle suggestion state from Searchbar (like AltS)
  const handleSuggestionStateChange = useCallback(
    (state: SuggestionState | null) => {
      // 1. Check for changes before updating state to avoid render loops
      // We compare critical properties that affect UI rendering.
      const prevState = lastEmittedStateRef.current;
      const hasChanged =
        !prevState ||
        !state ||
        state.isVisible !== prevState.isVisible ||
        state.lockedCommand !== prevState.lockedCommand ||
        state.value !== prevState.value ||
        state.highlightIndex !== prevState.highlightIndex ||
        state.isAtMenuOpen !== prevState.isAtMenuOpen ||
        state.isAutomationActive !== prevState.isAutomationActive ||
        state.selectedAIs?.length !== prevState.selectedAIs?.length ||
        JSON.stringify(state.selectedAIs) !== JSON.stringify(prevState.selectedAIs) ||
        state.activeAiSession?.id !== prevState.activeAiSession?.id ||
        state.activeAiSession?.sessionKey !== prevState.activeAiSession?.sessionKey ||
        state.suggestions?.length !== prevState.suggestions?.length;

      if (hasChanged) {
        if (!state?.value || state.value.trim() === '') {
          if (state?.suggestions && state.suggestions.length > 0) {
            unfilteredSuggestionsRef.current = state.suggestions;
          }
        }
        lastEmittedStateRef.current = state;
        setSuggestionState(state);
      }

      // 2. Proactively notify parent of command lock changes to avoid race conditions in UI
      const nextLocked = (state?.lockedCommand as string | null) || null;
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

      const isAutomationActive = !!state?.isAutomationActive;
      if (isAutomationActive !== prevIsAutomationActiveRef.current) {
        prevIsAutomationActiveRef.current = isAutomationActive;
        onAutomationActiveChange?.(isAutomationActive);
      }
    },
    [onMenuStateChange, onAutomationActiveChange, onLockedCommandChange],
  );

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

  const handleSearchbarFocusChange = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'down') {
        // DefaultContainer handles its own navigation via global keydown listener
        // No need to call focusFirstItem() here - it causes focus to reset to index 0
      } else if (direction === 'up') {
      }
    },
    [displayHomeView],
  );

  // Promise Queue

  const handleCommandExecuteLog = (commandId: string) => {};

  const handleStoreClose = useCallback(() => {
    useUIStore.getState().setView({ type: 'searchSuggestions' });
    // Removed search clear to allow results to persist when closing store
    // setSuggestionState(null);
    // setSearchValue('');
    // searchbarRef.current?.clear();
    setTimeout(() => searchbarRef.current?.focus(), 0);
  }, []);

  const handleToggleFavorite = useCallback(
    async (item: any) => {
      if (!userId) {
        triggerNotification('Please sign in to manage favorites', 'error');
        return;
      }
      try {
        let itemId = '';
        let itemType = 'snippet';

        // Check if it's a command
        const isCommand =
          item.source === 'last_used' ||
          item.id === 'ai' ||
          item.type === 'command' ||
          item._kind === 'command' ||
          item.category === 'command';

        if (isCommand) {
          itemType = 'command';
          itemId = item.id;
        } else {
          // Unwrap the item if it's a wrapper
          const actualItem = item.item || item.snippet || item.session || item.data || item;
          const category = (actualItem.category || item.category || item._kind || item.type || '').toLowerCase();

          if (category === 'link') {
            itemType = 'link';
          } else if (category === 'note') {
            itemType = 'note';
          } else if (category === 'session' || category === 'sessions' || category === 'tabgroup') {
            itemType = 'session';
          } else if (category === 'snippet') {
            itemType = 'snippet';
          } else if (category === 'chat_agent' || category === 'agent') {
            itemType = 'chat_agent';
          } else if (category === 'aiprompt' || category === 'prompt') {
            itemType = 'aiPrompt';
          } else if (category === 'automation') {
            itemType = 'automation';
          } else {
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

        const label =
          item.label ||
          item.snippet?.key ||
          item.snippet?.title ||
          item.snippet?.name ||
          item.key ||
          item.title ||
          item.name ||
          '';

        await toggleFavoriteRecord(userId || 'local_user', itemId, itemType, label);
        triggerNotification('Favorites updated', 'success');
      } catch (error) {
        console.error(error);
        triggerNotification('Failed to update favorites', 'error');
      }
    },
    [userId, triggerNotification],
  );

  const handleLockedCommandChangeInternal = useCallback(
    (cmd: any) => {
      if (cmd === null && activeEditor?.type === 'ai') {
        // When clearing an AI command, close editor and return to home view
        useUIStore.getState().closeEditor();
        useUIStore.getState().setView({ type: 'home' });
      }
      onLockedCommandChange?.(cmd);
    },
    [onLockedCommandChange, activeView?.type, activeEditor?.type],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      propOnQueryChange?.(value);
    },
    [propOnQueryChange],
  );

  const defaultPlaceholder = useMemo(() => {
    return 'Type to search';
  }, []);

  const renderHeader = () => {
    // If in AutomationDashboard, keep header mounted so searchbarRef remains valid, but let CSS hide it.
    const isAiLocked = (suggestionState?.lockedCommand as string) === 'ai';

    return (
      <div className={'flex-shrink-0 relative z-48'}>
        <div className={'flex items-center gap-2'}>
          {/* Left: Search Bar */}
          <div className={'flex-1 min-w-0'}>
            <Searchbar
              ref={searchbarRef}
              savedAiAgents={savedAiAgents}
              hideDynamicIcon={Boolean(
                suggestionState &&
                  (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
                  !suggestionState.isAtMenuOpen &&
                  !suggestionState.isAutomationActive &&
                  suggestionState.lockedCommand !== 'calendar' &&
                  suggestionState.lockedCommand !== 'upload_drive' &&
                  (activeView?.type !== 'allItems' || isStoreLocked) &&
                  !isLinkEditModalOpen,
              )}
              disableContextualPopup={true}
              placeholder={defaultPlaceholder}
              onSuggestionStateChange={handleSuggestionStateChange}
              onLockedCommandChange={handleLockedCommandChangeInternal}
              lockedCommand={
                activeEditor?.type === 'ai' && !suggestionState?.lockedCommand
                  ? 'ai'
                  : suggestionState?.lockedCommand || null
              }
              onSnippetSelect={handleSearchSnippetSelect}
              onAutomationSelect={handleAutomationSelect}
              onAutomationEdit={handleAutomationEdit}
              searchValue={searchValue}
              onQueryChange={handleQueryChange}
              onCommandModeExit={() => {
                if (displayHomeView && homeViewRef.current) {
                  setTimeout(() => {
                    homeViewRef.current?.focusFirstItem();
                  }, 0);
                }
              }}
              onCommandExecute={handleCommandExecute}
              onRequestFocusChange={handleSearchbarFocusChange}
              onClearFolder={handleGoHome}
              onNavigateBack={handleNavigateBack}
              onRequestEditLink={handleHomeLinkEdit}
              onRequestSnippetDelete={handleHomeDeleteRequest as any}
              onToggleFavorite={handleToggleFavorite}
              onSearchbarFocus={onSearchbarFocus}
              isLoggedIn={isLoggedIn}
              onSaveAgent={() => {
                setIsAutomationSavePromptOpen(true);
              }}
              activeStoreTab={storeTab}
              onToggleStoreTab={() => {
                setStoreTab(prev => {
                  const nextTab = prev === 'catalog' ? 'saved' : 'catalog';
                  const nextCmd = nextTab === 'catalog' ? 'store' : 'saved-automation';
                  if (lockedCommand !== nextCmd) {
                    const currentVal = searchbarRef.current?.getValue() || '';
                    searchbarRef.current?.lockCommand(nextCmd, currentVal);
                  }
                  return nextTab;
                });
              }}
              isInitialAltSFocus={isInitialAltSFocus}
              onInitialAltSFocusChange={onInitialAltSFocusChange}
              displayHomeView={displayHomeView}
              onHoverSlashDot={onHoverSlashDot}
            />
          </div>
        </div>
      </div>
    );
  };

  const isEditorExpanded =
    isCreatingEditorView ||
    activeView?.type === 'bulk' ||
    activeEditor?.type === 'agent' ||
    activeEditor?.type === 'note' ||
    activeEditor?.type === 'aiPrompt' ||
    activeEditor?.type === 'todo' ||
    activeView?.type === 'store' ||
    activeView?.type === 'todo' ||
    (suggestionState?.lockedCommand as string) === 'ai';
  const isActuallyExpanded = isEditorExpanded || isLinkEditModalOpen;
  const isOrganizationPanelOpen =
    activeView?.type === 'settings' ||
    activeView?.type === 'sharedFolderCreation' ||
    activeView?.type === 'subscriptions' ||
    activeView?.type === 'manageSubscription' ||
    activeView?.type === 'createFolder' ||
    activeView?.type === 'createWorkspace';
  const isAutomationActive = Boolean(suggestionState?.isAutomationActive);
  const shouldHideMainContent = hideMainContent || isAutomationActive;

  const shouldHideHeader =
    isEmbedded ||
    isSpreadsheetViewOpen ||
    activeEditor?.type === 'session' ||
    activeEditor?.type === 'todo' ||
    activeEditor?.type === 'aiPrompt' ||
    activeView?.type === 'todo' ||
    (isActuallyExpanded &&
      (suggestionState?.lockedCommand as string) !== 'store' &&
      (suggestionState?.lockedCommand as string) !== 'ai' &&
      activeView?.type !== 'store');

  const isFreshAiCommand =
    (activeEditor?.type === 'ai' || (suggestionState?.lockedCommand as string) === 'ai') &&
    !suggestionState?.activeAiSession?.prompt;

  const isQueryBasedLockedCommand = Boolean(
    suggestionState?.lockedCommand &&
      (!isLocalCommandId(commands, suggestionState.lockedCommand) || suggestionState.requiresInlineQuery) &&
      suggestionState.lockedCommand !== 'store' &&
      suggestionState.lockedCommand !== 'ai',
  );

  return (
    <div
      style={
        isNarrowView && !isFocusMode && !isEmbedded && !showSidebarColumn
          ? { transform: 'translateX(-100px)' }
          : undefined
      }
      className={`flex h-full flex-col w-full relative ${
        isFocusMode ||
        isCreatingEditorView ||
        isLinkEditModalOpen ||
        activeView?.type === 'settings' ||
        activeView?.type === 'createFolder' ||
        activeView?.type === 'createWorkspace'
          ? 'max-w-none mx-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
          : false
            ? showSidebarColumn
              ? 'w-full px-10 pt-4 pb-[5px] overflow-hidden'
              : 'w-full pl-72 pr-10 pt-4 pb-[5px] overflow-hidden'
            : isSpreadsheetViewOpen
              ? 'w-full mx-auto pr-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
              : activeEditor?.type === 'agent'
                ? 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
                : isOrganizationPanelOpen && activeView?.type !== 'manageSubscription'
                  ? activeView?.type === 'subscriptions'
                    ? 'max-w-6xl mx-auto pt-[6vh] pb-[5px] min-[1600px]:max-w-7xl w-full h-[90vh] overflow-visible'
                    : 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
                  : activeView?.type === 'todo' && !activeEditor
                    ? 'max-w-4xl mx-auto pt-0 pb-[5px] min-[1600px]:max-w-5xl min-[1800px]:max-w-6xl max-[1480px]:max-w-3xl max-[1370px]:max-w-2xl max-[1270px]:max-w-xl h-full overflow-visible'
                    : activeView?.type === 'store' || activeView?.type === 'manageSubscription'
                      ? `pb-[5px] overflow-visible w-full mx-auto ${showSidebarColumn ? 'max-w-[1800px]' : 'max-w-4xl'} pt-[10vh] ${showSidebarColumn ? 'pl-[8%] pr-[340px]' : ''}`
                      : activeEditor?.type === 'ai' || (suggestionState?.lockedCommand as string) === 'ai'
                        ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[10vh]`
                        : isQueryBasedLockedCommand
                          ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[14vh]`
                          : isNarrowView
                            ? `max-w-[480px] mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] overflow-visible`
                            : `max-w-[1200px] mx-auto pt-0 pb-0 mt-0 h-full px-8 min-[1600px]:max-w-[1400px] overflow-visible`
      }`}>
      {!isOrganizationPanelOpen && !showTutorial && !isCheckingTutorial && (
        <div className={shouldHideHeader ? 'hidden pointer-events-none opacity-0 h-0 overflow-hidden' : ''}>
          {renderHeader()}
        </div>
      )}

      {/* Main Content Area - Hidden when sidebar search is focused or filter panel is open */}
      {!showTutorial &&
      !isCheckingTutorial &&
      ((activeEditor?.type === 'agent' && !isAutomationActive) ||
        activeView?.type === 'todo' ||
        isSpreadsheetViewOpen ||
        !shouldHideMainContent) ? (
        <div
          className={`flex-1 flex flex-col ${isSpreadsheetViewOpen || isOrganizationPanelOpen ? 'overflow-hidden min-h-0' : 'overflow-visible'} ${isActuallyExpanded ? 'mt-0' : 'mt-[-6px] '}`}>
          {renderMainContent()}
        </div>
      ) : null}
      <DeleteDialog
        isOpen={homeDeleteContext.isOpen}
        onClose={handleCloseHomeDeleteDialog}
        onConfirm={handleConfirmHomeDelete}
        title={homeDeleteContext.detail?.commandId === 'delete_link' ? 'Delete Link' : 'Delete Note'}
        description={
          homeDeleteContext.detail
            ? `Do you want to delete "${homeDeleteContext.detail.snippetKey}"?`
            : 'Do you want to delete this item?'
        }
      />

      {/* Save Agent Modal */}
      <AutomationSavePrompt
        isOpen={isAutomationSavePromptOpen}
        onClose={() => setIsAutomationSavePromptOpen(false)}
        selectedAIs={suggestionState?.selectedAIs || []}
        prompt={suggestionState?.value || ''}
        activeAiSession={suggestionState?.activeAiSession}
        onSaveSuccess={(name, id) => searchbarRef.current?.updateActiveSessionMetadata({ name, id })}
      />

      {/* Tutorial Overlay */}
      {showTutorial && !isReturningUser && (
        <OnboardingCards
          onClose={handleCloseTutorial}
          isLoggedIn={isLoggedIn}
          isReturningUser={isReturningUser}
          initialStep={isReturningUser ? 'presentation' : 'quote'}
        />
      )}

      {/* Onboarding Loader - shown during post-login draft processing */}
    </div>
  );
};

export default memo(Container);

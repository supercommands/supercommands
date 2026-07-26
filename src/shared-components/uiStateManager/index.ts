import { create } from 'zustand';
import { MainView, ActiveEditorState, SidebarType, SidebarState, ModalType, ContextualUIType, ContextualUIState, TodoDisplayMode, EditorType } from './types';
import { getStoredTodoDisplayMode, setStoredTodoDisplayMode } from '../../storage/localStorage/uxCustomizationStorage';

export const NONE_TEAM = {
  team_id: 'none',
  team_name: 'None',
  workspaces: [],
};

const shallowEqual = (a: Record<string, any> | null | undefined, b: Record<string, any> | null | undefined) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => Object.is(a[key], b[key]));
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const applyTodoDisplayMode = (mode: TodoDisplayMode) => {
  useUIStore.setState(state => (state.todoDisplayMode === mode ? state : { todoDisplayMode: mode }));
};

interface UIStoreState {
  // --- State ---
  activeView: MainView;
  activeEditor: ActiveEditorState | null;
  activeSidebars: Record<SidebarType, SidebarState>;
  modalStack: ModalType[];
  activeContextualUIs: Record<ContextualUIType, ContextualUIState>;
  selectedWorkspaceId: string | null;
  selectedFolderId: string | null;
  selectedSnippetId: string | null;
  showFavorites: boolean;
  isFocusMode: boolean;
  pendingAutomation: any | null;
  pendingAgent: any | null;
  draftAutomation: {
    capabilityName: string;
    description: string;
    category: string;
  } | null;
  expandedWorkspaces: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;
  isAutoExpandMode: boolean;
  collapsedWorkspaces: Record<string, boolean>;
  collapsedFolders: Record<string, boolean>;
  collapsedSections: string[];
  lockedCommand: string | null;
  pendingLockedCommand: { commandId: string; mode: 'lock' | 'execute' } | null;
  todoDisplayMode: TodoDisplayMode;
  pendingNotification: { message: string; type: string } | null;
  commandStatus: { status: 'idle' | 'loading' | 'success' | 'error'; message: string };
  linkEditPrefill: any | null;
  todoCreatePrefill: any | null;
  highlightedCommandId: string | null;
  os: string;
  todoDraft: { title: string; scheduleType: 'one-time' | 'recurring' | ''; recurringCycle?: string; time?: string; date?: string; isAnytime?: boolean; selectedItem?: any; selectedType?: string; description?: string; };
  snippetBreadcrumb: any | null;
  activeLinkSnippet: any | null;
  selectedSnippet: any | null;
  activeTutorial: string | null;
  isSheetOpen: boolean;
  activeSheetSection: string | null;

  // --- Explicit Actions ---
  setView: (view: MainView) => void;
  openEditor: (editorState: ActiveEditorState) => void;
  closeEditor: () => void;
  openSheet: (section?: string | null) => void;
  closeSheet: () => void;
  openCreateWorkspace: () => void;
  openCreateFolder: () => void;
  openItemEditor: (
    editorType: EditorType,
    id: string,
    options?: {
      isNew?: boolean;
      props?: any;
      linkPrefill?: any;
      openTodoSidebar?: boolean;
    },
  ) => void;
  openCreateItem: (
    editorType: EditorType,
    options?: {
      id?: string;
      isNew?: boolean;
      props?: any;
      linkPrefill?: any;
      openTodoSidebar?: boolean;
    },
  ) => void;
  
  setSidebar: (sidebar: SidebarType, state: Partial<SidebarState>) => void;
  setSelection: (selection: {
    selectedWorkspaceId?: string | null;
    selectedFolderId?: string | null;
    selectedSnippetId?: string | null;
  }) => void;
  setSelectedWorkspaceId: (selectedWorkspaceId: string | null) => void;
  setSelectedFolderId: (selectedFolderId: string | null) => void;
  setSelectedSnippetId: (selectedSnippetId: string | null) => void;
  setSelectedSnippet: (selectedSnippet: any | null) => void;
  setActiveLinkSnippet: (activeLinkSnippet: any | null) => void;
  setActiveTutorial: (activeTutorial: string | null) => void;
  setShowFavorites: (showFavorites: boolean) => void;
  toggleFocusMode: (nextValue?: boolean) => void;
  setPendingAutomation: (pendingAutomation: any | null) => void;
  setPendingAgent: (pendingAgent: any | null) => void;
  setDraftAutomation: (draft: any | null) => void;
  clearDraftAutomation: () => void;
  expandAllWorkspaces: (expandedWorkspaces: Record<string, boolean>) => void;
  expandAllFolders: (expandedFolders: Record<string, boolean>) => void;
  setIsAutoExpandMode: (isAutoExpandMode: boolean) => void;
  setCollapsedWorkspaces: (collapsedWorkspaces: Record<string, boolean>) => void;
  setCollapsedFolders: (collapsedFolders: Record<string, boolean>) => void;
  setCollapsedSections: (collapsedSections: string[]) => void;
  
  pushModal: (modal: ModalType) => void;
  popModal: () => void;
  removeModal: (modal: ModalType) => void;
  clearModals: () => void;

  setContextualUI: (ui: ContextualUIType, state: Partial<ContextualUIState>) => void;
  setLockedCommand: (commandId: string | null) => void;
  setPendingLockedCommand: (cmd: { commandId: string; mode: 'lock' | 'execute' } | null) => void;
  queueNotification: (notification: { message: string; type: string }) => void;
  clearNotification: () => void;
  setCommandStatus: (status: { status: 'idle' | 'loading' | 'success' | 'error'; message: string }) => void;
  resetCommandStatus: () => void;
  setLinkEditPrefill: (prefill: any | null) => void;
  setTodoCreatePrefill: (prefill: any | null) => void;
  setHighlightedCommandId: (id: string | null) => void;
  setOS: (os: string) => void;
  setTodoDraft: (draft: Partial<{ title: string; scheduleType: 'one-time' | 'recurring' | ''; recurringCycle?: string; time?: string; date?: string; isAnytime?: boolean; selectedItem?: any; selectedType?: string; description?: string; }>) => void;
  setSnippetBreadcrumb: (breadcrumb: any | null) => void;
  clearEditorStates: () => void;
  viewSnippet: (payload: { snippet: any; breadcrumb: any }) => void;
  
  editorEscapeHandler: (() => boolean) | null;
  setEditorEscapeHandler: (handler: (() => boolean) | null) => void;

  escapeInterceptors: (() => boolean)[];
  registerEscapeInterceptor: (handler: () => boolean) => () => void;

  handleEscape: () => void;
  setTodoDisplayMode: (mode: TodoDisplayMode) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  activeView: { type: 'home' },
  activeEditor: null,
  activeSidebars: {
    favorites: { open: false },
    todoSidebar: { open: false },
  },
  modalStack: [],
  activeContextualUIs: {
    contextMenu: { open: false },
    searchbarOverlay: { open: false },
    atCommand: { open: false },
    contextualCommand: { open: false },
    inlinePrompt: { open: false },
    aiModelSelection: { open: false },
    automationSkills: { open: false },
    savedAutomations: { open: false },
    createMenu: { open: false },
    shortcutAssign: { open: false },
    toast: { open: false },
  },
  selectedWorkspaceId: null,
  selectedFolderId: null,
  selectedSnippetId: null,
  showFavorites: false,
  isFocusMode: false,
  pendingAutomation: null,
  pendingAgent: null,
  expandedWorkspaces: {},
  expandedFolders: {},
  isAutoExpandMode: false,
  collapsedWorkspaces: {},
  collapsedFolders: {},
  collapsedSections: [],
  lockedCommand: null,
  pendingLockedCommand: null,
  editorEscapeHandler: null,
  escapeInterceptors: [],
  todoDisplayMode: 'collapse',
  highlightedCommandId: null,
  pendingNotification: null,
  commandStatus: { status: 'idle', message: '' },
  linkEditPrefill: null,
  todoCreatePrefill: null,
  todoDraft: { title: '', scheduleType: '' },
  os: 'windows',
  snippetBreadcrumb: null,
  activeLinkSnippet: null,
  selectedSnippet: null,
  activeTutorial: null,
  isSheetOpen: false,
  activeSheetSection: null,
  draftAutomation: null,

  setView: (view) =>
    set(state => (shallowEqual(state.activeView as any, view as any) ? state : { activeView: view })),
  
  openEditor: (editorState) =>
    set(state => {
      const updates: Partial<UIStoreState> = { activeEditor: editorState };
      if (editorState?.type && editorState.type !== 'todo' && state.todoCreatePrefill !== null) {
        updates.todoCreatePrefill = null;
      }
      return updates;
    }),
  closeEditor: () => set(state => {
    console.log('[ESCAPE][closeEditor] called. activeView before:', state.activeView, '| isSheetOpen:', state.isSheetOpen, '| activeEditor:', state.activeEditor);
    const newView = state.activeView.type === 'sheet' ? state.activeView : { type: 'home' };
    console.log('[ESCAPE][closeEditor] -> setting activeView to:', newView);
    const updates: Partial<UIStoreState> = { 
      activeEditor: null, 
      activeView: newView as any
    };
    if (state.todoCreatePrefill !== null) {
      updates.todoCreatePrefill = null;
    }
    return updates;
  }),
  openSheet: (section = null) =>
    set(state => ({
      activeView: state.activeView.type === 'sheet' ? state.activeView : { type: 'sheet' },
      isSheetOpen: true,
      activeSheetSection: section,
    })),
  closeSheet: () =>
    set(state => ({
      activeView: state.activeView.type === 'sheet' ? { type: 'home' } : state.activeView,
      isSheetOpen: false,
      activeSheetSection: null,
    })),
  openCreateWorkspace: () =>
    set({
      activeEditor: null,
      activeView: { type: 'createWorkspace' },
      isSheetOpen: false,
      activeSheetSection: null,
    }),
  openCreateFolder: () =>
    set({
      activeEditor: null,
      activeView: { type: 'createFolder' },
      isSheetOpen: false,
      activeSheetSection: null,
    }),
  openItemEditor: (editorType, id, options) =>
    set(state => {
      const updates: Partial<UIStoreState> = {
        activeEditor: {
          type: editorType,
          id,
          isNew: options?.isNew,
          props: options?.props,
        },
        linkEditPrefill: options?.linkPrefill ?? null,
        activeSidebars: options?.openTodoSidebar
          ? {
              ...state.activeSidebars,
              todoSidebar: { ...state.activeSidebars.todoSidebar, open: true },
            }
          : state.activeSidebars,
      };
      if (editorType !== 'todo' && state.todoCreatePrefill !== null) {
        updates.todoCreatePrefill = null;
      }
      return updates;
    }),
  openCreateItem: (editorType, options) =>
    set(state => {
      const updates: Partial<UIStoreState> = {
        activeEditor: {
          type: editorType,
          id: options?.id ?? 'new',
          isNew: options?.isNew,
          props: options?.props,
        },
        linkEditPrefill: options?.linkPrefill ?? null,
        activeSidebars: options?.openTodoSidebar
          ? {
              ...state.activeSidebars,
              todoSidebar: { ...state.activeSidebars.todoSidebar, open: true },
            }
          : state.activeSidebars,
      };
      if (editorType !== 'todo' && state.todoCreatePrefill !== null) {
        updates.todoCreatePrefill = null;
      }
      return updates;
    }),

  setSidebar: (sidebar, sidebarState) =>
    set(state => {
      const nextSidebarState = { ...state.activeSidebars[sidebar], ...sidebarState };
      if (shallowEqual(state.activeSidebars[sidebar] as any, nextSidebarState as any)) {
        return state;
      }
      return {
        activeSidebars: {
          ...state.activeSidebars,
          [sidebar]: nextSidebarState,
        },
      };
    }),

  setSelection: selection =>
    set(state => {
      const nextSelectedWorkspaceId =
        selection.selectedWorkspaceId !== undefined ? selection.selectedWorkspaceId : state.selectedWorkspaceId;
      const nextSelectedFolderId =
        selection.selectedFolderId !== undefined ? selection.selectedFolderId : state.selectedFolderId;
      const nextSelectedSnippetId =
        selection.selectedSnippetId !== undefined ? selection.selectedSnippetId : state.selectedSnippetId;

      if (
        nextSelectedWorkspaceId === state.selectedWorkspaceId &&
        nextSelectedFolderId === state.selectedFolderId &&
        nextSelectedSnippetId === state.selectedSnippetId
      ) {
        return state;
      }

      return {
        selectedWorkspaceId: nextSelectedWorkspaceId,
        selectedFolderId: nextSelectedFolderId,
        selectedSnippetId: nextSelectedSnippetId,
      };
    }),

  setSelectedWorkspaceId: selectedWorkspaceId =>
    set(state => (state.selectedWorkspaceId === selectedWorkspaceId ? state : { selectedWorkspaceId })),
  setSelectedFolderId: selectedFolderId =>
    set(state => (state.selectedFolderId === selectedFolderId ? state : { selectedFolderId })),
  setSelectedSnippetId: selectedSnippetId =>
    set(state => (state.selectedSnippetId === selectedSnippetId ? state : { selectedSnippetId })),
  setSelectedSnippet: selectedSnippet => set({ selectedSnippet }),
  setActiveLinkSnippet: activeLinkSnippet => set({ activeLinkSnippet }),
  setActiveTutorial: activeTutorial => set({ activeTutorial }),
  setShowFavorites: showFavorites => set(state => (state.showFavorites === showFavorites ? state : { showFavorites })),
  toggleFocusMode: nextValue =>
    set(state => {
      const nextIsFocusMode = nextValue ?? !state.isFocusMode;
      return state.isFocusMode === nextIsFocusMode ? state : { isFocusMode: nextIsFocusMode };
    }),
  setPendingAutomation: pendingAutomation =>
    set(state => (state.pendingAutomation === pendingAutomation ? state : { pendingAutomation })),
  setPendingAgent: pendingAgent => set(state => (state.pendingAgent === pendingAgent ? state : { pendingAgent })),
  setDraftAutomation: draftAutomation => set({ draftAutomation }),
  clearDraftAutomation: () => set({ draftAutomation: null }),
  expandAllWorkspaces: expandedWorkspaces =>
    set(state => (sameJson(state.expandedWorkspaces, expandedWorkspaces) ? state : { expandedWorkspaces })),
  expandAllFolders: expandedFolders =>
    set(state => (sameJson(state.expandedFolders, expandedFolders) ? state : { expandedFolders })),
  setIsAutoExpandMode: isAutoExpandMode =>
    set(state => (state.isAutoExpandMode === isAutoExpandMode ? state : { isAutoExpandMode })),
  setCollapsedWorkspaces: collapsedWorkspaces =>
    set(state => (sameJson(state.collapsedWorkspaces, collapsedWorkspaces) ? state : { collapsedWorkspaces })),
  setCollapsedFolders: collapsedFolders =>
    set(state => (sameJson(state.collapsedFolders, collapsedFolders) ? state : { collapsedFolders })),
  setCollapsedSections: collapsedSections =>
    set(state => (sameJson(state.collapsedSections, collapsedSections) ? state : { collapsedSections })),

  pushModal: (modal) => set((state) => ({
    modalStack: [...state.modalStack, modal]
  })),
  
  popModal: () => set((state) => ({
    modalStack: state.modalStack.slice(0, -1)
  })),
  
  removeModal: (modal) => set((state) => ({
    modalStack: state.modalStack.filter((m) => m !== modal)
  })),
  
  clearModals: () => set({ modalStack: [] }),

  setContextualUI: (ui, uiState) =>
    set(state => {
      const nextUiState = { ...state.activeContextualUIs[ui], ...uiState };
      if (shallowEqual(state.activeContextualUIs[ui] as any, nextUiState as any)) {
        return state;
      }
      return {
        activeContextualUIs: {
          ...state.activeContextualUIs,
          [ui]: nextUiState,
        },
      };
    }),

  setLockedCommand: (commandId) => set({ lockedCommand: commandId }),
  setPendingLockedCommand: pendingLockedCommand =>
    set(state => (shallowEqual(state.pendingLockedCommand as any, pendingLockedCommand as any) ? state : { pendingLockedCommand })),
  
  setHighlightedCommandId: highlightedCommandId =>
    set(state => (state.highlightedCommandId === highlightedCommandId ? state : { highlightedCommandId })),
  
  queueNotification: notification => set({ pendingNotification: notification }),
  clearNotification: () => set({ pendingNotification: null }),
  setCommandStatus: status => set({ commandStatus: status }),
  resetCommandStatus: () => set({ commandStatus: { status: 'idle', message: '' } }),
  setLinkEditPrefill: prefill => set({ linkEditPrefill: prefill }),
  setTodoCreatePrefill: prefill => set({ todoCreatePrefill: prefill }),
  setOS: os => set({ os }),
  setTodoDraft: (draft) => set(state => ({ todoDraft: { ...state.todoDraft, ...draft } })),
  setSnippetBreadcrumb: breadcrumb => set({ snippetBreadcrumb: breadcrumb }),
  clearEditorStates: () => set({ activeEditor: null, todoCreatePrefill: null, linkEditPrefill: null, activeContextualUIs: { ...get().activeContextualUIs, inlinePrompt: { open: false } } }),
  viewSnippet: payload => set({ 
    selectedSnippetId: payload.snippet?.id, 
    snippetBreadcrumb: payload.breadcrumb, 
    activeView: { type: 'sheet' } 
  }),
  
  setEditorEscapeHandler: (handler) => set({ editorEscapeHandler: handler }),

  registerEscapeInterceptor: (handler) => {
    set((state) => ({ escapeInterceptors: [...state.escapeInterceptors, handler] }));
    return () => set((state) => ({ escapeInterceptors: state.escapeInterceptors.filter((h) => h !== handler) }));
  },

  // Hierarchical Escape key closer:
  // Modal -> Context Menu -> Command Palette (Locked Command) -> Inline Prompt -> Editor -> Sidebar
  handleEscape: () => {
    const { modalStack, activeContextualUIs, activeEditor, activeSidebars, lockedCommand, activeView, escapeInterceptors } = get();

    console.log('[ESCAPE][handleEscape] interceptors:', escapeInterceptors.length, '| activeEditor:', activeEditor, '| activeView:', activeView);

    // 0. Check all registered interceptors first (LIFO order, most recent first)
    for (let i = escapeInterceptors.length - 1; i >= 0; i--) {
      const result = escapeInterceptors[i]();
      console.log('[ESCAPE][handleEscape] interceptor[' + i + '] returned:', result);
      if (result) {
        return; // Interceptor handled it
      }
    }

    // 1. Modals
    if (modalStack.length > 0) {
      get().popModal();
      return;
    }
    // 2. Context Menus
    if (activeContextualUIs.contextMenu.open) {
      get().setContextualUI('contextMenu', { open: false });
      return;
    }
    // 3. Command Palette / Search Overlay
    if (activeContextualUIs.searchbarOverlay.open) {
      get().setContextualUI('searchbarOverlay', { open: false });
      return;
    }
    // 4. Inline Prompts
    if (activeContextualUIs.inlinePrompt.open) {
      get().setContextualUI('inlinePrompt', { open: false });
      return;
    }
    // 5. Active Editor
    if (activeEditor) {
      console.log('[ESCAPE][handleEscape] -> step 5: closing activeEditor, isOverlay:', activeEditor?.props?.isOverlay);
      if (get().editorEscapeHandler) {
        const handled = get().editorEscapeHandler!();
        if (handled) {
          return;
        }
      }
      get().closeEditor();
      return;
    }
    // 6. Sidebars
    for (const [type, state] of Object.entries(activeSidebars)) {
      if (state.open) {
        get().setSidebar(type as SidebarType, { open: false });
        return;
      }
    }
    // 7. Locked Command
    if (lockedCommand) {
      get().setLockedCommand(null);
      return;
    }
    // 8. Active View
    if (activeView.type !== 'home') {
      console.log('[ESCAPE][handleEscape] -> step 8: forcing home because activeView is:', activeView);
      get().setView({ type: 'home' });
      return;
    }
  },

  setTodoDisplayMode: (mode) => {
    if (get().todoDisplayMode === mode) return;
    set({ todoDisplayMode: mode });
    setStoredTodoDisplayMode(mode);
  },
}));

// Initialize todoDisplayMode from storage
getStoredTodoDisplayMode().then(mode => {
  applyTodoDisplayMode(mode);
});

try {
  const chromeAny = (window as any).chrome;
  if (chromeAny?.storage?.onChanged) {
    chromeAny.storage.onChanged.addListener((changes: any, namespace: string) => {
      if (namespace === 'local' && changes.todo_display_mode) {
        applyTodoDisplayMode(changes.todo_display_mode.newValue);
      }
    });
  }
} catch (e) {
  // Ignore
}

// --- Custom Selector Hooks ---
export const useIsFullScreenModalOpen = () => useUIStore((s) => s.modalStack.length > 0);
export const useShowTodosView = () => useUIStore((s) => s.activeSidebars.todoSidebar.open);
export const useTodoCreatePrefill = () => useUIStore((s) => s.activeEditor?.type === 'todo' ? s.activeEditor.props?.prefill : null);
export const useIsLinkEditModalOpen = () => useUIStore((s) => s.activeEditor?.type === 'link');

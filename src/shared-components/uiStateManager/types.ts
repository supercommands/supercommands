export type MainView =
  | { type: 'home' }
  | { type: 'board'; boardId?: string }
  | { type: 'sheet'; sheetId?: string }
  | { type: 'todo' }
  | { type: 'tutorial' }
  | { type: 'settings'; section?: 'profile' | 'appearance' | 'searchView' | 'todoSettings' | 'allWorkspaces' | 'workspaceSettings' | 'generalSettings' | 'googleDriveBackup' | 'importCloudData' }
  | { type: 'organization'; orgId?: string; orgName?: string }
  | { type: 'store' }
  | { type: 'subscriptions' }
  | { type: 'manageSubscription' }
  | { type: 'moduleDetail'; moduleId: number }
  | { type: 'bulk' }
  | { type: 'blank'; title?: string; message?: string }
  | { type: 'organizationSettings'; orgId: string; orgName: string }
  | { type: 'createWorkspace' }
  | { type: 'createFolder' }
  | { type: 'workspaceShare'; workspaceId: string }
  | { type: 'workspaceAccess'; workspaceId: string }
  | { type: 'integrationSettings'; integrationId: string }
  | { type: 'searchSuggestions' }
  | { type: 'sharedFolderCreation'; defaultPrivacy?: 'private' | 'shared' | 'public'; targetTeamId?: string }
  | { type: 'allItems'; itemType: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations' };

export type EditorType = 'note' | 'automation' | 'agent' | 'snippet' | 'link' | 'session' | 'ai' | 'todo' | 'aiPrompt';

export interface ActiveEditorState {
  type: EditorType;
  id: string;
  openInstanceId?: number;
  isNew?: boolean;
  readOnly?: boolean;
  props?: any;
}

export type SidebarType = 'favorites' | 'todoSidebar';

export interface SidebarState {
  open: boolean;
  width?: number;
  collapsed?: boolean;
}

export type ModalType =
  | 'createWorkspace'
  | 'createCollection'
  | 'sharedFolderCreation'
  | 'gridQuickAdd'
  | 'onboardingOverlay'
  | 'linkEdit'
  | 'addToExisting'
  | 'editWorkspaceName'
  | 'deleteDialog'
  | 'unsavedChanges'
  | 'inviteMembers'
  | 'saveAgent'
  | 'share'
  | 'publicLinks'
  | 'snippetOptions'
  | 'hotkeysHelp'
  | 'historySuggestions'
  | 'manageSubscription';

export type ContextualUIType =
  | 'contextMenu'      // UnifiedContextMenu / FavoritesContextMenu
  | 'searchbarOverlay' // Searchbar suggestions / lists
  | 'atCommand'        // AtCommandPopup
  | 'contextualCommand'// ContextualCommandPopup
  | 'inlinePrompt'     // InlinePromptPopup
  | 'aiModelSelection' // ModelSelector in ChatAgent
  | 'automationSkills' // AutomationSkillsPanel
  | 'savedAutomations' // SavedAutomationsPanel
  | 'createMenu'       // GlobalCreateMenuModal
  | 'shortcutAssign'   // ShortcutCaptureForm / HotkeyAssignButton
  | 'toast';           // ToastContainer

export interface ContextualUIState {
  open: boolean;
  payload?: any;
}

export type TodoDisplayMode = 'collapse' | 'data-blur' | 'pin';

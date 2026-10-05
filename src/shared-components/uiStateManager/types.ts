export type MainView = {
    type: 'home';
} | {
    type: 'collections';
    organisationId?: string;
    collectionId?: string;
    itemId?: string;
    returnToTimeline?: boolean;
} | {
    type: 'timeline';
} | {
    type: 'board';
    boardId?: string;
} | {
    type: 'knowledgeGraph';
} | {
    type: 'sheet';
    sheetId?: string;
} | {
    type: 'todo';
} | {
    type: 'tutorial';
} | {
    type: 'settings';
    section?: 'usage' | 'appearance' | 'searchView' | 'todoSettings' | 'allOrganisations' | 'organisationSettings' | 'generalSettings' | 'googleDriveBackup';
    backupStatsId?: string;
} | {
    type: 'organization';
    orgId?: string;
    orgName?: string;
} | {
    type: 'store';
} | {
    type: 'moduleDetail';
    moduleId: number;
} | {
    type: 'bulk';
} | {
    type: 'blank';
    title?: string;
    message?: string;
} | {
    type: 'createOrganisation';
} | {
    type: 'integrationSettings';
    integrationId: string;
} | {
    type: 'searchSuggestions';
} | {
    type: 'allItems';
    itemType: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations';
};
export type EditorType = 'note' | 'agent' | 'snippet' | 'link' | 'session' | 'ai' | 'todo' | 'aiPrompt';
export type KnowledgeExplorerMode = 'graph' | 'spreadsheet';
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
export type ModalType = 'createOrganisation' | 'createCollection' | 'gridQuickAdd' | 'onboardingOverlay' | 'linkEdit' | 'addToExisting' | 'editOrganisationName' | 'deleteDialog' | 'unsavedChanges' | 'inviteMembers' | 'saveAgent' | 'share' | 'publicLinks' | 'snippetOptions' | 'hotkeysHelp' | 'historySuggestions';
export type ContextualUIType = 'contextMenu' // UnifiedContextMenu / FavoritesContextMenu
 | 'searchbarOverlay' // Searchbar suggestions / lists
 | 'atCommand' // AtCommandPopup
 | 'contextualCommand' // ContextualCommandPopup
 | 'inlinePrompt' // InlinePromptPopup
 | 'aiModelSelection' // ModelSelector in ChatAgent
 | 'createMenu' // GlobalCreateMenuModal
 | 'shortcutAssign' // ShortcutCaptureForm / HotkeyAssignButton
 | 'toast'; // ToastContainer
export interface ContextualUIState {
    open: boolean;
    payload?: any;
}
export type TodoDisplayMode = 'collapse' | 'data-blur' | 'pin';

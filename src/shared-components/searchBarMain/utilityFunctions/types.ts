import type * as React from 'react';
import type { CommandId, CommandDefinition, AutoSubmitKind } from '../commandConfigurations/commands';
import type { LocalCommandId, LocalCommandDefinition } from '../commandConfigurations/localCommands';
type SavedAutomation = any;
type Folder = any;
import type { WorkspaceItem } from '../../../allObjectFolder/src/createObject/workspaceItemTypes';
import type { InstalledModule } from '../searchLogicAndAlgorithms/searchEngine';

export interface Attachment {
  url: string; // Blob URL for preview
  file: File; // Original file object
  mimeType: string;
  filename: string;
}

export type AnyCommandId = CommandId | LocalCommandId | 'bookmarks' | 'ai';

export type CommandSelectionInfo = {
  id: AnyCommandId;
  label: string;
  prefix: string;
  commandType: 'remote' | 'local' | 'aggregate';
  requiresInlineQuery: boolean;
};

export type WorkspaceItemSuggestion = {
  item: WorkspaceItem;
  workspace: any;
  folder: any | null;
  isPersonal?: boolean;
  teamName?: string;
  _kind?: 'workspace_item'; // For UI disambiguation
};

export type PromptMenuSuggestion =
  | {
    kind: 'prompt';
    prompt: WorkspaceItemSuggestion;
    label: string;
    matchScore?: number;
  }
  | {
    kind: 'automation';
    automation: SavedAutomation;
    label: string;
    matchScore?: number;
  };

export type RemoteCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'remote';
  id: CommandId;
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  command: CommandDefinition;
  description?: string;
};

export type LocalCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'local';
  id: LocalCommandId;
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  command: LocalCommandDefinition;
  description?: string;
};

export type AggregateCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'aggregate';
  id: 'ai';
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  description?: string;
};

export type CommandSuggestionItem =
  | RemoteCommandSuggestionItem
  | LocalCommandSuggestionItem
  | AggregateCommandSuggestionItem;

export type BookmarkSuggestionItem = {
  _kind: 'bookmark';
  id: string;
  title: string;
  url: string;
  commandId?: AnyCommandId;
};

export type CommonCommandSuggestionItem = {
  _kind: 'common_command';
  id: CommandId;
  label: string;
  description: string;
  command: CommandDefinition;
  query: string;
};

export type OpenUrlSuggestionItem = {
  _kind: 'open_url';
  url: string;
  displayUrl: string;
};

export type HistorySuggestionItem = {
  _kind: 'history';
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
  frecencyScore?: number;
  /** If true, this result belongs to the "Other results" section at the bottom */
  isOtherResult?: boolean;
  commandId?: AnyCommandId;
};

export type AgentCollectionSuggestionItem = {
  _kind: 'agent_collection';
  title: string;
  itemCount: number;
};

export type AutomationSuggestionItem = {
  _kind: 'automation';
  automation: SavedAutomation;
};

export type ModuleSuggestionItem = {
  _kind: 'module';
  id: string;
  module: InstalledModule;
};

export type AIChatHistorySuggestionItem = {
  _kind: 'ai_history';
  id: string;
  sessionKey?: string;
  prompt: string;
  models: string[];
  urls: Record<string, string>;
  timestamp: number;
};

export type MathSuggestionItem = {
  _kind: 'math_result';
  query: string;
  result: string;
};

export type TimeSuggestionItem = {
  _kind: 'time_result';
  query: string;
  results: any[];
};

export type SuggestionListItem =
  | CommandSuggestionItem
  | BookmarkSuggestionItem
  | {
    _kind: 'workspace';
    workspace: any;
    action: NonNullable<LocalCommandDefinition['action']>;
  }
  | {
    _kind: 'folder';
    folder: any;
    workspace: any;
    action: NonNullable<LocalCommandDefinition['action']>;
  }
  | {
    _kind: 'folder_search';
    entryType: 'workspace' | 'folder'; // 'workspace' = Folders in UI, 'folder' = Sub-folders in UI
    folder: any | null; // null for workspace entries
    workspace: any;
    fullPath?: string;
  }
  | (WorkspaceItemSuggestion & { _kind: 'workspace_item' })
  | CommonCommandSuggestionItem
  | OpenUrlSuggestionItem
  | HistorySuggestionItem
  | AgentCollectionSuggestionItem
  | AutomationSuggestionItem
  | ModuleSuggestionItem
  | MathSuggestionItem
  | TimeSuggestionItem
  | AIChatHistorySuggestionItem;

export type SuggestionMode = 'command' | 'workspace_item' | 'common' | 'mixed' | 'bookmark' | 'local' | 'history' | null;

export type FooterStatus = {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
} | null;

export interface SuggestionState {
  isVisible: boolean;
  suggestions: SuggestionListItem[];
  highlightIndex: number;
  mode: SuggestionMode;
  value: string;
  lockedCommand: AnyCommandId | null;
  onCommandMouseDown: (event: React.MouseEvent, id: AnyCommandId) => void;
  onHighlightIndexChange: (index: number) => void;
  onLocalSelect?: (item: any) => void;
  onSnippetSelect?: (item: WorkspaceItemSuggestion) => void;
  onAgentCollectionSelect?: (item: AgentCollectionSuggestionItem) => void;
  onAutomationSelect?: (automation: SavedAutomation) => void;
  onAutomationEdit?: (automation: SavedAutomation) => void;
  onModuleSelect?: (module: InstalledModule) => void;
  onAIHistorySelect?: (item: AIChatHistorySuggestionItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onCommonCommandSelect?: (item: CommonCommandSuggestionItem) => void;
  onRequestEditLink?: (item: WorkspaceItemSuggestion) => void;
  onRequestSnippetDelete?: (detail: any) => void;
  onToggleFavorite?: (item: WorkspaceItemSuggestion | CommandSuggestionItem) => void;
  showPromo: boolean;
  footerStatus?: FooterStatus;

  inlineAutocomplete?: string | null;
  onInlineAutocompleteChange?: (text: string | null) => void;
  onFolderMouseDown?: (event: React.MouseEvent, folder: Folder) => void;
  isCommandLocked?: boolean;
  requiresInlineQuery?: boolean;
  isAtMenuOpen?: boolean;
  showEmptySlashDropdown?: boolean;
  onSlashSuggestionSelect?: (actionId: 'ai' | 'collections') => void;
  onDismissSlashDropdown?: (options?: { clearQuery?: boolean; blur?: boolean }) => void;
  isContextualPopupOpen?: boolean;
  selectedImagesCount: number;
  showAIHistoryPanel?: boolean;
  onAIHistoryPanelToggle?: (show: boolean) => void;
  aiHistory?: AIChatHistorySuggestionItem[];
  isBackspacing?: boolean;
  isAutomationActive?: boolean;
  selectedAIs?: string[];
  onToggleAI?: (aiId: string) => void;
  activeAiSession?: {
    id: string | number;
    sessionKey: string;
    prompt: string;
    rules?: string;
    name?: string;
    models: string[];
    tabIds: number[];
    urls: string[];
    workspace_id?: string | null;
    folder_id?: string | null;
    customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
  } | null;
  selectedAutomation?: SavedAutomation | null;
  updateActiveSessionMetadata?: (metadata: {
    name?: string;
    id?: string | number;
    customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
  }) => void;
  onUpdateModelUrl?: (modelId: string, url: string) => void;
  onUpdateCustomModels?: (models: { id: string; name: string; url: string; host: string }[]) => void;
  selectedImages?: Attachment[];
  onRemoveAttachment?: (index: number) => void;
  onQueryChange?: (val: string) => void;
  isAIHistoryOpen?: boolean;
  onToggleAIHistory?: () => void;
}

export interface SearchbarProps {
  isEmbedded?: boolean;
  contextUrl?: string;
  containerClassName?: string;
  inputWrapperClassName?: string;
  onSuggestionStateChange?: (state: SuggestionState | null) => void;
  onCommandExecute?: (
    commandId: CommandId | LocalCommandId | 'ai',
    options?: { prompt?: string; files?: { base64: string; filename: string }[] },
  ) => void;
  onSnippetSelect?: (item: WorkspaceItemSuggestion) => void;
  onAutomationSelect?: (automation: any) => void;
  onAutomationEdit?: (automation: any) => void;
  onRequestAutomationEdit?: (automation: any) => void;
  onQueryChange?: (value: string) => void;
  focus?: boolean;
  onRequestFocusChange?: (direction: 'up' | 'down') => void;
  onCommandModeExit?: () => void;
  onClearFolder?: () => void;
  onNavigateBack?: () => void;

  onRequestEditLink?: (item: WorkspaceItemSuggestion) => void;
  onRequestSnippetDelete?: (detail: any) => void;
  onToggleFavorite?: (item: WorkspaceItemSuggestion | CommandSuggestionItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  placeholder?: string;

  onSearchbarFocus?: (isUserInitiated: boolean) => void; // Called when searchbar input gains focus
  searchValue?: string; // Optional controlled value to force clear/update
  isLoggedIn?: boolean;
  onLockedCommandChange?: (commandId: AnyCommandId | null) => void;
  isInitialAltSFocus?: boolean;
  onInitialAltSFocusChange?: (val: boolean) => void;
  lockedCommand?: AnyCommandId | null;
  onSaveAgent?: () => void;
  activeStoreTab?: 'catalog' | 'saved';
  onToggleStoreTab?: () => void;
  isAIHistoryOpen?: boolean;
  onToggleAIHistory?: () => void;
  savedAiAgents?: any[];
  hideDynamicIcon?: boolean;
  disableContextualPopup?: boolean;
  displayHomeView?: boolean;
  onHoverSlashDot?: () => void;
}

export interface SearchbarHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  setSuggestionsHidden: (hidden: boolean) => void;
  getValue: () => string;
  setValue: (val: string) => void;
  lockCommand: (commandId: AnyCommandId | null, initialValue?: string) => void;
  previewCommand: (commandId: AnyCommandId) => void;
  processCommand: (commandId: AnyCommandId) => void;
  clearCommandPreview: () => void;
  executeCommand: (commandId: AnyCommandId, options?: { mode?: 'execute' | 'lock' }) => void;
  requestPreviewRestore: () => void;
  isLocked: boolean;
  openUrls: (urls: string[], title?: string, forceNewTab?: boolean) => void;
  activateAutomation: (automation: SavedAutomation) => void;

  submitAI: (prompt: string) => void;
  triggerFileUpload: () => void;
  selectSavedAgent: (agent: any) => void;
  newAiChat: () => void;
  updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => void;
  executeSnippet: (snippet: any, forceNewTab?: boolean) => void;
}

export type AutoSubmitRequest = {
  id?: string;
  kind: AutoSubmitKind;
  prompt: string;
  images?: {
    base64: string;
    mimeType: string;
    filename: string;
  }[];
};

export type LinkToOpen = string | { url: string; autoSubmit?: AutoSubmitRequest };


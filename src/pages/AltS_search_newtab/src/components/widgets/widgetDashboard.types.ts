export type WidgetSizePreset = 'small' | 'medium' | 'large';

export type WidgetExpansionMode = 'preset' | 'horizontal' | 'vertical' | 'free';
export type CollectionOpenBehavior = 'same_window' | 'focus_mode' | 'new_window' | 'respect_session';

export interface CollectionLaunchSettings {
  openBehavior: CollectionOpenBehavior;
}

export type WidgetType =
  | 'default-commands'
  | 'note-item'
  | 'note-library'
  | 'session-item'
  | 'link-item'
  | 'link-library'
  | 'ai-prompt-library'
  | 'snippet-library'
  | 'time'
  | 'news'
  | 'weather'
  | 'favorites'
  | 'todo-list'
  | 'quote-of-the-day'
  | 'daily-quote'
  | 'html'
  | 'generic';

export interface LinkLibraryWidgetSettings {
  sourceMode: 'manual' | 'all' | 'tags';
  selectedCollectionIds: string[];
  selectedTagIds: string[];
  tagMatchMode: 'any' | 'all';
  sortBy: 'saved-order' | 'title' | 'recent';
  enableSearch?: boolean;
}

export interface AiPromptLibraryWidgetSettings {
  sourceMode: 'manual' | 'all' | 'tags';
  selectedPromptIds: string[];
  selectedTagIds: string[];
  tagMatchMode: 'any' | 'all';
  sortBy: 'saved-order' | 'title' | 'recent';
  enableSearch?: boolean;
}

export interface SnippetLibraryWidgetSettings {
  sourceMode: 'manual' | 'all' | 'tags';
  selectedSnippetIds: string[];
  selectedTagIds: string[];
  tagMatchMode: 'any' | 'all';
  sortBy: 'saved-order' | 'title' | 'recent';
  enableSearch?: boolean;
}

export interface NoteLibraryWidgetSettings {
  sourceMode: 'manual' | 'all' | 'tags';
  selectedNoteIds: string[];
  selectedTagIds: string[];
  tagMatchMode: 'any' | 'all';
  sortBy: 'saved-order' | 'title' | 'recent';
  enableSearch?: boolean;
}

export interface TimeWidgetSettings {
  selectedTimeZoneIds: string[];
}


export interface WidgetCustomSize {
  w: number;
  h: number;
}

export interface WidgetInstance {
  id: string;
  viewId: string;
  categoryId?: string;
  title: string;
  type?: WidgetType;
  noteId?: string;
  noteTitle?: string;
  noteBody?: string;
  sessionId?: string;
  sessionTitle?: string;
  linkId?: string;
  referenceType?: string;
  referenceId?: string;
  settings?: Record<string, unknown>;
  sizePreset: WidgetSizePreset;
  expansionMode: WidgetExpansionMode;
  customSize?: WidgetCustomSize;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetGridPosition {
  i: string;
  viewId: string;
  categoryId?: string;
  /** Backward-compatibility field retained to read and downgrade previously stored grid-v2 records. */
  gridVersion?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
}

export interface WidgetDashboardView {
  id: string;
  title: string;
  isDefault?: boolean;
  collectionLaunchSettings?: CollectionLaunchSettings;
  settings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetDashboardState {
  schemaVersion: 2;
  revision: number;
  activeViewId: string;
  views: WidgetDashboardView[];
  widgets: WidgetInstance[];
  layout: WidgetGridPosition[];
  updatedAt: number;
}

export type BaseRowData = {
  id: string;
  name: string;
  url: string;
  folder: string;
  fav: boolean;
  key: string;
  command: string;
  section: string;
  path?: string;
  plainPath?: string;
  isReal?: boolean;
  visibilityType?: 'lock' | 'globe' | 'users' | 'personal';
  workspace_id?: string | null;
  folder_id?: string | null;
  favourite_id?: string | number;
  syncStatus?: 'idle' | 'syncing' | 'saved' | 'deleting';
  syncMessage?: string;
  favAction?: 'adding' | 'removing';
  editAction?: 'hotkey' | 'command' | 'name' | 'value' | 'location' | 'automation';
  itemType?: 'link' | 'note' | 'snippet' | 'agent' | 'session' | 'todo';
  category?: string;
  urls?: string[];
  value?: string;  updated_at?: string;
  automationData?: any;
  installation_id?: string | number;
  module_id?: string | number;
  module_uuid?: string;
  module_internal_id?: string;
  module_key?: string;
  snippet_id?: string;
  icon_host?: string;
  isDeleting?: boolean;
  deleteTimer?: any;
  // Todo-related fields
  event_deadline?: string;
  is_done?: boolean;
  is_recurring?: boolean;
  recurring_cycle?: string | null;
  reminder?: string;
};

export type RowData = BaseRowData & {
  type: 'data';
};

export type SectionRow = {
  type: 'section';
  title: string;
};

export type AutomationCategoryRow = {
  type: 'automationCategory';
  id: string;
  name: string;
  iconHost?: string;
  moduleCount: number;
  section: string;
};

export type AutomationModuleRow = BaseRowData & {
  type: 'automationModule';
  parentId: string;
};

export type EmptySectionsToggleRow = {
  type: 'emptySectionsToggle';
  count: number;
};

export type GridRow =
  | RowData
  | SectionRow
  | { type: 'add_row'; section: string }
  | AutomationCategoryRow
  | AutomationModuleRow
  | EmptySectionsToggleRow;

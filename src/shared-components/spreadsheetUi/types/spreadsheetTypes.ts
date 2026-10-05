export type BaseRowData = {
    id: string;
    name: string;
    url: string;
    fav: boolean;
    key: string;
    command: string;
    section: string;
    path?: string;
    plainPath?: string;
    isReal?: boolean;
    visibilityType?: 'lock' | 'globe' | 'users' | 'personal';
    organisation_id?: string | null;
    favourite_id?: string | number;
    syncStatus?: 'idle' | 'syncing' | 'saved' | 'deleting';
    syncMessage?: string;
    favAction?: 'adding' | 'removing';
    editAction?: 'hotkey' | 'command' | 'name' | 'value' | 'location' | 'automation';
    itemType?: 'link' | 'note' | 'snippet' | 'agent' | 'chat_agent' | 'aiPrompt' | 'aiprompt' | 'session' | 'todo' | 'command' | 'prefix_command' | 'bookmark';
    category?: string;
    urls?: string[];
    value?: string;
    description?: string;
    updated_at?: string;
    automationData?: any;
    originalItem?: any;
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
export type EmptySectionsToggleRow = {
    type: 'emptySectionsToggle';
    count: number;
};
export type GridRow = RowData | SectionRow | {
    type: 'add_row';
    section: string;
} | EmptySectionsToggleRow;

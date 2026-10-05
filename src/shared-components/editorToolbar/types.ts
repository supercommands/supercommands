import type { TagUpdateInput } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import type * as React from 'react';
import type { ShortcutAssignmentApproval } from '../shortcuts/core/shortcutAssignmentTypes';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import type { OrganisationData } from '../../settings/allOrganisationManager/organisations/organisationTypes';
export interface SharedProperties {
    // Favorites
    isFav: boolean;
    // Hotkeys & Shortcuts
    pendingHotkey: string;
    pendingShortcut: string;
    textCommandApproval?: ShortcutAssignmentApproval;
    // Tags
    selectedTags: TagRecord[];
    availableTags: TagRecord[];
    // Todo / Reminder / Schedule
    reminderDate: string;
    reminderTime: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    // Location / Workspace picking
    organisationId: string | null;
    // Link & Reference
    url?: string;
    references?: any[];
}
export interface SharedPropertiesToolbarProps {
    /**
     * The initially loaded object (note, link) from which we initialize our state.
     */
    initialSnippet?: any;
    /**
     * An explicit, fully-typed current snapshot of the entity being edited.
     * When provided, this is used as-is for version history comparison (right side / current side).
     * Preferred over deriving the current snapshot from initialSnippet.
     * Editors that haven't migrated yet can omit this and the existing fallback applies.
     */
    currentSnapshot?: any;
    setNoteVersionIndex?: React.Dispatch<React.SetStateAction<number>>;
    selectedNoteVersionIndex?: number;
    versionHistoryItems?: Array<{
        id: string;
        label: string;
        savedAt?: number;
        isCurrent?: boolean;
    }>;
    selectedVersionId?: string | null;
    onSelectVersion?: (versionId: string | null) => void;
    versionHistory?: any;
    entityType?: 'note' | 'todo' | 'snippet' | 'link' | 'session' | string;
    /**
     * Unique ID string for identifying this item across the app (used by hotkeys).
     */
    compoundId: string;
    /**
     * Default name to fallback to if the snippet doesn't have a name.
     */
    defaultName: string;
    /**
     * Fired whenever ANY of the shared properties change.
     * The parent should capture this state to include in its save payload.
     */
    onChange?: (properties: Partial<SharedProperties>) => void;
    // --- Configuration toggles & external data ---
    showTodo?: boolean;
    todoStatus?: 'idle' | 'creating' | 'success';
    onCreateTodo?: (deadlineVal: string, isRecurring: boolean, recurringCycle: string) => void;
    snippetBreadCrum?: any;
    saveStatus?: string;
    // Organization data for location picker and tag picker
    orgTags?: TagRecord[];
    setOrgTags?: React.Dispatch<React.SetStateAction<TagRecord[]>>;
    /** When true, popups fly LEFT (into the container) instead of right. Use for right-side toolbars with no space on the right. */
    openPopupsToLeft?: boolean;
    /** When true, popups fly DOWN instead of to the side. Used for horizontal layouts. */
    openPopupsToBottom?: boolean;
    showShortcut?: boolean;
    showLocationPicker?: boolean;
    /** Controls if the buttons are stacked vertically (default) or horizontally inline. */
    layout?: 'vertical' | 'horizontal';
    showDocsButton?: boolean;
    reserveTopRightChromeSpace?: boolean;
    activeNoteId?: string | null;
    /**
     * Optional visual scope for editors rendered inside another surface such as Alt+S.
     * Portal popups must receive these tokens because they render under document.body.
     */
    appearanceScope?: 'default' | 'alts';
    appearanceTokens?: React.CSSProperties;
    propertyPersistenceAdapter?: {
        saveHotkey?: (args: {
            id: string;
            referenceId: string;
            hotkey: string;
            type: string;
        }) => Promise<void>;
        clearHotkey?: (args: {
            id: string;
            referenceId: string;
            type: string;
        }) => Promise<void>;
        saveShortcut?: (args: {
            id: string;
            referenceId: string;
            shortcut: string;
            label: string;
            type: string;
            approval?: import('../shortcuts/core/shortcutAssignmentTypes').ShortcutAssignmentApproval;
        }) => Promise<void>;
        clearShortcut?: (args: {
            id: string;
            referenceId: string;
            type: string;
        }) => Promise<void>;
        addFavorite?: (args: {
            referenceId: string;
            referenceType: string;
            label: string;
        }) => Promise<void>;
        removeFavorite?: (args: {
            referenceId: string;
        }) => Promise<void>;
        createTag?: (args: {
            name: string;
            workspaceId?: string | null;
        }) => Promise<TagRecord>;
        updateTag?: (args: {
            tagId: string;
            updates: TagUpdateInput;
        }) => Promise<TagRecord>;
        deleteTag?: (args: {
            tagId: string;
        }) => Promise<void>;
        createTodo?: (args: {
            title: string;
            references: Array<{
                type: string;
                id: string;
                name: string;
            }>;
            scheduleType: string;
            scheduleTime: number;
            recurringCycle?: string;
            description?: string;
            tagIds?: string[];
            shortcut?: string;
            organisationId?: string | null;
        }) => Promise<any>;
    };
    externalTagPickerRequest?: {
        id: number;
        query: string;
        position?: {
            x: number;
            y: number;
        } | null;
    } | null;
    onExternalTagQueryChange?: (query: string) => void;
    onExternalTagSelected?: (tag: TagRecord) => void;
    onExternalTagPickerClose?: () => void;
}

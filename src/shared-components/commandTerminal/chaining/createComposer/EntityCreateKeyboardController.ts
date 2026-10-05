import type * as React from 'react';
import { buildCreateComposerLayout, moveCreateComposerSelectedIndex, resolveCreateComposerKeyAction, } from './CreateComposerModel';
import type { CreateComposerValidationState } from './CreateComposerTypes';
import type { TodoComposerFavoriteOption } from '../todoComposerModel';
export type SharedCreateComposerPropertyKey = 'tag' | 'hotkey' | 'shortcut' | 'favorite';
export type SpotlightBackspaceDecision = 'native-input' | 'remove-last-selected-item' | 'remove-active-field' | 'remove-command-token' | 'close-composer';
export type SpotlightBackspaceInput = {
    childPopupOpen: boolean;
    childQuery: string;
    selectedItemCount: number;
    activeField: boolean;
    activeFieldValue: string;
    atCommandStart: boolean;
};
/**
 * Centralizes Backspace ownership for Spotlight and the existing composers.
 * The caller performs the returned operation; this function only decides who
 * owns the event so native text editing is never mixed with token removal.
 */
export const resolveSpotlightBackspaceDecision = (input: SpotlightBackspaceInput): SpotlightBackspaceDecision => {
    if (input.childPopupOpen && input.childQuery.trim())
        return 'native-input';
    if (input.childPopupOpen && input.selectedItemCount > 0)
        return 'remove-last-selected-item';
    if (input.activeField && !input.activeFieldValue.trim())
        return 'remove-active-field';
    if (input.atCommandStart)
        return 'remove-command-token';
    return 'native-input';
};
export type SharedCreateComposerTagRow = {
    id?: string;
    name?: string;
};
type CreateComposerKeyEventLike = Pick<React.KeyboardEvent<HTMLElement>, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'preventDefault'> & {
    stopPropagation?: () => void;
};
export type CreateComposerActiveModeLifecycleConfig<Mode extends string> = {
    activeMode: Mode | null;
    shouldAllowNativeSpace?: (mode: Mode) => boolean;
    shouldAllowNativeBackspace?: (mode: Mode) => boolean;
    onCancel: (mode: Mode) => void;
    onRemove: (mode: Mode) => void;
    onCommit: (mode: Mode, options?: {
        appendDash?: boolean;
    }) => void;
};
/**
 * Text properties are edited as text. Collection properties provide their own
 * Backspace behavior and single-choice properties are cleared as a unit.
 */
export const shouldAllowNativeCreateComposerTextBackspace = (mode: string | null | undefined, value: unknown) => (mode === 'hotkey' || mode === 'shortcut') && String(value ?? '').length > 0;
/** A displayed collection with no unfinished token is edited one item at a time. */
export const isCommittedCreateComposerSelection = (value: string, selectedLabels: readonly string[]) => {
    if (selectedLabels.length === 0)
        return false;
    const tokens = value.split(',').map(token => token.trim()).filter(Boolean);
    // Bare trailing text (including after earlier selections) is a query. A
    // selected tag list ends with a comma while the picker remains open.
    if (!value.trimEnd().endsWith(','))
        return false;
    return tokens.length === selectedLabels.length && tokens.every((token, index) => token.toLocaleLowerCase() === String(selectedLabels[index] || '').trim().toLocaleLowerCase());
};
export const handleCreateComposerActiveModeLifecycleKey = <Mode extends string>(event: CreateComposerKeyEventLike, config: CreateComposerActiveModeLifecycleConfig<Mode>) => {
    const activeMode = config.activeMode;
    if (!activeMode)
        return false;
    if (!['Escape', 'Backspace', ' ', '-'].includes(event.key))
        return false;
    const hasModifier = Boolean(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
    if (hasModifier)
        return false;
    if (event.key === ' ' && config.shouldAllowNativeSpace?.(activeMode))
        return false;
    if (event.key === 'Backspace' && config.shouldAllowNativeBackspace?.(activeMode))
        return false;
    event.preventDefault();
    event.stopPropagation?.();
    if (event.key === 'Escape') {
        config.onCancel(activeMode);
        return true;
    }
    if (event.key === 'Backspace') {
        config.onRemove(activeMode);
        return true;
    }
    if (event.key === '-') {
        config.onCommit(activeMode, { appendDash: true });
        return true;
    }
    if (event.key === ' ') {
        config.onCommit(activeMode);
        return true;
    }
    return false;
};
export type CreateComposerMultiSelectKeyResult = true | false | 'allow-native';
export type CreateComposerMultiSelectKeyConfig = {
    rowCount: number;
    availableRowCount?: number;
    selectedIndex: number;
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
    query: string;
    allowSpaceInQuery?: boolean;
    selectedItemCount?: number;
    hasCreateRow?: boolean;
    commitOnSingleToggle?: boolean;
    isSelectedRow?: (index: number) => boolean;
    onToggle: (index: number, options?: {
        commit?: boolean;
    }) => void;
    onCreate?: () => void | Promise<void>;
    onRemoveLastItem?: () => void;
    onCommit: (options?: {
        appendDash?: boolean;
    }) => void;
    onCancel: () => void;
    onRemove: () => void;
};
/**
 * A multi-select with one selectable result has no second choice to preserve.
 * Enter should therefore select, write, and leave that submode just like a
 * single-choice field. A synthetic "create" row is not a selectable result.
 */
export const shouldCommitSingleCreateComposerSelection = ({ rowCount, hasCreateRow = false, availableRowCount, }: {
    rowCount: number;
    hasCreateRow?: boolean;
    availableRowCount?: number;
}) => (availableRowCount ?? Math.max(0, rowCount - (hasCreateRow ? 1 : 0))) === 1;
export const handleCreateComposerMultiSelectKeyDown = (event: CreateComposerKeyEventLike, config: CreateComposerMultiSelectKeyConfig): CreateComposerMultiSelectKeyResult => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', '-', 'Escape', 'Backspace'].includes(event.key))
        return false;
    const hasModifier = Boolean(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
    if (hasModifier)
        return false;
    if (event.key === ' ' && config.allowSpaceInQuery && config.query.trim().length > 0) {
        return 'allow-native';
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const total = Math.max(1, config.rowCount);
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        config.setSelectedIndex(prev => {
            const next = prev + offset;
            if (next < 0)
                return total - 1;
            if (next >= total)
                return 0;
            return next;
        });
        return true;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        const index = Math.max(0, Math.min(config.selectedIndex, Math.max(0, config.rowCount - 1)));
        const selectableRowCount = config.hasCreateRow ? Math.max(0, config.rowCount - 1) : config.rowCount;
        if (index < selectableRowCount) {
            config.onToggle(index, {
                commit: Boolean(config.commitOnSingleToggle &&
                    !config.isSelectedRow?.(index) && shouldCommitSingleCreateComposerSelection(config)),
            });
            return true;
        }
        if (config.hasCreateRow && config.query.trim()) {
            void config.onCreate?.();
        }
        return true;
    }
    if (event.key === '-') {
        event.preventDefault();
        config.onCommit({ appendDash: true });
        return true;
    }
    if (event.key === ' ') {
        event.preventDefault();
        config.onCommit();
        return true;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        config.onCancel();
        return true;
    }
    if (event.key === 'Backspace' && config.query.trim().length === 0) {
        event.preventDefault();
        const decision = resolveSpotlightBackspaceDecision({
            childPopupOpen: true,
            childQuery: config.query,
            selectedItemCount: config.selectedItemCount || 0,
            activeField: true,
            activeFieldValue: '',
            atCommandStart: false,
        });
        if (decision === 'remove-last-selected-item') {
            config.onRemoveLastItem?.();
            return true;
        }
        config.onRemove();
        return true;
    }
    return false;
};
export type SharedCreateComposerNavigationConfig = {
    selectedIndex: number;
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
    propertyKeys: SharedCreateComposerPropertyKey[];
    showTagRows: boolean;
    showShortcutRows: boolean;
    showFavoriteRows: boolean;
    tagRows: readonly SharedCreateComposerTagRow[];
    tagQuery: string;
    parsedFields: {
        tagNames?: string[];
        [key: string]: unknown;
    };
    requiredFields?: readonly ('title' | 'description' | 'url')[];
    activeRequiredField?: 'title' | 'description' | 'url' | null;
    activePropertyField?: SharedCreateComposerPropertyKey | null;
    favoriteOptions: readonly TodoComposerFavoriteOption[];
    focusRequiredField: (field: 'title' | 'description' | 'url') => void;
    activateProperty: (field: SharedCreateComposerPropertyKey) => void;
    cancelProperty: (field: SharedCreateComposerPropertyKey) => void;
    commitProperty: (field: SharedCreateComposerPropertyKey, options?: {
        appendDash?: boolean;
    }) => void;
    removeProperty: (field: SharedCreateComposerPropertyKey) => void;
    toggleTag: (tag: SharedCreateComposerTagRow, options?: {
        commit?: boolean;
    }) => void;
    createTag: () => void | Promise<void>;
    writeTagNames: (tagNames: string[], options: {
        trailingText?: string;
        trailingSpace?: boolean;
        keepTagModeOpen?: boolean;
    }) => void;
    allowSpaceInTagQuery?: boolean;
    addFavorite: () => void;
    removeFavorite: () => void;
    shortcutValidationState: CreateComposerValidationState;
    approveShortcutOverwrite: () => void;
};
export const handleSharedCreateComposerNavigationKeyDown = (event: Pick<React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'preventDefault'>, config: SharedCreateComposerNavigationConfig) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', '-', 'Escape', 'Backspace'].includes(event.key))
        return false;
    const activeProperty = config.showTagRows ? 'tag'
        : config.showFavoriteRows ? 'favorite'
            : config.showShortcutRows ? 'shortcut'
                : null;
    if (handleCreateComposerActiveModeLifecycleKey(event, {
        activeMode: activeProperty === 'tag' ? null : activeProperty,
        shouldAllowNativeBackspace: property => shouldAllowNativeCreateComposerTextBackspace(property, config.parsedFields.shortcut),
        onCancel: property => config.cancelProperty(property),
        onRemove: property => config.removeProperty(property),
        onCommit: (property, options) => {
            config.commitProperty(property, options);
        },
    })) {
        return true;
    }
    const tagRowCount = config.showTagRows
        ? config.tagRows.length + (config.tagQuery ? 1 : 0)
        : 0;
    const favoriteRowCount = config.showFavoriteRows ? config.favoriteOptions.length : 0;
    const shortcutRowCount = config.showShortcutRows ? 1 : 0;
    const favoriteRowOffset = tagRowCount;
    const shortcutRowOffset = favoriteRowOffset + favoriteRowCount;
    const requiredFields = config.requiredFields || ['title', 'description'];
    const activeRequiredField = config.activeRequiredField && requiredFields.includes(config.activeRequiredField)
        ? config.activeRequiredField
        : null;
    const getRequiredValue = (field: 'title' | 'description' | 'url') => {
        if (field === 'url' && Array.isArray(config.parsedFields.urls)) {
            return config.parsedFields.urls.length > 0 ? config.parsedFields.urls.join(', ') : '';
        }
        return config.parsedFields[field];
    };
    const nextMissingRequiredField = requiredFields.find(field => String(getRequiredValue(field) ?? '').trim().length === 0);
    const visiblePropertyKeys = !activeProperty && config.activePropertyField
        ? [config.activePropertyField]
        : [];
    const visibleRequiredFields = visiblePropertyKeys.length > 0
        ? []
        : activeRequiredField
            ? [activeRequiredField]
            : nextMissingRequiredField
                ? [nextMissingRequiredField]
                : [];
    const layout = buildCreateComposerLayout({
        expandedRowCount: tagRowCount + favoriteRowCount + shortcutRowCount,
        requiredFieldCount: visibleRequiredFields.length,
        propertyCount: visiblePropertyKeys.length,
    });
    const selectedIndex = layout.totalRowCount > 0
        ? Math.max(0, Math.min(config.selectedIndex, layout.totalRowCount - 1))
        : 0;
    if (config.showTagRows) {
        const tagKeyResult = handleCreateComposerMultiSelectKeyDown(event, {
            rowCount: tagRowCount,
            selectedIndex,
            setSelectedIndex: config.setSelectedIndex,
            query: config.tagQuery,
            allowSpaceInQuery: config.allowSpaceInTagQuery,
            selectedItemCount: config.parsedFields.tagNames?.length || 0,
            hasCreateRow: Boolean(config.tagQuery),
            availableRowCount: config.tagRows.filter(tag => !(config.parsedFields.tagNames || []).some(name => name.trim().toLocaleLowerCase() === String(tag.name || '').trim().toLocaleLowerCase())).length,
            commitOnSingleToggle: true,
            isSelectedRow: index => (config.parsedFields.tagNames || []).some(name => name.trim().toLocaleLowerCase() === String(config.tagRows[index]?.name || '').trim().toLocaleLowerCase()),
            onToggle: (index, options) => {
                const tag = config.tagRows[index];
                if (tag)
                    config.toggleTag(tag, options);
            },
            onCreate: config.createTag,
            onRemoveLastItem: () => {
                const tagNames = config.parsedFields.tagNames || [];
                config.writeTagNames(tagNames.slice(0, -1), { keepTagModeOpen: true });
            },
            onCommit: options => {
                config.writeTagNames(config.parsedFields.tagNames || [], options?.appendDash ? { trailingText: '-' } : {});
            },
            onCancel: () => config.cancelProperty('tag'),
            onRemove: () => config.removeProperty('tag'),
        });
        if (tagKeyResult === 'allow-native')
            return false;
        if (tagKeyResult)
            return true;
    }
    const action = resolveCreateComposerKeyAction({
        input: event,
        layout,
        selectedIndex,
        propertyKeys: config.propertyKeys,
        hasExpandedRows: Boolean(activeProperty),
        activeProperty,
    });
    if (action.kind === 'none')
        return false;
    event.preventDefault();
    if (action.kind === 'move') {
        config.setSelectedIndex(prev => moveCreateComposerSelectedIndex(prev, action.offset, layout.totalRowCount));
        return true;
    }
    if (action.kind === 'activate-expanded') {
        if (config.showFavoriteRows && action.index >= favoriteRowOffset && action.index < favoriteRowOffset + favoriteRowCount) {
            const option = config.favoriteOptions[action.index - favoriteRowOffset];
            if (option?.id === 'add') {
                if (option.checked)
                    config.removeFavorite();
                else
                    config.addFavorite();
            }
            return true;
        }
        if (config.showShortcutRows && action.index === shortcutRowOffset) {
            if (config.shortcutValidationState.status === 'conflict' && config.shortcutValidationState.canOverwrite) {
                config.approveShortcutOverwrite();
            }
            else {
                config.commitProperty('shortcut');
            }
            return true;
        }
        return true;
    }
    if (action.kind === 'activate-required') {
        config.focusRequiredField(visibleRequiredFields[action.index] || action.field);
        return true;
    }
    if (action.kind === 'activate-property') {
        config.activateProperty(action.property);
        return true;
    }
    return true;
};

import type { CreateComposerPropertyKey } from './entityCreateFieldsRegistry';
/**
 * Todo-specific expanded-row layout math.
 *
 * Shared create-composer field capabilities and visible ordering live in
 * `entityCreateFieldsRegistry.ts`. Keep this file focused on Todo's existing
 * behavior-heavy row offsets, property lookup, and favorite option rows.
 */
export type TodoComposerPropertyKey = CreateComposerPropertyKey;
export type TodoComposerFavoriteOptionId = 'add';
export type TodoComposerFavoriteOption = {
    id: TodoComposerFavoriteOptionId;
    label: string;
    secondary: string;
    checked: boolean;
};
export type TodoComposerValidationState = {
    status: 'empty' | 'checking' | 'available' | 'conflict' | 'error';
    value: string;
    message?: string | null;
    conflictId?: string | null;
    canOverwrite?: boolean;
};
export type TodoComposerShortcutValidationState = TodoComposerValidationState;
export type TodoComposerLayoutInput = {
    requiredFieldCount: number;
    timeRowCount: number;
    recurringRowCount: number;
    referenceRowCount: number;
    tagRowCount: number;
    favoriteRowCount: number;
    shortcutRowCount: number;
    hasTimeProperty: boolean;
    hasRecurringProperty: boolean;
    hasReferenceProperty: boolean;
    hasTagProperty: boolean;
    hasFavoriteProperty: boolean;
    hasShortcutProperty: boolean;
};
export type TodoComposerLayout = {
    expandedRowCount: number;
    requiredRowOffset: number;
    propertyRowOffset: number;
    totalRowCount: number;
    propertyRows: TodoComposerPropertyKey[];
};
export const buildTodoComposerLayout = ({ requiredFieldCount, timeRowCount, recurringRowCount, referenceRowCount, tagRowCount, favoriteRowCount, shortcutRowCount, hasTimeProperty, hasRecurringProperty, hasReferenceProperty, hasTagProperty, hasFavoriteProperty, hasShortcutProperty, }: TodoComposerLayoutInput): TodoComposerLayout => {
    const expandedRowCount = timeRowCount + recurringRowCount + referenceRowCount + tagRowCount + favoriteRowCount + shortcutRowCount;
    const propertyRows: TodoComposerPropertyKey[] = expandedRowCount === 0
        ? [
            hasTimeProperty ? 'time' : null,
            hasRecurringProperty ? 'recurring' : null,
            hasReferenceProperty ? 'reference' : null,
            hasTagProperty ? 'tag' : null,
            hasFavoriteProperty ? 'favorite' : null,
            hasShortcutProperty ? 'shortcut' : null
        ].filter(Boolean) as TodoComposerPropertyKey[]
        : [];
    const requiredRowOffset = expandedRowCount;
    const propertyRowOffset = requiredRowOffset + requiredFieldCount;
    return {
        expandedRowCount,
        requiredRowOffset,
        propertyRowOffset,
        totalRowCount: expandedRowCount + requiredFieldCount + propertyRows.length,
        propertyRows,
    };
};
export const getTodoComposerPropertyAtIndex = (layout: TodoComposerLayout, selectedIndex: number): TodoComposerPropertyKey | undefined => layout.propertyRows[selectedIndex - layout.propertyRowOffset];
export const moveTodoComposerSelectedIndex = (selectedIndex: number, offset: number, totalRowCount: number) => {
    if (totalRowCount <= 0)
        return 0;
    return (selectedIndex + offset + totalRowCount) % totalRowCount;
};
export const buildCreateComposerFavoriteOptions = (isFavoriteActive: boolean): TodoComposerFavoriteOption[] => [
    {
        id: 'add',
        label: 'Add to favorites',
        secondary: 'Item will be saved to favorites',
        checked: isFavoriteActive,
    }
];
// Backward-compatible export for older Todo composer call sites.
export const buildTodoComposerFavoriteOptions = buildCreateComposerFavoriteOptions;

import type { WebsitePopupCreateSession } from './websitePopupInteractionTypes';
/**
 * Pure keyboard policy for the popup Create composer.
 *
 * DOM components provide only field context. This resolver decides semantic
 * navigation/cancellation intent; reducer events own state and focus targets.
 */
export type WebsitePopupCreateKeyboardIntent = {
    kind: 'pass-through';
} | {
    kind: 'back-requested';
} | {
    kind: 'focus-field';
    field: string;
} | {
    kind: 'open-property-entry';
} | {
    kind: 'exit-child-mode';
    openOptions: boolean;
    focusField: string | null;
} | {
    kind: 'close-property-entry';
    focusField: string | null;
};
export type WebsitePopupCreateSaveKeyboardIntent = 'save-current' | 'save-and-create-another' | 'pass-through';
export type WebsitePopupCreateSaveAction = 'approve-text-command' | 'approve-hotkey' | 'save' | 'blocked';
/** The same focus order is used by field keys and reducer back transitions. */
export function getWebsitePopupCreateNavigationOrder(session: WebsitePopupCreateSession): string[] {
    const required = session.visibleFieldOrder;
    const order = [
        ...required,
        ...session.committedOptionalFieldOrder.filter(field => !required.includes(field))
    ];
    // An unfinished active option is still the next position in the chain.
    if (session.childMode && !order.includes(session.childMode)) order.push(session.childMode);
    return order;
}
export function getWebsitePopupCreateOptionBackField(session: WebsitePopupCreateSession): string | null {
    const order = getWebsitePopupCreateNavigationOrder(session);
    const exitedIndex = session.lastExitedChildField
        ? order.indexOf(session.lastExitedChildField) : -1;
    return (exitedIndex >= 0 ? order[exitedIndex - 1] : order[order.length - 1]);
}
/** The button and keyboard shortcut must take the same next step. */
export function resolveWebsitePopupCreateSaveAction({ textCommandConflict, hotkeyConflict, overwriteBlocked, saveBlocked, }: {
    textCommandConflict: boolean;
    hotkeyConflict: boolean;
    overwriteBlocked: boolean;
    saveBlocked: boolean;
}): WebsitePopupCreateSaveAction {
    if (textCommandConflict || hotkeyConflict) {
        if (overwriteBlocked)
            return 'blocked';
        return textCommandConflict ? 'approve-text-command' : 'approve-hotkey';
    }
    return saveBlocked ? 'blocked' : 'save';
}
export function resolveWebsitePopupCreateSaveKeyboardIntent({ key, ctrlKey, metaKey, shiftKey, altKey, }: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
}): WebsitePopupCreateSaveKeyboardIntent {
    if (key !== 'Enter' || (!ctrlKey && !metaKey) || altKey)
        return 'pass-through';
    return shiftKey ? 'save-and-create-another' : 'save-current';
}
export function resolveWebsitePopupCreateKeyboardIntent({ key, shiftKey, field, fieldOrder, isEmpty, hasPropertyFields, traverseVisibleFields = false, propertyEntryOpen, childMode, propertyBackField, }: {
    key: string;
    shiftKey: boolean;
    field: string;
    fieldOrder: readonly string[];
    isEmpty: boolean;
    hasPropertyFields: boolean;
    traverseVisibleFields?: boolean;
    propertyEntryOpen: boolean;
    childMode: string | null;
    propertyBackField?: string | null;
}): WebsitePopupCreateKeyboardIntent {
    const navigationField = field.startsWith('argument-query:')
        ? field.slice('argument-query:'.length) : field;
    const fieldIndex = fieldOrder.indexOf(navigationField);
    const previousField = fieldIndex > 0 ? fieldOrder[fieldIndex - 1] : null;
    const nextField = fieldIndex >= 0 ? fieldOrder[fieldIndex + 1] : null;
    if (key === 'Escape') {
        if (childMode && traverseVisibleFields)
            return {
                kind: 'exit-child-mode', openOptions: false, focusField: navigationField,
            };
        if (childMode)
            return { kind: 'back-requested' };
        if (propertyEntryOpen)
            return {
                kind: 'close-property-entry',
                focusField: propertyBackField ?? previousField ?? fieldOrder[fieldOrder.length - 1] ?? null,
            };
        return { kind: 'back-requested' };
    }
    if (key === 'Tab') {
        if (childMode && traverseVisibleFields)
            return {
                kind: 'exit-child-mode',
                openOptions: false,
                focusField: shiftKey
                    ? previousField || fieldOrder[fieldOrder.length - 1]
                    : nextField || 'save-button',
            };
        if (childMode)
            return {
                kind: 'exit-child-mode',
                openOptions: !shiftKey && hasPropertyFields,
                focusField: shiftKey
                    ? previousField || fieldOrder[fieldOrder.length - 1]
                    : hasPropertyFields ? null : 'save-button',
            };
        if (propertyEntryOpen && field === 'property-prefix') {
            return shiftKey
                ? { kind: 'close-property-entry', focusField: propertyBackField ?? fieldOrder[fieldOrder.length - 1] ?? null }
                : { kind: 'pass-through' };
        }
        if (shiftKey)
            return previousField
                ? { kind: 'focus-field', field: previousField }
                : { kind: 'back-requested' };
        if (nextField)
            return { kind: 'focus-field', field: nextField };
        return hasPropertyFields ? { kind: 'open-property-entry' } : { kind: 'pass-through' };
    }
    if (key === 'Backspace' && isEmpty) {
        if (childMode)
            return {
                kind: 'exit-child-mode', openOptions: false, focusField: previousField,
            };
        if (propertyEntryOpen)
            return {
                kind: 'close-property-entry',
                focusField: propertyBackField ?? previousField ?? fieldOrder[fieldOrder.length - 1] ?? null,
            };
        if (previousField)
            return { kind: 'focus-field', field: previousField };
        return { kind: 'back-requested' };
    }
    return { kind: 'pass-through' };
}
/** Route-level fallback after an active Create argument declines a key. */
export function resolveWebsitePopupRouteKeyboardIntent({ key, source, query, isCreateArgument, }: {
    key: string;
    source: 'default' | 'normal' | 'create' | 'save' | 'filter' | 'submode';
    query: string;
    isCreateArgument: boolean;
}): 'back-requested' | 'pass-through' {
    if (isCreateArgument)
        return 'pass-through';
    if (key === 'Escape' && (source === 'create' || source === 'save' || source === 'filter' || source === 'submode')) {
        return 'back-requested';
    }
    if (key === 'Backspace'
        && !query
        && (source === 'create' || source === 'save' || source === 'filter' || source === 'submode')) {
        return 'back-requested';
    }
    return 'pass-through';
}

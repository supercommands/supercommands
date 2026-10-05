/** Create transitions share the popup's single store and event contract. */
import type { WebsitePopupInteractionState, WebsitePopupInteractionEvent } from './websitePopupInteractionTypes';
import { normalizeHotkeyString } from '../../../../shared-components/hotkeys/core/eventParser';
import { getWebsitePopupCreateOptionBackField } from './websitePopupKeyboardIntentResolver';
import { createWebsitePopupCreateSession } from './websitePopupCreateSession';
export function reduceWebsitePopupCreateInteraction(state: WebsitePopupInteractionState, event: WebsitePopupInteractionEvent): WebsitePopupInteractionState | null {
    switch (event.type) {
        case 'CREATE_FIELD_FOCUSED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    activeArgumentId: event.field,
                },
            };
        case 'CREATE_MODEL_SELECTION_CHANGED': {
            if (!state.createSession || state.createSession.entity !== 'agent')
                return state;
            return { ...state, createSession: { ...state.createSession, modelSelection: event.value } };
        }
        case 'CREATE_FIELDS_HYDRATED': {
            if (!state.createSession || state.createSession.fieldsHydrated)
                return state;
            const hotkeyField = Object.entries(event.fieldSources).find(([, source]) => source === 'hotkey')?.[0];
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    fieldValues: { ...event.values },
                    selectedValuesByField: { ...(event.selectedValuesByField || {}) },
                    visibleFieldOrder: event.visibleFieldOrder,
                    fieldSources: event.fieldSources,
                    committedOptionalFieldOrder: event.committedOptionalFieldOrder || [],
                    childMode: hotkeyField && event.committedOptionalFieldOrder?.includes(hotkeyField) ? hotkeyField : null,
                    fieldsHydrated: true,
                    focusRequest: hotkeyField && event.committedOptionalFieldOrder?.includes(hotkeyField)
                        ? { target: `argument-query:${hotkeyField}`, revision: 1 }
                        : event.visibleFieldOrder[0]
                            ? { target: event.visibleFieldOrder[0], revision: 1 }
                            : null,
                },
            };
        }
        case 'CREATE_FIELD_VALUE_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    fieldValues: {
                        ...state.createSession.fieldValues,
                        [event.field]: event.value,
                    },
                    textCommandValidation: state.createSession.fieldSources[event.field] === 'shortcut'
                        ? String(event.value || '').trim()
                            ? { status: 'checking', value: event.value.trim().toLowerCase() }
                            : { status: 'empty', value: '' }
                        : state.createSession.textCommandValidation,
                    hotkeyValidation: state.createSession.fieldSources[event.field] === 'hotkey'
                        ? String(event.value || '').trim()
                            ? { status: 'checking', value: event.value.trim() }
                            : { status: 'empty', value: '' }
                        : state.createSession.hotkeyValidation,
                },
            };
        case 'CREATE_PROPERTY_ENTRY_CHANGED':
            if (!state.createSession)
                return state;
            const fallbackField = getWebsitePopupCreateOptionBackField(state.createSession);
            return {
                ...state,
                selectedIndex: 0,
                suggestionCount: 0,
                createSession: {
                    ...state.createSession,
                    propertyEntryOpen: event.open,
                    lastExitedChildField: null,
                    propertyPrefixDraft: event.open ? state.createSession.propertyPrefixDraft : '',
                    focusRequest: event.open
                        ? {
                            target: 'property-prefix',
                            revision: (state.createSession.focusRequest?.revision || 0) + 1,
                        }
                        : state.createSession.childMode
                            ? state.createSession.focusRequest
                            : fallbackField
                                ? {
                                    target: fallbackField,
                                    revision: (state.createSession.focusRequest?.revision || 0) + 1,
                                }
                                : state.createSession.focusRequest,
                },
            };
        case 'CREATE_PROPERTY_PREFIX_DRAFT_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                selectedIndex: 0,
                createSession: { ...state.createSession, propertyPrefixDraft: event.value },
            };
        case 'CREATE_CHILD_MODE_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                selectedIndex: 0,
                suggestionCount: 0,
                createSession: {
                    ...state.createSession,
                    childMode: event.mode,
                    lastExitedChildField: null,
                    propertyEntryOpen: event.mode ? state.createSession.propertyEntryOpen : false,
                    focusRequest: event.mode
                        ? {
                            target: `argument-query:${event.mode}`,
                            revision: (state.createSession.focusRequest?.revision || 0) + 1,
                        }
                        : state.createSession.focusRequest,
                },
            };
        case 'CREATE_ARGUMENT_QUERY_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                selectedIndex: 0,
                createSession: {
                    ...state.createSession,
                    argumentQueries: {
                        ...state.createSession.argumentQueries,
                        [event.field]: event.value,
                    },
                },
            };
        case 'CREATE_FIELD_SELECTION_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    selectedValuesByField: {
                        ...state.createSession.selectedValuesByField,
                        [event.field]: event.values,
                    },
                },
            };
        case 'CREATE_OPTION_ADDED':
            if (!state.createSession)
                return state;
            if (state.createSession.committedOptionalFieldOrder.includes(event.field))
                return state;
            const finalRequiredField = state.createSession.visibleFieldOrder[state.createSession.visibleFieldOrder.length - 1];
            return {
                ...state,
                selectedIndex: 0,
                suggestionCount: 0,
                createSession: {
                    ...state.createSession,
                    committedOptionalFieldOrder: [...state.createSession.committedOptionalFieldOrder, event.field],
                    fieldValues: state.createSession.fieldSources[event.field] === 'favorite'
                        ? { ...state.createSession.fieldValues, [event.field]: 'enabled' }
                        : state.createSession.fieldValues,
                    selectedValuesByField: state.createSession.fieldSources[event.field] === 'favorite'
                        ? {
                            ...state.createSession.selectedValuesByField,
                            [event.field]: [
                                {
                                    id: 'enabled',
                                    label: 'Added to Favorites',
                                    serializedValue: 'enabled',
                                }
                            ],
                        }
                        : state.createSession.selectedValuesByField,
                    propertyEntryOpen: false,
                    propertyPrefixDraft: '',
                    childMode: null,
                    lastExitedChildField: null,
                    focusRequest: event.preserveFocus
                        ? state.createSession.focusRequest
                        : state.createSession.fieldSources[event.field] === 'shortcut' ||
                            state.createSession.fieldSources[event.field] === 'hotkey' ||
                            finalRequiredField
                            ? {
                                target: state.createSession.fieldSources[event.field] === 'shortcut' ||
                                    state.createSession.fieldSources[event.field] === 'hotkey'
                                    ? event.field
                                    : finalRequiredField!,
                                revision: (state.createSession.focusRequest?.revision || 0) + 1,
                            }
                            : state.createSession.focusRequest,
                },
            };
        case 'CREATE_OPTION_PRESENCE_SYNCED':
            if (!state.createSession)
                return state;
            const alreadyPresent = state.createSession.committedOptionalFieldOrder.includes(event.field);
            if (alreadyPresent === event.present)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    committedOptionalFieldOrder: event.present
                        ? [...state.createSession.committedOptionalFieldOrder, event.field]
                        : state.createSession.committedOptionalFieldOrder.filter(field => field !== event.field),
                },
            };
        case 'CREATE_OPTION_REMOVED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                selectedIndex: 0,
                suggestionCount: 0,
                createSession: {
                    ...state.createSession,
                    committedOptionalFieldOrder: state.createSession.committedOptionalFieldOrder.filter(field => field !== event.field),
                    fieldValues: { ...state.createSession.fieldValues, [event.field]: '' },
                    selectedValuesByField: { ...state.createSession.selectedValuesByField, [event.field]: [] },
                    argumentQueries: { ...state.createSession.argumentQueries, [event.field]: '' },
                    childMode: state.createSession.childMode === event.field ? null : state.createSession.childMode,
                    lastExitedChildField: null,
                    propertyEntryOpen: state.createSession.childMode === event.field ? true : state.createSession.propertyEntryOpen,
                    focusRequest: state.createSession.childMode === event.field
                        ? { target: 'property-prefix', revision: (state.createSession.focusRequest?.revision || 0) + 1 }
                        : state.createSession.focusRequest,
                    textCommandValidation: state.createSession.fieldSources[event.field] === 'shortcut'
                        ? { status: 'empty', value: '' }
                        : state.createSession.textCommandValidation,
                    hotkeyValidation: state.createSession.fieldSources[event.field] === 'hotkey'
                        ? { status: 'empty', value: '' }
                        : state.createSession.hotkeyValidation,
                    hotkeyCapture: state.createSession.fieldSources[event.field] === 'hotkey'
                        ? { status: 'idle', token: null, error: null }
                        : state.createSession.hotkeyCapture,
                },
            };
        case 'CREATE_TEXT_COMMAND_VALIDATION_CHANGED':
            if (!state.createSession)
                return state;
            if (state.createSession.fieldValues.shortcut?.trim().toLowerCase() !== event.check.value)
                return state;
            return {
                ...state,
                createSession: { ...state.createSession, textCommandValidation: event.check },
            };
        case 'CREATE_TEXT_COMMAND_OVERWRITE_APPROVED':
            if (!state.createSession || state.createSession.textCommandValidation.status !== 'conflict')
                return state;
            if (event.mode === 'add' && !state.createSession.textCommandValidation.conflict.canShare)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    textCommandValidation: {
                        status: 'approved',
                        value: state.createSession.textCommandValidation.value,
                        conflict: { ...state.createSession.textCommandValidation.conflict, mode: event.mode || 'overwrite' },
                        message: event.mode === 'add' ? 'Will add this item to the existing Text Command on Save.'
                            : 'Will replace all existing assignments of this Text Command on Save.',
                    },
                },
            };
        case 'CREATE_TEXT_COMMAND_PARTIAL_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: { ...state.createSession, textCommandPartial: event.partial },
            };
        case 'CREATE_FAVORITE_PARTIAL_CHANGED':
            if (!state.createSession)
                return state;
            return { ...state, createSession: { ...state.createSession, favoritePartial: event.partial } };
        case 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: { ...state.createSession, todoFollowupPartial: event.partial },
            };
        case 'CREATE_HOTKEY_VALIDATION_CHANGED':
            if (!state.createSession)
                return state;
            if (normalizeHotkeyString(state.createSession.fieldValues.hotkey || '') !== event.check.value)
                return state;
            return { ...state, createSession: { ...state.createSession, hotkeyValidation: event.check } };
        case 'CREATE_HOTKEY_OVERWRITE_APPROVED':
            if (!state.createSession || state.createSession.hotkeyValidation.status !== 'conflict')
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    hotkeyValidation: {
                        status: 'approved',
                        value: state.createSession.hotkeyValidation.value,
                        conflict: state.createSession.hotkeyValidation.conflict,
                        message: `Will replace "${state.createSession.hotkeyValidation.conflict.label}" on Save.`,
                    },
                },
            };
        case 'CREATE_HOTKEY_CAPTURE_CHANGED':
            if (!state.createSession)
                return state;
            return { ...state, createSession: { ...state.createSession, hotkeyCapture: event.capture } };
        case 'CREATE_HOTKEY_PARTIAL_CHANGED':
            if (!state.createSession)
                return state;
            return { ...state, createSession: { ...state.createSession, hotkeyPartial: event.partial } };
        case 'CREATE_FOCUS_REQUESTED':
            if (!state.createSession)
                return state;
            return {
                ...state,
                createSession: {
                    ...state.createSession,
                    focusRequest: {
                        target: event.target,
                        revision: (state.createSession.focusRequest?.revision || 0) + 1,
                    },
                },
            };
        case 'CREATE_RESET_FOR_ANOTHER':
            if (state.route.kind !== 'create' || !state.createSession)
                return state;
            return {
                ...state,
                inputValue: '',
                route: { ...state.route, query: '' },
                parsedIntent: { kind: 'none' },
                createSession: createWebsitePopupCreateSession(state.createSession.entity),
                selectedIndex: 0,
                suggestionCount: 0,
            };
        default:
            return null;
    }
}

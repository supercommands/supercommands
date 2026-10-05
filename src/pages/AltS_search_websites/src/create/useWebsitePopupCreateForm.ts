/** Shared Create state, hydration, field actions, validation, and keyboard navigation. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, } from 'react';
import { useStore } from 'zustand';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreateFieldGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupCreateSelectedValue, WebsitePopupCreateSession, WebsitePopupCreateSurface, } from '../interaction/websitePopupInteractionTypes';
import { hydrateWebsitePopupCreateSession, serializeWebsitePopupCreateGrammarDraft, } from './websitePopupCreateGrammarParser';
import { getWebsitePopupCreatePropertyFields } from './websitePopupCreatePropertyCommand';
import { getWebsitePopupCreateNavigationOrder, getWebsitePopupCreateOptionBackField, resolveWebsitePopupCreateKeyboardIntent, } from '../interaction/websitePopupKeyboardIntentResolver';
import { removeLastWebsitePopupMultiSelectValue } from '../interaction/websitePopupMultiSelectController';
import { useWebsitePopupTextCommandValidation } from './useWebsitePopupTextCommandValidation';
import { useWebsitePopupHotkeyValidation } from './useWebsitePopupHotkeyValidation';
import type { WebsitePopupCreateFieldAdapter } from './WebsitePopupCreateField';
import { getWebsitePopupCreateRequiredFields } from './websitePopupCreateFormFields';
import { getWebsitePopupCreateControlKind, getWebsitePopupMultiSelectPresentation, } from './websitePopupCreateFieldPolicy';
import { writeWebsitePopupCreateField, writeWebsitePopupCreateSelections } from './websitePopupCreateDraftWriter';
export type WebsitePopupCreateFormOptions = {
    store: WebsitePopupInteractionStoreApi;
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    onPrimaryInputRef?: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
    onNextFieldLabelChange?: (label: string | null) => void;
    sidePanelOpen?: boolean;
    activeSurface?: WebsitePopupCreateSurface;
    onSurfaceFocus?: (surface: WebsitePopupCreateSurface) => void;
    sidePanelPropertiesTarget?: HTMLElement | null;
    onCollapseSidePanel?: () => void;
};
const toTitleCase = (value: string) => value.replace(/\b\w/g, character => character.toUpperCase());
export function useWebsitePopupCreateForm({ store, createGrammar, onPrimaryInputRef, onNextFieldLabelChange, sidePanelOpen = false, activeSurface = 'composer', onSurfaceFocus, sidePanelPropertiesTarget = null, onCollapseSidePanel, }: WebsitePopupCreateFormOptions) {
    const state = useStore(store, current => current.state);
    const dispatch = useStore(store, current => current.dispatch);
    const route = state.route.kind === 'create' ? state.route : null;
    const standalone = route?.presentation === 'standalone';
    if (standalone) {
        activeSurface = 'panel';
        sidePanelOpen = true;
    }
    const createSession = state.createSession;
    const grammar = createGrammar.find(candidate => candidate.entity === route?.entity);
    const textCommandFieldId = grammar?.fields.find(field => field.source === 'shortcut')?.field;
    const hotkeyFieldId = grammar?.fields.find(field => field.source === 'hotkey')?.field;
    const composerRef = useRef<HTMLDivElement | null>(null);
    const fieldRefs = useRef<Record<WebsitePopupCreateSurface, Record<string, HTMLElement | null>>>({
        composer: {},
        panel: {},
    });
    const propertyCommandRef = useRef<HTMLInputElement | null>(null);
    const activeField = createSession?.activeArgumentId;
    const propertyEntryOpen = Boolean(createSession?.propertyEntryOpen);
    const childMode = createSession?.childMode;
    // The generic Option query exists only in the Option chooser. Every active
    // field owns its own input, so no child mode can render a second Search row.
    const isPropertyFieldVisible = propertyEntryOpen && !childMode;
    const propertyFocusTarget = 'property-prefix';
    const query = route?.query || '';
    const requiredFields = useMemo(() => getWebsitePopupCreateRequiredFields(grammar, route?.presentation || 'inline', createSession?.fieldsHydrated ? createSession.visibleFieldOrder : []), [grammar, route?.presentation, createSession?.fieldsHydrated, createSession?.visibleFieldOrder]);
    const propertyFields = useMemo(() => (grammar ? getWebsitePopupCreatePropertyFields(grammar) : []), [grammar]);
    const availablePropertyFields = useMemo(() => propertyFields.filter(field => !createSession?.committedOptionalFieldOrder.includes(field.field)), [createSession?.committedOptionalFieldOrder, propertyFields]);
    const addedOptionalFields = useMemo(() => (createSession?.committedOptionalFieldOrder || []).flatMap(fieldId => {
        const field = propertyFields.find(candidate => candidate.field === fieldId);
        return field ? [field] : [];
    }), [createSession?.committedOptionalFieldOrder, propertyFields]);
    const panelOptionalFields = propertyFields;
    const focusedEmptyComposerField = activeSurface === 'composer' && activeField && !addedOptionalFields.some(field => field.field === activeField)
        ? propertyFields.find(field => field.field === activeField)
        : null;
    const composerOptionalFields = focusedEmptyComposerField
        ? [...addedOptionalFields, focusedEmptyComposerField]
        : addedOptionalFields;
    const optionalViews: {
        field: WebsitePopupCreateFieldGrammar;
        surface: WebsitePopupCreateSurface;
    }[] = [
        ...(standalone ? [] : composerOptionalFields.map(field => ({ field, surface: 'composer' as const }))),
        ...(sidePanelOpen ? panelOptionalFields.map(field => ({ field, surface: 'panel' as const })) : [])
    ];
    const navigationFieldOrder = sidePanelOpen && activeSurface === 'panel'
        ? [
            ...requiredFields.filter(field => field.tabCycle !== false).map(field => field.field),
            ...panelOptionalFields
                .filter(field => getWebsitePopupCreateControlKind(field) !== 'unsupported')
                .map(field => field.field)
        ]
        : createSession?.fieldsHydrated
            ? getWebsitePopupCreateNavigationOrder(createSession)
            : requiredFields.map(field => field.field);
    const propertyBackField = sidePanelOpen && activeSurface === 'panel'
        ? navigationFieldOrder.at(-1)
        : createSession?.fieldsHydrated
            ? getWebsitePopupCreateOptionBackField(createSession)
            : navigationFieldOrder.at(-1);
    useLayoutEffect(() => {
        const composer = composerRef.current;
        if (!composer)
            return;
        // The category identity is separate from the composer. Bound each
        // control by the space remaining beside its intrinsic label.
        const measure = () => {
            const slots = Array.from(composer.querySelectorAll<HTMLElement>('.website-popup-argument-slot'));
            // Update the per-slot width bound after flex wrapping.
            const right = composer.getBoundingClientRect().right;
            for (const slot of slots) {
                const control = slot.querySelector<HTMLElement>('.website-popup-argument-slot__control');
                if (!control)
                    continue;
                const available = right - control.getBoundingClientRect().left;
                if (available <= 0) {
                    slot.style.removeProperty('--website-popup-argument-available-width');
                    continue;
                }
                const value = `${available}px`;
                if (slot.style.getPropertyValue('--website-popup-argument-available-width') !== value) {
                    slot.style.setProperty('--website-popup-argument-available-width', value);
                }
            }
        };
        measure();
        let frame: number | null = null;
        const scheduleMeasure = () => {
            if (frame !== null)
                return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                measure();
            });
        };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
        observer?.observe(composer);
        for (const item of Array.from(composer.children)) {
            if (item instanceof HTMLElement)
                observer?.observe(item);
        }
        document.fonts?.addEventListener?.('loadingdone', scheduleMeasure);
        return () => {
            if (frame !== null)
                window.cancelAnimationFrame(frame);
            observer?.disconnect();
            document.fonts?.removeEventListener?.('loadingdone', scheduleMeasure);
        };
    }, [addedOptionalFields, focusedEmptyComposerField?.field, grammar?.entity, isPropertyFieldVisible, requiredFields]);
    useWebsitePopupTextCommandValidation(store, Boolean(textCommandFieldId && createSession?.committedOptionalFieldOrder.includes(textCommandFieldId)), textCommandFieldId ? createSession?.fieldValues[textCommandFieldId] || '' : '');
    const hotkeyCurrentEntityId = createSession?.todoFollowupPartial?.entityId ||
        createSession?.textCommandPartial?.entityId ||
        createSession?.hotkeyPartial?.entityId;
    useWebsitePopupHotkeyValidation(store, Boolean(hotkeyFieldId && createSession?.committedOptionalFieldOrder.includes(hotkeyFieldId)), hotkeyFieldId ? createSession?.fieldValues[hotkeyFieldId] || '' : '', hotkeyCurrentEntityId);
    const updateHotkeyCaptureState = useCallback((capture: WebsitePopupCreateSession['hotkeyCapture']) => {
        dispatch({ type: 'CREATE_HOTKEY_CAPTURE_CHANGED', capture });
        if (capture.status === 'recording' && hotkeyFieldId) {
            dispatch({ type: 'CREATE_FIELD_FOCUSED', field: hotkeyFieldId });
        }
    }, [dispatch, hotkeyFieldId]);
    useEffect(() => {
        if (!grammar || !createSession || createSession.fieldsHydrated)
            return;
        const hydration = hydrateWebsitePopupCreateSession(query, grammar);
        dispatch({
            type: 'CREATE_FIELDS_HYDRATED',
            values: hydration.fieldValues,
            visibleFieldOrder: standalone ? requiredFields.filter(field => field.tabCycle !== false).map(field => field.field) : hydration.visibleFieldOrder,
            fieldSources: grammar.fields.reduce<WebsitePopupCreateSession['fieldSources']>((sources, field) => {
                if (field.source)
                    sources[field.field] = field.source;
                return sources;
            }, {}),
            selectedValuesByField: hydration.selectedValuesByField,
            committedOptionalFieldOrder: hydration.committedOptionalFieldOrder,
        });
    }, [createSession, dispatch, grammar, query, requiredFields, standalone]);
    useEffect(() => {
        const request = createSession?.focusRequest;
        if (!request)
            return;
        const childField = request.target.startsWith('argument-query:')
            ? request.target.slice('argument-query:'.length)
            : null;
        const targetField = childField || request.target;
        const frame = window.requestAnimationFrame(() => {
            const composer = composerRef.current;
            const roots = activeSurface === 'panel' ? [sidePanelPropertiesTarget, composer] : [composer, sidePanelPropertiesTarget];
            const slot = roots
                .flatMap(root => Array.from(root?.querySelectorAll<HTMLElement>('[data-field-id]') || []))
                .find(element => element.dataset.fieldId === targetField);
            const target = request.target === 'property-prefix'
                ? propertyCommandRef.current
                : fieldRefs.current[activeSurface][targetField] ||
                    fieldRefs.current[activeSurface === 'panel' ? 'composer' : 'panel'][targetField] ||
                    slot?.querySelector<HTMLElement>('[data-is-hotkey-input="true"], .website-popup-hotkey-capture__summary, [data-create-option-remove="true"]');
            if (request.target === 'save-button') {
                const root = composerRef.current?.getRootNode();
                if (root instanceof ShadowRoot) {
                    root
                        .querySelector<HTMLButtonElement>('.website-popup-create-footer__save[data-action]:not(:disabled)')
                        ?.focus({ preventScroll: true });
                }
            }
            else
                target?.focus({ preventScroll: true });
            const focusViewport = target?.closest<HTMLElement>('.website-popup-create-composer') ||
                target?.closest<HTMLElement>('.website-popup-create-side-panel__content');
            if (target && focusViewport) {
                const targetRect = target.getBoundingClientRect();
                const viewportRect = focusViewport.getBoundingClientRect();
                if (targetRect.bottom > viewportRect.bottom)
                    focusViewport.scrollTop += targetRect.bottom - viewportRect.bottom;
                else if (targetRect.top < viewportRect.top)
                    focusViewport.scrollTop -= viewportRect.top - targetRect.top;
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activeSurface, createSession?.focusRequest, requiredFields, sidePanelPropertiesTarget]);
    useEffect(() => {
        const activeIndex = navigationFieldOrder.indexOf(childMode || activeField || '');
        const nextFieldId = navigationFieldOrder[activeIndex + 1];
        const nextField = grammar?.fields.find(field => field.field === nextFieldId);
        const backLabel = grammar?.fields.find(field => field.field === propertyBackField)?.label;
        const nextLabel = propertyEntryOpen && activeSurface === 'composer'
            ? toTitleCase(backLabel || 'Save')
            : nextField
                ? toTitleCase(nextField.label)
                : activeSurface === 'composer' && availablePropertyFields.length > 0
                    ? 'Add Option'
                    : 'Save';
        onNextFieldLabelChange?.(nextLabel);
    }, [
        activeField,
        activeSurface,
        availablePropertyFields.length,
        childMode,
        grammar,
        navigationFieldOrder,
        onNextFieldLabelChange,
        propertyBackField,
        propertyEntryOpen
    ]);
    if (!route || !grammar)
        return null;
    const getValue = (field: string) => createSession?.fieldValues[field] || '';
    const markSurface = (surface: WebsitePopupCreateSurface) => onSurfaceFocus?.(surface);
    const focusTextField = (field: string, surface: WebsitePopupCreateSurface) => {
        markSurface(surface);
        const current = store.getState().state.createSession;
        if (current?.childMode && current.childMode !== field) {
            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
        }
        if (current?.propertyEntryOpen) {
            dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
            dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: field });
        }
        dispatch({ type: 'CREATE_FIELD_FOCUSED', field });
    };
    const writeField = (field: string, value: string) => {
        if (panelOptionalFields.some(option => option.field === field)) {
            dispatch({ type: 'CREATE_OPTION_PRESENCE_SYNCED', field, present: Boolean(value.trim()) });
        }
        writeWebsitePopupCreateField(store, grammar, field, value);
    };
    const removeOption = (field: string, surface: WebsitePopupCreateSurface) => {
        if (surface === 'panel') {
            dispatch({ type: 'CREATE_OPTION_PRESENCE_SYNCED', field, present: false });
            dispatch({ type: 'CREATE_FIELD_SELECTION_CHANGED', field, values: [] });
            writeWebsitePopupCreateField(store, grammar, field, '');
            if (store.getState().state.createSession?.childMode === field) {
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
            }
            return;
        }
        const values = store.getState().state.createSession?.fieldValues || {};
        dispatch({ type: 'CREATE_OPTION_REMOVED', field });
        dispatch({
            type: 'QUERY_CHANGED',
            query: serializeWebsitePopupCreateGrammarDraft({ ...values, [field]: '' }, grammar),
            parsedIntent: { kind: 'none' },
        });
        if (!sidePanelOpen) {
            dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
            dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: 'property-prefix' });
        }
    };
    const writeMultiSelectValues = (field: string, nextValues: WebsitePopupCreateSelectedValue[]) => {
        writeWebsitePopupCreateSelections(store, grammar, field, nextValues);
    };
    const handleMultiSelectKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, field: string, selections: WebsitePopupCreateSelectedValue[], surface: WebsitePopupCreateSurface) => {
        if (event.ctrlKey || event.metaKey || event.altKey)
            return;
        if ((event.key === 'Backspace' || event.key === 'Delete') && !event.currentTarget.value && selections.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            writeMultiSelectValues(field, removeLastWebsitePopupMultiSelectValue(selections));
            return;
        }
        handleFieldKeyDown(event, field, event.currentTarget.value, surface);
    };
    const handleFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>, field: string, value: string, surface: WebsitePopupCreateSurface = 'composer') => {
        const intent = resolveWebsitePopupCreateKeyboardIntent({
            key: event.key,
            shiftKey: event.shiftKey,
            field,
            fieldOrder: navigationFieldOrder,
            isEmpty: !value,
            hasPropertyFields: surface === 'composer' && availablePropertyFields.length > 0,
            traverseVisibleFields: sidePanelOpen && surface === 'panel',
            propertyEntryOpen,
            childMode: childMode ?? null,
            propertyBackField: propertyBackField ?? null,
        });
        if (intent.kind === 'pass-through')
            return;
        event.preventDefault();
        event.stopPropagation();
        if (intent.kind === 'back-requested') {
            if (standalone && event.key === 'Backspace') return;
            if (sidePanelOpen && !childMode && !propertyEntryOpen)
                onCollapseSidePanel?.();
            else
                dispatch({ type: 'BACK_REQUESTED' });
            return;
        }
        if (intent.kind === 'focus-field') {
            dispatch({ type: 'CREATE_FIELD_FOCUSED', field: intent.field });
            dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: intent.field });
            return;
        }
        if (intent.kind === 'open-property-entry') {
            dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
            dispatch({ type: 'CREATE_FIELD_FOCUSED', field: 'property-prefix' });
            return;
        }
        if (intent.kind === 'exit-child-mode') {
            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
            if (intent.openOptions)
                dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
            else if (intent.focusField)
                dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: intent.focusField });
            return;
        }
        if (intent.kind === 'close-property-entry') {
            dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
            if (intent.focusField) {
                dispatch({ type: 'CREATE_FIELD_FOCUSED', field: intent.focusField });
                dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: intent.focusField });
            }
            return;
        }
    };
    const focusPreviousField = (fieldId: string) => {
        const previous = navigationFieldOrder[navigationFieldOrder.indexOf(fieldId) - 1];
        if (previous)
            dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: previous });
    };
    const registerField = (field: string, surface: WebsitePopupCreateSurface, primary: boolean, element: HTMLInputElement | HTMLTextAreaElement | null) => {
        fieldRefs.current[surface][field] = element;
        if (primary)
            onPrimaryInputRef?.(element);
    };
    const propertyAdapter: WebsitePopupCreateFieldAdapter = {
        text: (field, surface, primary) => ({
            ref: element => registerField(field.field, surface, primary, element),
            className: 'website-popup-create-composer__input',
            value: getValue(field.field),
            'aria-label': `${toTitleCase(field.label)} for ${grammar.entity}`,
            autoComplete: 'off', spellCheck: false,
            onFocus: () => focusTextField(field.field, surface),
            onChange: event => writeField(field.field, event.currentTarget.value),
            onKeyDown: event => handleFieldKeyDown(event, field.field, getValue(field.field), surface),
            'data-active': activeField === field.field ? 'true' : 'false',
        }),
        textarea: (field, surface, primary) => ({
            inputRef: element => registerField(field.field, surface, primary, element),
            className: 'website-popup-create-composer__textarea website-popup-custom-scrollbar',
            value: getValue(field.field), maximumRows: field.maximumRows || 3,
            active: activeField === field.field,
            'aria-label': `${toTitleCase(field.label)} for ${grammar.entity}`,
            autoComplete: 'off', spellCheck: false,
            onFocus: () => focusTextField(field.field, surface),
            onChange: event => writeField(field.field, event.currentTarget.value),
            onKeyDown: event => handleFieldKeyDown(event, field.field, getValue(field.field), surface),
        }),
        isActive: (field, surface) => activeField === field.field && activeSurface === surface,
        onSurfaceFocus: markSurface,
        multiSelect: (field, optional, surface, primary = false) => {
            const presentation = getWebsitePopupMultiSelectPresentation(field)!;
            const selections = createSession?.selectedValuesByField[field.field] || [];
            return {
                values: selections,
                query: optional && (childMode !== field.field || activeSurface !== surface)
                    ? ''
                    : createSession?.argumentQueries[field.field] || '',
                placeholder: presentation.placeholder,
                addPlaceholder: presentation.addPlaceholder,
                itemLabel: presentation.itemLabel,
                removable: surface === 'composer',
                inputRef: element => {
                    fieldRefs.current[surface][field.field] = element;
                    if (primary)
                        onPrimaryInputRef?.(element);
                },
                onFocus: () => {
                    markSurface(surface);
                    dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
                    dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: field.field });
                    if (!optional)
                        dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
                },
                onQueryChange: value => dispatch({ type: 'CREATE_ARGUMENT_QUERY_CHANGED', field: field.field, value }),
                onKeyDown: event => handleMultiSelectKeyDown(event, field.field, selections, surface),
                onRemove: id => writeMultiSelectValues(field.field, selections.filter(selection => selection.id !== id)),
            };
        },
        hotkey: (field, surface) => ({
            active: childMode === field.field && activeSurface === surface,
            removable: surface === 'composer',
            disabled: Boolean(createSession?.favoritePartial),
            value: getValue(field.field),
            onChange: value => writeField(field.field, value),
            onCaptureStateChange: updateHotkeyCaptureState,
            onCancel: previousValue => {
                if (!previousValue) {
                    if (surface === 'panel') {
                        dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
                        dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: field.field });
                    }
                    else
                        removeOption(field.field, surface);
                    return;
                }
                if (store.getState().state.createSession?.fieldValues[field.field] !== previousValue) {
                    writeField(field.field, previousValue);
                }
                if (surface === 'panel') {
                    dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
                    dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: field.field });
                }
                else
                    dispatch({ type: 'BACK_REQUESTED' });
            },
            onCommit: reverse => {
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
                if (reverse) {
                    focusPreviousField(field.field);
                }
                else if (surface === 'panel') {
                    const nextField = navigationFieldOrder[navigationFieldOrder.indexOf(field.field) + 1];
                    dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: nextField || 'save-button' });
                }
                else if (availablePropertyFields.length > 0) {
                    dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
                }
                else
                    dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: 'save-button' });
            },
            onNavigateBack: () => focusPreviousField(field.field),
            onEscape: () => (sidePanelOpen ? onCollapseSidePanel?.() : dispatch({ type: 'BACK_REQUESTED' })),
            onFocus: () => {
                markSurface(surface);
                dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
            },
            onRemove: () => removeOption(field.field, surface),
            onReRecord: () => {
                markSurface(surface);
                dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: field.field });
            },
        }),
        input: (field, surface) => {
            const isRecurringChoice = field.source === 'recurring';
            const singleSelectPlaceholder = isRecurringChoice
                ? 'Choose Recurring'
                : field.source === 'time'
                    ? 'Enter date or time'
                    : `Search ${toTitleCase(field.label)}`;
            return getWebsitePopupCreateControlKind(field) === 'text-command'
                ? {
                    ref: element => {
                        fieldRefs.current[surface][field.field] = element;
                    },
                    className: 'website-popup-create-composer__input',
                    value: getValue(field.field),
                    stableValue: getValue(field.field),
                    placeholder: 'Enter command',
                    'aria-label': `Text Command for ${grammar.entity}`,
                    autoComplete: 'off',
                    spellCheck: false,
                    onFocus: () => {
                        markSurface(surface);
                        dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
                    },
                    onChange: event => writeField(field.field, event.currentTarget.value),
                    onKeyDown: event => handleFieldKeyDown(event, field.field, getValue(field.field), surface),
                    'data-active': activeField === field.field ? 'true' : 'false',
                }
                : {
                    ref: element => {
                        fieldRefs.current[surface][field.field] = element;
                    },
                    className: 'website-popup-create-composer__input website-popup-create-composer__property-query website-popup-create-option-control',
                    value: isRecurringChoice
                        ? createSession?.selectedValuesByField[field.field]?.[0]?.label || ''
                        : childMode === field.field && activeSurface === surface
                            ? createSession?.argumentQueries[field.field] || ''
                            : createSession?.selectedValuesByField[field.field]?.[0]?.label || '',
                    stableValue: createSession?.selectedValuesByField[field.field]?.[0]?.label || singleSelectPlaceholder,
                    placeholder: singleSelectPlaceholder,
                    'aria-label': isRecurringChoice ? 'Choose Recurring' : `Search ${field.label} options`,
                    readOnly: isRecurringChoice,
                    autoComplete: 'off',
                    spellCheck: false,
                    onFocus: () => {
                        markSurface(surface);
                        dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
                        if (store.getState().state.createSession?.childMode !== field.field) {
                            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: field.field });
                        }
                    },
                    onChange: event => {
                        if (!isRecurringChoice)
                            dispatch({
                                type: 'CREATE_ARGUMENT_QUERY_CHANGED',
                                field: field.field,
                                value: event.currentTarget.value,
                            });
                    },
                    onKeyDown: event => {
                        const queryValue = isRecurringChoice ? '' : createSession?.argumentQueries[field.field] || '';
                        if ((event.key === 'Backspace' || event.key === 'Delete') &&
                            !queryValue &&
                            (createSession?.selectedValuesByField[field.field] || []).length > 0) {
                            event.preventDefault();
                            event.stopPropagation();
                            writeMultiSelectValues(field.field, []);
                            return;
                        }
                        handleFieldKeyDown(event, `argument-query:${field.field}`, queryValue, surface);
                    },
                };
        },
        optional: (field, surface) => ({
            removable: surface === 'composer',
            removeLabel: field.source === 'favorite' ? 'Remove from Favorites' : `Remove ${toTitleCase(field.label)} option`,
            disabled: field.source === 'favorite' && Boolean(createSession?.favoritePartial),
            onNavigateBack: () => focusPreviousField(field.field),
            onNavigateKeyDown: event => handleFieldKeyDown(event, field.field, '', surface),
            onControlFocus: () => {
                markSurface(surface);
                dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
            },
            onRemove: () => removeOption(field.field, surface),
        }),
        favorite: field => ({
            ref: element => {
                fieldRefs.current.panel[field.field] = element;
            },
            type: 'button',
            className: 'website-popup-create-side-panel__favorite-button',
            'data-selected': getValue(field.field) === 'enabled' ? 'true' : 'false',
            'aria-label': getValue(field.field) === 'enabled' ? 'Remove from Favorites' : 'Add to Favorites',
            'aria-pressed': getValue(field.field) === 'enabled',
            onFocus: () => {
                markSurface('panel');
                dispatch({ type: 'CREATE_FIELD_FOCUSED', field: field.field });
            },
            onKeyDown: event => {
                if ((event.key === 'Backspace' || event.key === 'Delete') && getValue(field.field) === 'enabled') {
                    event.preventDefault();
                    event.stopPropagation();
                    dispatch({ type: 'CREATE_OPTION_REMOVED', field: field.field });
                    writeWebsitePopupCreateField(store, grammar, field.field, '');
                    return;
                }
                handleFieldKeyDown(event, field.field, '', 'panel');
            },
            onClick: () => {
                const selected = store.getState().state.createSession?.fieldValues[field.field] === 'enabled';
                dispatch(selected
                    ? { type: 'CREATE_OPTION_REMOVED', field: field.field }
                    : { type: 'CREATE_OPTION_ADDED', field: field.field, preserveFocus: true });
                writeWebsitePopupCreateField(store, grammar, field.field, selected ? '' : 'enabled');
            },
        }),
        onRemove: (field, surface) => {
            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
            removeOption(field.field, surface);
        },
    };
    return { grammar, createSession, standalone, requiredFields, optionalViews, propertyAdapter, composerRef, propertyCommandRef, isPropertyFieldVisible, propertyFocusTarget, activeField, markSurface, handleFieldKeyDown, dispatch };
}

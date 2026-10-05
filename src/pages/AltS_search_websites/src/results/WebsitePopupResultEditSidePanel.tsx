import { findNextSelectableWebsitePopupRowIndex } from './websitePopupResultsNavigation';
import { buildDraft, getRecord, buildWebsitePopupResultEditChanges, type EditDraft } from './websitePopupResultEditDraft';
import { WEBSITE_POPUP_ENTITY_SOURCES } from '../../../../shared-components/websitePopup/websitePopupEntityRecords';
import { removeLastWebsitePopupMultiSelectValue, toggleWebsitePopupMultiSelectValue } from '../interaction/websitePopupMultiSelectController';
import { useWebsitePopupPickerOptions } from '../create/useWebsitePopupPickerOptions';
/** Result-only editor. It never changes the search route or the Create session. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, } from 'react';
import { createPortal } from 'react-dom';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import { createWebsitePopupTag, } from '../bridge/websitePopupCreateOptionsBridge';
import { useWebsitePopupItemHotkey } from './useWebsitePopupItemHotkey';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupResultEditTarget } from '../display/websitePopupDisplayTypes';
import type { WebsitePopupResultEditChanges } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { WebsitePopupCreateSidePanel } from '../create/WebsitePopupCreateSidePanel';
import { WebsitePopupPropertyField, type WebsitePopupPropertyDataAdapter } from '../create/WebsitePopupPropertyField';
import { getWebsitePopupMultiSelectPresentation } from '../create/websitePopupCreateFieldPolicy';
import { getWebsitePopupResultPropertyGrammar } from './websitePopupResultPropertyGrammar';
import { WebsitePopupResults } from '../display/WebsitePopupResults';
import { buildWebsitePopupCreateLinkUrlSections, normalizeWebsitePopupManualUrl, normalizeWebsitePopupUrlIdentity, } from '../create/websitePopupCreateLinkUrlCatalog';
import { buildWebsitePopupCreatePropertySections } from '../create/websitePopupCreatePropertyCatalog';
import { validateWebsitePopupTextCommand } from '../bridge/websitePopupTextCommandBridge';
import type { WebsitePopupTextCommandConflict } from '../../../../shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
import type { WebsitePopupCreateFieldGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupTodoAttachmentType, } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import type { WebsitePopupResolvedSection } from './websitePopupResultsTypes';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
import { WebsitePopupModelSelectionField } from '../create/WebsitePopupModelSelectionField';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
const toLocalDateTime = (time: number) => {
    if (!time)
        return '';
    const date = new Date(time);
    if (Number.isNaN(date.getTime()))
        return '';
    return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function WebsitePopupResultEditSidePanel({ target, snapshot, onClose, }: {
    target: WebsitePopupResultEditTarget;
    snapshot: WebsitePopupSearchSnapshot;
    onClose: () => void;
}) {
    // Freeze the version opened by right-click. A background refresh must not
    // silently replace the revision checked when Save is pressed.
    const [record] = useState(() => getRecord(snapshot, target));
    const [initial] = useState<EditDraft | null>(() => (record ? buildDraft(record, target.entity) : null));
    const [draft, setDraft] = useState<EditDraft | null>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [favorite, setFavorite] = useState<boolean | null>(null);
    const [favoritePending, setFavoritePending] = useState(false);
    const hotkeyController = useWebsitePopupItemHotkey(target);
    const { saved: hotkey, draft: hotkeyDraft, captureActive: hotkeyCaptureActive,
        pending: hotkeyPending, conflict: hotkeyConflict, error: hotkeyError,
        persist: persistHotkey, commit: commitHotkey } = hotkeyController;
    const panelRef = useRef<HTMLElement | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);
    const shortcutAssignment = snapshot.shortcuts.find(shortcut => (shortcut.referenceType === target.entity ||
        (target.entity === 'prompt' && shortcut.referenceType === 'aiPrompt') ||
        (target.entity === 'collection' && ['session', 'workspace'].includes(shortcut.referenceType))) &&
        (shortcut.referenceId === target.targetId ||
            extractSnippetIdFromCompoundId(shortcut.referenceId) === target.targetId));
    const textCommandTarget = {
        entity: target.entity,
        targetId: target.targetId,
        referenceId: shortcutAssignment?.referenceId || target.targetId,
        value: String(shortcutAssignment?.trigger || record?.shortcut || '').replace(/^\/+/, ''),
        title: draft?.title || WEBSITE_POPUP_ENTITY_SOURCES[target.entity].label,
    };
    const grammar = useMemo(() => getWebsitePopupResultPropertyGrammar(target.entity), [target.entity]);
    const [propertiesTarget, setPropertiesTarget] = useState<HTMLDivElement | null>(null);
    const [pickerTarget, setPickerTarget] = useState<HTMLDivElement | null>(null);
    const [saveTarget, setSaveTarget] = useState<HTMLDivElement | null>(null);
    const [activeField, setActiveField] = useState<string | null>(null);
    const [pickerField, setPickerField] = useState<string | null>(null);
    const [queries, setQueries] = useState<Record<string, string>>({});
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [createdTags, setCreatedTags] = useState<WebsitePopupSearchSnapshot['tags']>([]);
    const [shortcutValue, setShortcutValue] = useState(textCommandTarget.value);
    const [shortcutSaved, setShortcutSaved] = useState(textCommandTarget.value);
    const [shortcutPending, setShortcutPending] = useState(false);
    const [shortcutConflict, setShortcutConflict] = useState<WebsitePopupTextCommandConflict | null>(null);
    const [shortcutError, setShortcutError] = useState<string | null>(null);
    const shortcutPendingRef = useRef(false);
    const savePendingRef = useRef(false);
    const pickerSelectionExplicit = useRef(false);
    const restoringFieldFocus = useRef(false);
    const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
    const mountPanel = useCallback((element: HTMLElement | null) => {
        panelRef.current = element;
    }, []);
    useEffect(() => {
        if (propertiesTarget)
            formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }, [propertiesTarget]);
    const pickerQuery = pickerField ? queries[pickerField] || '' : '';
    const pickerSource = grammar.fields.find(field => field.field === pickerField)?.source;
    const pickerOptions = useWebsitePopupPickerOptions(pickerSource === 'browserLinks', target.entity === 'todo', pickerQuery);
    const { items: openTabs } = pickerOptions.tabs;
    const { items: suggestions } = pickerOptions.urls;
    const { items: attachments } = pickerOptions.attachments;
    useEffect(() => { setSelectedIndex(0); pickerSelectionExplicit.current = false; }, [pickerField, pickerQuery, openTabs, suggestions]);
    useEffect(() => {
        const failure = pickerOptions.tabs.error || pickerOptions.urls.error || pickerOptions.attachments.error;
        if (failure)
            setError(failure);
    }, [pickerOptions.tabs.error, pickerOptions.urls.error, pickerOptions.attachments.error]);
    useEffect(() => {
        let active = true;
        void executeWebsitePopupBridgeOperation({
            kind: 'get-result-favorite',
            entity: target.entity,
            targetId: target.targetId,
        })
            .then(outcome => {
            if (active && outcome.status === 'favorite-state')
                setFavorite(outcome.favorite);
        })
            .catch(failure => {
            if (active)
                setError(failure instanceof Error ? failure.message : String(failure));
        });
        return () => {
            active = false;
        };
    }, [target.entity, target.targetId]);
    const toggleFavorite = async () => {
        if (favorite === null || favoritePending)
            return;
        setFavoritePending(true);
        setError(null);
        try {
            const outcome = await executeWebsitePopupBridgeOperation({
                kind: 'set-result-favorite',
                entity: target.entity,
                targetId: target.targetId,
                favorite: !favorite,
            });
            if (outcome.status !== 'favorite-updated')
                throw new Error('Favorite was not updated.');
            setFavorite(outcome.favorite);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            setFavoritePending(false);
        }
    };
    function set<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
        setDraft(current => (current ? { ...current, [key]: value } : current));
        setError(null);
    }
    const entityDirty = Boolean(initial && draft && JSON.stringify(initial) !== JSON.stringify(draft));
    const dirty = entityDirty || shortcutValue !== shortcutSaved;
    const persistTextCommand = async (approval?: WebsitePopupTextCommandConflict): Promise<boolean> => {
        if (shortcutPendingRef.current)
            return false;
        if (shortcutValue === shortcutSaved)
            return true;
        const value = shortcutValue;
        shortcutPendingRef.current = true;
        setShortcutPending(true);
        setShortcutError(null);
        try {
            if (value.trim() && !approval) {
                const check = await validateWebsitePopupTextCommand(value, textCommandTarget.referenceId);
                if (check.status === 'error') {
                    setShortcutError(check.message);
                    return false;
                }
                if (check.status === 'conflict') {
                    setShortcutConflict(check.conflict);
                    setShortcutError(check.message);
                    return false;
                }
            }
            const outcome = await executeWebsitePopupBridgeOperation({
                kind: 'update-item-text-command',
                entity: target.entity,
                targetId: target.targetId,
                value,
                approval,
                expectedValue: shortcutSaved,
                expectedReferenceId: textCommandTarget.referenceId,
            });
            if (outcome.status !== 'text-command-updated')
                throw new Error('Unable to update the Text Command.');
            setShortcutSaved(outcome.value);
            setShortcutValue(current => (current === value ? outcome.value : current));
            setShortcutConflict(null);
            return true;
        }
        catch (failure) {
            setShortcutError(failure instanceof Error ? failure.message : String(failure));
            return false;
        }
        finally {
            shortcutPendingRef.current = false;
            setShortcutPending(false);
        }
    };
    const openFullEditor = async () => {
        if (target.entity === 'bookmark')
            return;
        if (dirty) {
            setError('Save or cancel these changes before opening the full editor.');
            return;
        }
        try {
            const outcome = await executeWebsitePopupBridgeOperation({
                kind: 'open-entity-editor',
                entity: target.entity,
                targetId: target.targetId,
            });
            if (outcome.status !== 'entity-opened')
                throw new Error('The full editor did not open.');
            onClose();
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
    };
    const save = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!draft || !initial || !record || savePendingRef.current || !dirty || !draft.title.trim())
            return;
        let changes: WebsitePopupResultEditChanges;
        try {
            changes = buildWebsitePopupResultEditChanges(initial, draft, target.entity);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
            return;
        }
        setSaving(true);
        savePendingRef.current = true;
        setError(null);
        try {
            if (!(await persistTextCommand()))
                return;
            if (!entityDirty) {
                onClose();
                return;
            }
            const outcome = await executeWebsitePopupBridgeOperation({
                kind: 'update-result-entity',
                entity: target.entity,
                targetId: target.targetId,
                expectedUpdatedAt: record.updatedAt,
                expectedBookmark: target.entity === 'bookmark' ? { title: record.title || '', url: record.url || '' } : undefined,
                changes,
            });
            if (outcome.status !== 'entity-updated')
                throw new Error('The item was not updated.');
            onClose();
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            savePendingRef.current = false;
            setSaving(false);
        }
    };
    const hasContent = target.entity !== 'link' && target.entity !== 'bookmark' && target.entity !== 'collection';
    const tags = [
        ...snapshot.tags,
        ...createdTags.filter(tag => !snapshot.tags.some(existing => existing.id === tag.id))
    ];
    const selectedValuesByField: Record<string, WebsitePopupCreateSelectedValue[]> = {};
    for (const field of grammar.fields) {
        if (field.source === 'browserLinks')
            selectedValuesByField[field.field] = (draft?.urls || []).map((row, index) => ({
                id: row.id || `url:${index}:${row.url}`,
                label: row.title || row.url,
                serializedValue: row.url,
                kind: 'url',
                url: row.url,
                source: row.source === 'tab' ? 'tab' : 'custom',
                favIconUrl: row.favIconUrl,
            }));
        if (field.source === 'tags')
            selectedValuesByField[field.field] = (draft?.tagIds || []).map(id => {
                const tag = tags.find(item => item.id === id);
                return {
                    id,
                    label: tag?.name || id,
                    serializedValue: tag?.name || id,
                    kind: 'tag',
                    workspaceId: tag?.workspaceId,
                };
            });
        if (field.source === 'attachments')
            selectedValuesByField[field.field] = (draft?.references || []).map(ref => ({
                id: `${ref.type}:${ref.id}`,
                label: ref.name || attachments.find(item => item.id === ref.id && item.type === ref.type)?.label || ref.id,
                serializedValue: ref.name || ref.id,
                kind: 'reference',
                referenceType: ref.type as WebsitePopupTodoAttachmentType,
                targetId: ref.id,
            }));
        if (field.source === 'recurring') {
            const value = draft?.scheduleType === 'recurring' ? draft.recurringType || 'daily' : 'one-time';
            selectedValuesByField[field.field] = [
                {
                    id: value,
                    serializedValue: value,
                    label: value === 'one-time' ? 'Once' : value.replace(/^./, char => char.toUpperCase()),
                }
            ];
        }
        if (field.source === 'time') {
            const value = toLocalDateTime(draft?.scheduleTime || 0).replace('T', ' ');
            selectedValuesByField[field.field] = value
                ? [{ id: value, serializedValue: value, label: new Date(draft!.scheduleTime!).toLocaleString() }]
                : [];
        }
    }
    const writeSelections = (field: WebsitePopupCreateFieldGrammar, values: WebsitePopupCreateSelectedValue[]) => {
        if (field.source === 'tags')
            set('tagIds', values.map(value => value.id));
        if (field.source === 'attachments')
            set('references', values.map(value => ({
                type: value.referenceType!,
                id: value.targetId!,
                name: value.label,
            })));
        if (field.source === 'browserLinks') {
            const previous = selectedValuesByField[field.field] || [];
            set('urls', values.map(value => {
                const index = previous.findIndex(item => item.id === value.id);
                return index >= 0
                    ? draft!.urls![index]
                    : {
                        id: '',
                        title: value.label,
                        url: value.url || value.serializedValue,
                        source: value.source,
                        favIconUrl: value.favIconUrl,
                    };
            }));
        }
        if (field.source === 'time')
            set('scheduleTime', values.length ? new Date(values[0].serializedValue.replace(' ', 'T')).getTime() : 0);
        if (field.source === 'recurring') {
            const value = values[0]?.serializedValue || 'one-time';
            setDraft(current => current
                ? {
                    ...current,
                    scheduleType: value === 'one-time' ? 'one-time' : 'recurring',
                    recurringType: value === 'one-time' ? undefined : (value as 'daily' | 'weekly' | 'monthly'),
                }
                : current);
            setError(null);
        }
    };
    const changeQuery = (field: string, value: string) => {
        pickerSelectionExplicit.current = false;
        setQueries(current => ({ ...current, [field]: value }));
        setSelectedIndex(0);
    };
    const focusField = (field: WebsitePopupCreateFieldGrammar, picker: boolean) => {
        setActiveField(field.field);
        if (restoringFieldFocus.current)
            return;
        if (pickerField !== field.field)
            pickerSelectionExplicit.current = false;
        setPickerField(picker ? field.field : null);
    };
    const focusNext = (field: string, reverse = false) => {
        setPickerField(null);
        const next = grammar.fields[grammar.fields.findIndex(item => item.field === field) + (reverse ? -1 : 1)];
        window.requestAnimationFrame(() => {
            if (next) {
                const slot = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-field-id]') || []).find(element => element.dataset.fieldId === next.field);
                (fieldRefs.current[next.field] || slot?.querySelector<HTMLElement>('input, button'))?.focus({
                    preventScroll: true,
                });
            }
            else
                saveTarget?.querySelector<HTMLButtonElement>('.website-popup-create-footer__save')?.focus();
        });
    };
    const sections: WebsitePopupResolvedSection[] = !pickerField
        ? []
        : pickerSource === 'browserLinks'
            ? buildWebsitePopupCreateLinkUrlSections({
                openTabs,
                suggestions,
                query: pickerQuery,
                selectedValues: selectedValuesByField[pickerField] || [],
            })
            : buildWebsitePopupCreatePropertySections({
                grammar,
                fieldId: pickerField,
                query: pickerQuery,
                snapshot: { ...snapshot, tags },
                attachments,
                selectedValuesByField,
            });
    const rows = sections.flatMap(section => section.rows);
    const activateRow = async (index: number) => {
        const row = rows[index];
        const field = grammar.fields.find(item => item.field === pickerField);
        if (!field || !row || row.disabled)
            return;
        const intent = row.intent;
        if (intent.kind === 'create-tag') {
            try {
                const tag = await createWebsitePopupTag(intent.name);
                setCreatedTags(current => [...current.filter(item => item.id !== tag.id), tag]);
                setDraft(current => current ? { ...current, tagIds: [...new Set([...(current.tagIds || []), tag.id])] } : current);
                changeQuery(field.field, '');
            }
            catch (failure) {
                setError(failure instanceof Error ? failure.message : String(failure));
            }
            return;
        }
        if (intent.kind !== 'create-property-select')
            return;
        const selected = selectedValuesByField[field.field] || [];
        const value: WebsitePopupCreateSelectedValue = {
            id: intent.optionId,
            label: intent.label,
            serializedValue: intent.serializedValue,
            ...intent.selection,
        };
        const next = toggleWebsitePopupMultiSelectValue(selected, value, intent.multiple);
        writeSelections(field, field.source === 'browserLinks' && target.entity === 'bookmark' ? [value] : next);
        changeQuery(field.field, '');
        if (!intent.multiple)
            setPickerField(null);
        restoringFieldFocus.current = true;
        fieldRefs.current[field.field]?.focus({ preventScroll: true });
        restoringFieldFocus.current = false;
    };
    const handlePropertyKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>, field: WebsitePopupCreateFieldGrammar) => {
        const query = queries[field.field] || '';
        const selections = selectedValuesByField[field.field] || [];
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (pickerField) {
                setPickerField(null);
                changeQuery(field.field, '');
            }
            else
                onClose();
            return;
        }
        if ((event.key === 'Backspace' || event.key === 'Delete') && !query && selections.length) {
            event.preventDefault();
            event.stopPropagation();
            writeSelections(field, field.kind === 'multiSelect' ? removeLastWebsitePopupMultiSelectValue(selections) : []);
            return;
        }
        if (pickerField === field.field && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            pickerSelectionExplicit.current = true;
            event.preventDefault();
            event.stopPropagation();
            if (rows.length)
                setSelectedIndex(current => findNextSelectableWebsitePopupRowIndex(rows, current, event.key === 'ArrowDown' ? 'next' : 'previous'));
            return;
        }
        if (event.key === 'Enter' && pickerField === field.field) {
            event.preventDefault();
            event.stopPropagation();
            const manual = field.source === 'browserLinks' && !pickerSelectionExplicit.current
                ? normalizeWebsitePopupManualUrl(query)
                : null;
            if (manual) {
                if (!selections.some(value => normalizeWebsitePopupUrlIdentity(value.url || value.serializedValue) ===
                    normalizeWebsitePopupUrlIdentity(manual))) {
                    const value: WebsitePopupCreateSelectedValue = {
                        id: `url:${manual}`,
                        label: manual,
                        serializedValue: manual,
                        kind: 'url',
                        url: manual,
                        source: 'custom',
                    };
                    writeSelections(field, target.entity === 'bookmark' ? [value] : [...selections, value]);
                }
                changeQuery(field.field, '');
            }
            else
                void activateRow(Math.min(selectedIndex, rows.length - 1));
        }
        if (event.key === 'Tab' && pickerField)
            setPickerField(null);
    };
    const propertyAdapter: WebsitePopupPropertyDataAdapter = {
        isActive: field => field.field === activeField,
        onSurfaceFocus: () => undefined,
        multiSelect: field => ({
            ...getWebsitePopupMultiSelectPresentation(field)!,
            values: selectedValuesByField[field.field] || [],
            query: pickerField === field.field ? queries[field.field] || '' : '',
            inputRef: element => {
                fieldRefs.current[field.field] = element;
            },
            onFocus: () => focusField(field, true),
            onQueryChange: value => changeQuery(field.field, value),
            onKeyDown: event => handlePropertyKeyDown(event, field),
            onRemove: id => writeSelections(field, (selectedValuesByField[field.field] || []).filter(value => value.id !== id)),
        }),
        optional: field => ({
            removeLabel: `Remove ${field.label} option`,
            onNavigateBack: () => focusNext(field.field, true),
            onRemove: () => writeSelections(field, []),
        }),
        input: field => ({
            ref: element => {
                fieldRefs.current[field.field] = element;
            },
            value: field.source === 'shortcut'
                ? shortcutValue
                : field.source === 'recurring' || pickerField !== field.field
                    ? selectedValuesByField[field.field]?.[0]?.label || ''
                    : queries[field.field] || '',
            stableValue: field.source === 'shortcut' ? shortcutValue : selectedValuesByField[field.field]?.[0]?.label,
            disabled: field.source === 'shortcut' && shortcutPending,
            'aria-invalid': field.source === 'shortcut' && Boolean(shortcutError),
            onFocus: () => focusField(field, field.kind === 'singleSelect'),
            onChange: event => {
                if (field.source === 'shortcut') {
                    setShortcutValue(event.currentTarget.value);
                    setShortcutConflict(null);
                    setShortcutError(null);
                }
                else
                    changeQuery(field.field, event.currentTarget.value);
            },
            onKeyDown: event => {
                if (field.source === 'shortcut' && event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    void persistTextCommand();
                }
                else
                    handlePropertyKeyDown(event, field);
            },
        }),
        favorite: field => ({
            ref: element => {
                fieldRefs.current[field.field] = element;
            },
            disabled: favorite === null || favoritePending,
            'data-selected': favorite ? 'true' : 'false',
            'aria-label': favorite ? 'Remove from Favorites' : 'Add to Favorites',
            'aria-pressed': Boolean(favorite),
            onFocus: () => focusField(field, false),
            onClick: () => void toggleFavorite(),
            onKeyDown: event => {
                if ((event.key === 'Backspace' || event.key === 'Delete') && favorite) {
                    event.preventDefault();
                    event.stopPropagation();
                    void toggleFavorite();
                }
            },
        }),
        hotkey: field => ({
            active: hotkeyCaptureActive,
            disabled: hotkey === null || hotkeyPending,
            value: hotkeyDraft,
            onFocus: () => focusField(field, false),
            onChange: value => {
                hotkeyController.changeDraft(value);
                if (!hotkeyCaptureActive && !value && hotkey)
                    void persistHotkey('');
            },
            onCaptureStateChange: hotkeyController.onCaptureStateChange,
            onCommit: reverse => {
                void commitHotkey();
                focusNext(field.field, reverse);
            },
            onCancel: hotkeyController.cancel,
            onRemove: () => {
                hotkeyController.stopCapture();
                void persistHotkey('');
            },
            onReRecord: () => {
                focusField(field, false);
                hotkeyController.startCapture();
            },
            onNavigateBack: () => focusNext(field.field, true),
            onEscape: hotkeyController.stopCapture,
        }),
        onRemove: field => writeSelections(field, []),
    };
    return (<>
      <WebsitePopupCreateSidePanel grammar={grammar} label={`Edit ${WEBSITE_POPUP_ENTITY_SOURCES[target.entity].label}`} onPanelMount={mountPanel} onCollapse={() => {
            if (pickerField) {
                setPickerField(null);
                return;
            }
            if (hotkeyCaptureActive) {
                hotkeyController.cancel();
                return;
            }
            onClose();
        }} onPropertiesMount={setPropertiesTarget} onPickerMount={setPickerTarget} activePickerField={pickerField} onSaveMount={setSaveTarget}>
      </WebsitePopupCreateSidePanel>
      {propertiesTarget
            ? createPortal(<form ref={formRef} id="website-popup-result-edit-form" className="website-popup-create-side-panel__selected-properties" onSubmit={event => void save(event)} onKeyDownCapture={event => {
                    if (event.key === 'Enter' &&
                        (event.ctrlKey || event.metaKey) &&
                        !(event.target instanceof HTMLElement && event.target.closest('[data-hotkey-capture]'))) {
                        event.preventDefault();
                        event.stopPropagation();
                        void save();
                    }
                }}>
              {!draft ? (<p role="alert">This item is no longer available in the search results.</p>) : (<>
                  <label className="website-popup-result-edit-panel__field">
                    <span>Title</span>
                    <input value={draft.title} onChange={event => set('title', event.currentTarget.value)} onKeyDown={event => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                            event.preventDefault();
                            void save();
                        }
                    }}/>
                  </label>
                  {hasContent ? (<label className="website-popup-result-edit-panel__field">
                      <span>
                        {target.entity === 'note'
                            ? 'Body'
                            : target.entity === 'snippet'
                                ? 'Content'
                                : target.entity === 'prompt' || target.entity === 'agent'
                                    ? 'Prompt'
                                    : 'Description'}
                      </span>
                      <textarea rows={3} value={draft.content || ''} onChange={event => set('content', event.currentTarget.value)}/>
                    </label>) : null}
                  {target.entity === 'prompt' || target.entity === 'agent' ? (<WebsitePopupModelSelectionField value={draft} disabled={saving} onChange={value => { setDraft(current => current ? { ...current, ...value } : current); setError(null); }}/>) : null}
                  {grammar.fields.map(field => (<WebsitePopupPropertyField key={field.field} field={field} adapter={propertyAdapter}/>))}
                  {target.entity === 'todo' ? (<label className="website-popup-result-edit-panel__check">
                      <input type="checkbox" checked={draft.isDone} onChange={event => set('isDone', event.currentTarget.checked)}/>{' '}
                      Completed
                    </label>) : null}
                  {target.entity === 'prompt' ? (<>
                      <label className="website-popup-result-edit-panel__field">
                        <span>Rules</span>
                        <textarea rows={3} value={draft.rules || ''} onChange={event => set('rules', event.currentTarget.value)}/>
                      </label>
                    </>) : null}
                  {shortcutConflict ? (<>
                    <button type="button" className="website-popup-result-edit-panel__secondary" disabled={shortcutPending} onClick={() => { setShortcutValue(shortcutSaved); setShortcutConflict(null); setShortcutError(null); }}>Cancel</button>
                    {shortcutConflict.canShare ? <button type="button" className="website-popup-result-edit-panel__secondary" disabled={shortcutPending} onClick={() => void persistTextCommand({ ...shortcutConflict, mode: 'add' })}>Assign to this item too</button> : null}
                    <button type="button" className="website-popup-result-edit-panel__secondary" disabled={shortcutPending} onClick={() => void persistTextCommand(shortcutConflict)}>
                      Overwrite Text Command
                    </button>
                    </>) : null}
                  {shortcutError ? (<p className="website-popup-result-edit-panel__error" role="alert">
                      {shortcutError}
                    </p>) : null}
                  {hotkeyConflict ? (<button type="button" className="website-popup-result-edit-panel__secondary" disabled={hotkeyPending || hotkeyController.checking} onMouseDown={event => event.preventDefault()} onClick={() => void persistHotkey(hotkeyDraft, hotkeyConflict)}>
                      Overwrite Hotkey
                    </button>) : null}
                  {hotkeyError ? (<p className="website-popup-result-edit-panel__error" role="alert">
                      {hotkeyError}
                    </p>) : null}
                  {hotkey === null && hotkeyError ? <button type="button" className="website-popup-result-edit-panel__secondary"
                    disabled={hotkeyPending} onClick={() => void hotkeyController.refresh()}>Retry Hotkey</button> : null}
                  {target.entity !== 'bookmark' ? (<button type="button" className="website-popup-result-edit-panel__secondary" onClick={() => void openFullEditor()}>
                      Open full editor
                    </button>) : null}
                  {error ? (<p className="website-popup-result-edit-panel__error" role="alert">
                      {error}
                    </p>) : null}
                </>)}
            </form>, propertiesTarget)
            : null}
      {pickerTarget && pickerField
            ? createPortal(<WebsitePopupResults sections={sections.map(section => ({
                    ...section,
                    rows: section.rows.map(row => ({
                        ...row,
                        selected: rows.indexOf(row) === Math.min(selectedIndex, rows.length - 1),
                    })),
                }))} ariaLabel={`${grammar.fields.find(field => field.field === pickerField)?.label || 'Property'} options`} emptyState="No matching options" showHeadings={false} onRowSelectionRequest={index => {
                    pickerSelectionExplicit.current = true;
                    setSelectedIndex(index);
                }} onRowActivationRequest={index => void activateRow(index)}/>, pickerTarget)
            : null}
      {saveTarget
            ? createPortal(<div className="website-popup-create-side-panel__save-target website-popup-result-edit-panel__footer">
              <button type="button" className="website-popup-result-edit-panel__secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" form="website-popup-result-edit-form" className="website-popup-create-footer__save" disabled={!draft ||
                    !dirty ||
                    saving ||
                    shortcutPending ||
                    favoritePending ||
                    hotkeyPending ||
                    hotkeyCaptureActive ||
                    !draft.title.trim()}>
                {saving || shortcutPending ? 'Saving…' : 'Save'}
              </button>
            </div>, saveTarget)
            : null}
    </>);
}

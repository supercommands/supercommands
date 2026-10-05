/**
 * Bridge-snapshot adapters for active popup Create property modes.
 *
 * The catalog returns neutral display rows with local draft intents only. It
 * neither imports IndexedDB nor writes a record; the results wrapper commits
 * selections to the centralized Create session.
 */
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import { buildWebsitePopupTagSections } from './websitePopupTagCatalog';
import { WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES, type WebsitePopupAttachmentOption, } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import { WebsitePopupAttachmentIcon } from './WebsitePopupAttachmentIcon';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
import { getCreateComposerPropertyIcon } from '../../../../shared-components/commandTerminal/chaining/createComposer/createComposerIcons';
import { getWebsitePopupCreatePropertyFields } from './websitePopupCreatePropertyCommand';
import type { WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
import { displayDateFormatted, formatLocalISODate, isPastDueDateInput, parseDueDateInput, } from '../../../../allObjectFolder/src/createObject/todos/utils/dueDateParser';
const matches = (query: string, ...values: unknown[]) => {
    const tokens = String(query || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    const searchableValues = values.map(value => String(value || '').toLowerCase());
    return tokens.length === 0 || tokens.every(token => searchableValues.some(value => value.includes(token)));
};
/** Builds the grammar-owned Option chooser without entering a value picker. */
export function buildWebsitePopupCreateOptionSections({ grammar, query, addedFields, }: {
    grammar: WebsitePopupCreateEntityGrammar;
    query: string;
    addedFields: readonly string[];
}): WebsitePopupResolvedSection[] {
    const added = new Set(addedFields);
    const rows = getWebsitePopupCreatePropertyFields(grammar)
        .filter(field => !added.has(field.field))
        .filter(field => matches(query, field.label, field.primaryPrefix, ...field.prefixes, field.description))
        .sort((left, right) => left.sequence - right.sequence)
        .map(field => ({
        id: `create-option:${field.field}`,
        iconTone: 'option' as const,
        icon: getCreateComposerPropertyIcon({
            key: field.field,
            label: field.label,
            prefix: field.primaryPrefix,
        }),
        title: field.source === 'favorite'
            ? 'Add to Favorites'
            : field.label.replace(/\b\w/g, character => character.toUpperCase()),
        detail: field.description,
        trailing: field.primaryPrefix,
        trailingTone: 'key' as const,
        intent: { kind: 'create-option-add' as const, field: field.field },
    }));
    return rows.length ? [{ id: 'create-options', label: 'Options', rows }] : [];
}
export function buildWebsitePopupCreatePropertySections({ grammar, fieldId, query, snapshot, attachments = [], selectedValuesByField, }: {
    grammar: WebsitePopupCreateEntityGrammar;
    fieldId: string;
    query: string;
    snapshot: WebsitePopupSearchSnapshot;
    attachments?: readonly WebsitePopupAttachmentOption[];
    selectedValuesByField?: Record<string, WebsitePopupCreateSelectedValue[]>;
}): WebsitePopupResolvedSection[] {
    const field = grammar.fields.find(candidate => candidate.field === fieldId);
    if (!field)
        return [];
    const multiple = field.kind === 'multiSelect';
    const createRow = (id: string, title: string, detail?: string, disabled = false, value = title, checked = false, selection?: {
        kind: 'tag';
        workspaceId: string | null;
    } | {
        kind: 'reference';
        referenceType: WebsitePopupAttachmentOption['type'];
        targetId: string;
    }) => ({
        id: `create-property:${field.field}:${id}`,
        title,
        detail,
        trailing: !multiple && checked ? 'Selected' : undefined,
        checkable: multiple,
        checked,
        intent: {
            kind: 'create-property-select' as const,
            field: field.field,
            optionId: id,
            label: title,
            serializedValue: value,
            multiple,
            ...(selection ? { selection } : {}),
        },
        disabled,
    });
    if (field.source === 'tags') {
        return buildWebsitePopupTagSections({ fieldId: field.field, query, tags: snapshot.tags,
            selected: selectedValuesByField?.[field.field], multiple });
    }
    if (field.source === 'browserLinks') {
        const rows = snapshot.links
            .filter(link => matches(query, link.title, ...link.urls.map(item => item.url)))
            .map(link => createRow(link.id, link.urls[0]?.url || link.title, link.title));
        return rows.length ? [{ id: `create-property-${field.field}`, label: field.label, rows }] : [];
    }
    if (field.source === 'attachments') {
        const categories = WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES;
        const selected = selectedValuesByField?.[field.field] || [];
        const selectedKeys = new Set(selected.map(value => value.id));
        const availableSections = categories.flatMap(category => {
            const rows = attachments
                .filter(item => item.type === category.type)
                .filter(item => matches(query, item.label, item.detail, category.label))
                .map(item => ({
                ...createRow(`${item.type}:${item.id}`, item.label, item.detail, false, item.label, selectedKeys.has(`${item.type}:${item.id}`), {
                    kind: 'reference' as const,
                    referenceType: item.type,
                    targetId: item.id,
                }),
                icon: <WebsitePopupAttachmentIcon type={category.type}/>,
            }));
            return rows.length ? [{ id: `create-reference-${category.type}`, label: category.label, rows }] : [];
        });
        const visibleIds = new Set(availableSections.flatMap(section => section.rows.map(row => row.intent.optionId)));
        const selectedRows = selected
            .filter(value => value.kind === 'reference' && value.referenceType && value.targetId
            && categories.some(category => category.type === value.referenceType)
            && !visibleIds.has(value.id))
            .map(value => ({
            ...createRow(value.id, value.label, value.referenceType, false, value.serializedValue, true, {
                kind: 'reference' as const,
                referenceType: value.referenceType!,
                targetId: value.targetId!,
            }),
            icon: value.referenceType
                ? <WebsitePopupAttachmentIcon type={value.referenceType}/>
                : undefined,
        }));
        return [...availableSections, ...(selectedRows.length
                ? [{ id: 'create-reference-selected', label: 'Selected Attachments', rows: selectedRows }]
                : [])];
    }
    if (field.source === 'favorite') {
        const rows = [
            createRow('enabled', 'Add to Favorites'),
            createRow('disabled', 'Remove from Favorites')
        ].filter(row => matches(query, row.title, row.intent.serializedValue));
        return rows.length ? [{ id: `create-property-${field.field}`, label: field.label, rows }] : [];
    }
    if (field.source === 'recurring') {
        const current = selectedValuesByField?.recurring?.[0]?.serializedValue;
        const rows = [
            createRow('one-time', 'Once', undefined, false, 'one-time', current === 'one-time'),
            createRow('daily', 'Daily', undefined, false, 'daily', current === 'daily'),
            createRow('weekly', 'Weekly', undefined, false, 'weekly', current === 'weekly'),
            createRow('monthly', 'Monthly', undefined, false, 'monthly', current === 'monthly')
        ].filter(row => matches(query, row.title, row.intent.serializedValue));
        return rows.length ? [{ id: `create-property-${field.field}`, label: field.label, rows }] : [];
    }
    if (field.source === 'time') {
        const trimmedQuery = String(query || '').trim();
        const now = new Date();
        const current = selectedValuesByField?.time?.[0]?.serializedValue;
        if (!trimmedQuery) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const inOneWeek = new Date(now);
            inOneWeek.setDate(inOneWeek.getDate() + 7);
            return [{
                    id: `create-property-${field.field}`,
                    label: field.label,
                    rows: [
                        createRow('tomorrow', 'Tomorrow', displayDateFormatted(tomorrow), false, formatLocalISODate(tomorrow), current === formatLocalISODate(tomorrow)),
                        createRow('in-one-week', 'In one week', displayDateFormatted(inOneWeek), false, formatLocalISODate(inOneWeek), current === formatLocalISODate(inOneWeek))
                    ],
                }];
        }
        const parsed = parseDueDateInput(trimmedQuery, { now });
        if (parsed.valid) {
            const value = parsed.value.time ? `${parsed.value.date} ${parsed.value.time}` : parsed.value.date;
            return [{
                    id: `create-property-${field.field}`,
                    label: field.label,
                    rows: [createRow('parsed', parsed.label, parsed.secondaryLabel, false, value, current === value)],
                }];
        }
        const label = parsed.reason === 'past' || isPastDueDateInput(trimmedQuery, now)
            ? 'No past due dates'
            : 'No matching date';
        return [{
                id: `create-property-${field.field}`,
                label: field.label,
                rows: [createRow('invalid', label, undefined, true)],
            }];
    }
    return [];
}

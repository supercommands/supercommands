import type { CommandTerminalPrefixes } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingRecord } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import { getQuickCreatePrefixLabels, getQuickCreatePrefixEntries, parseEntitySubcommandFields, type SubcommandField, type SubcommandEntity, } from '../../triggers/subcommandFieldParser';
export type EditorEntityType = 'note' | 'link' | 'snippet' | 'todo';
/**
 * Fields supported per entity type.
 * Note: title and description are strictly excluded for all editors
 * because they belong to the editor canvas/body directly.
 * Links also manage URLs directly on the editor canvas.
 */
export const ALLOWED_FIELDS_BY_EDITOR_ENTITY: Record<EditorEntityType, readonly SubcommandField[]> = {
    note: ['tag', 'hotkey', 'shortcut'],
    snippet: ['tag', 'hotkey', 'shortcut'],
    link: ['tag', 'hotkey', 'shortcut'],
    todo: ['time', 'recurring', 'reference', 'tag', 'hotkey', 'shortcut'],
};
export type EditorPropertyField = 'tag' | 'hotkey' | 'shortcut' | 'url' | 'time' | 'recurring' | 'reference';
export interface EditorPropertyPrefixOptions {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
}
export interface EditorPropertyValues {
    tagNames: string[];
    hotkey: string;
    shortcut: string;
    url?: string;
    time?: string;
    recurring?: string;
    reference?: string;
    presentFields: EditorPropertyField[];
}
/**
 * Returns primary prefix labels for the given editor entity.
 */
export function getEditorPrefixLabels(entity: EditorEntityType = 'note', options: EditorPropertyPrefixOptions = {}): Record<EditorPropertyField, string> {
    const allLabels = getQuickCreatePrefixLabels(entity as SubcommandEntity, options);
    return {
        tag: allLabels.tag,
        hotkey: allLabels.hotkey,
        shortcut: allLabels.shortcut,
        url: (allLabels as any).url || '-u',
        time: (allLabels as any).time || '-time',
        recurring: (allLabels as any).recurring || '-rec',
        reference: (allLabels as any).reference || '-ref',
    };
}
/**
 * Returns prefix entries for scanning markers and cursor tokens in editor palettes.
 */
export function getEditorPrefixEntries(entity: EditorEntityType = 'note', options: EditorPropertyPrefixOptions = {}): Array<{
    field: EditorPropertyField;
    prefix: string;
}> {
    const allowed = new Set(ALLOWED_FIELDS_BY_EDITOR_ENTITY[entity]);
    const allEntries = getQuickCreatePrefixEntries(entity as SubcommandEntity, options);
    return allEntries.filter((entry): entry is {
        field: EditorPropertyField;
        prefix: string;
    } => allowed.has(entry.field as SubcommandField));
}
/**
 * Parses user input in the editor property palette according to entity type.
 */
export function parseEditorPropertyInput(entity: EditorEntityType = 'note', input: string, options: EditorPropertyPrefixOptions = {}): EditorPropertyValues {
    const parsed = parseEntitySubcommandFields(entity as SubcommandEntity, input, options);
    const allowed = new Set(ALLOWED_FIELDS_BY_EDITOR_ENTITY[entity]);
    const presentFields: EditorPropertyField[] = (parsed.presentFields as SubcommandField[])
        .filter(f => allowed.has(f)) as EditorPropertyField[];
    return {
        tagNames: parsed.tagNames || [],
        hotkey: parsed.hotkey || '',
        shortcut: parsed.shortcut || '',
        url: (parsed as any).url || ((parsed as any).urls ? (parsed as any).urls.join(', ') : ''),
        time: (parsed as any).time || '',
        recurring: (parsed as any).recurring || '',
        reference: (parsed as any).reference || '',
        presentFields,
    };
}
/**
 * Identifies the next missing property field to cycle to on Shift press.
 */
export function getNextEditorMissingField(entity: EditorEntityType = 'note', presentFields: EditorPropertyField[], labels: Record<EditorPropertyField, string>): {
    field: EditorPropertyField;
    prefix: string;
    label: string;
} | null {
    const allowed = ALLOWED_FIELDS_BY_EDITOR_ENTITY[entity];
    const sequence: Array<{
        field: EditorPropertyField;
        prefix: string;
        label: string;
    }> = [];
    allowed.forEach(f => {
        if (f === 'time')
            sequence.push({ field: 'time', prefix: labels.time, label: 'due date / time' });
        else if (f === 'recurring')
            sequence.push({ field: 'recurring', prefix: labels.recurring, label: 'recurring' });
        else if (f === 'reference')
            sequence.push({ field: 'reference', prefix: labels.reference, label: 'references' });
        else if (f === 'url')
            sequence.push({ field: 'url', prefix: labels.url, label: 'url' });
        else if (f === 'tag')
            sequence.push({ field: 'tag', prefix: labels.tag, label: 'tags' });
        else if (f === 'hotkey')
            sequence.push({ field: 'hotkey', prefix: labels.hotkey, label: 'hotkey' });
        else if (f === 'shortcut')
            sequence.push({ field: 'shortcut', prefix: labels.shortcut, label: 'text command' });
    });
    const presentSet = new Set(presentFields);
    return sequence.find(entry => String(entry.prefix || '').trim() && !presentSet.has(entry.field));
}
/**
 * Formats current editor properties into the initial input string.
 */
export function formatEditorPropertiesToInput({ entity = 'note', tagNames, hotkey, shortcut, url, time, recurring, reference, labels, }: {
    entity?: EditorEntityType;
    tagNames?: string[];
    hotkey?: string;
    shortcut?: string;
    url?: string;
    time?: string;
    recurring?: string;
    reference?: string;
    labels: Record<EditorPropertyField, string>;
}): string {
    const parts: string[] = [];
    const allowed = new Set(ALLOWED_FIELDS_BY_EDITOR_ENTITY[entity]);
    if (allowed.has('time') && time && time.trim()) {
        parts.push(`${labels.time} ${time.trim()}`);
    }
    if (allowed.has('recurring') && recurring && recurring.trim()) {
        parts.push(`${labels.recurring} ${recurring.trim()}`);
    }
    if (allowed.has('reference') && reference && reference.trim()) {
        parts.push(`${labels.reference} ${reference.trim()}`);
    }
    if (allowed.has('url') && url && url.trim()) {
        parts.push(`${labels.url} ${url.trim()}`);
    }
    if (allowed.has('tag') && tagNames && tagNames.length > 0) {
        parts.push(`${labels.tag} ${tagNames.join(', ')}`);
    }
    if (allowed.has('hotkey') && hotkey && hotkey.trim()) {
        parts.push(`${labels.hotkey} ${hotkey.trim()}`);
    }
    if (allowed.has('shortcut') && shortcut && shortcut.trim()) {
        parts.push(`${labels.shortcut} ${shortcut.trim()}`);
    }
    return parts.join(' ');
}

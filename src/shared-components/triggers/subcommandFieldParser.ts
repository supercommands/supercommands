import { DEFAULT_COMMAND_TERMINAL_PREFIXES, getFixedCommandChainFieldPrefixes, type CommandChainFieldKey, type CommandTerminalPrefixes, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import type { PrefixSettingRecord, PrefixSettingSubcommand } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export type SubcommandEntity = 'note' | 'link' | 'todo' | 'snippet' | 'collection' | 'prompt' | 'agent';
export type SubcommandField = 'title' | 'description' | 'url' | 'tag' | 'hotkey' | 'shortcut' | 'time' | 'recurring' | 'reference' | 'favorite';
export type QuickCreateFieldConfig = {
    field: SubcommandField;
    label: string;
    required?: boolean;
};
export type NoteQuickCreateFields = {
    entity: 'note';
    hasCreateIntent: boolean;
    presentFields: SubcommandField[];
    title: string;
    description: string;
    urls: string[];
    tagNames: string[];
    hotkey: string;
    shortcut: string;
    isFavorite: boolean;
    searchText: string;
};
export type EntitySubcommandFields = {
    entity: SubcommandEntity;
    hasCreateIntent: boolean;
    presentFields: SubcommandField[];
    title: string;
    description: string;
    urls: string[];
    tagNames: string[];
    hotkey: string;
    shortcut: string;
    time: string;
    recurring: string;
    reference: string;
    isFavorite: boolean;
    searchText: string;
};
export type TodoQuickCreateFields = EntitySubcommandFields & {
    entity: 'todo';
};
const QUICK_CREATE_FIELD_CONFIG_BY_ENTITY: Record<SubcommandEntity, readonly QuickCreateFieldConfig[]> = {
    note: [
        { field: 'title', label: 'title', required: true },
        { field: 'description', label: 'description', required: true },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' },
        { field: 'shortcut', label: 'text command' },
        { field: 'favorite', label: 'favorite' }
    ],
    todo: [
        { field: 'title', label: 'title', required: true },
        { field: 'description', label: 'description', required: true },
        { field: 'recurring', label: 'recurring' },
        { field: 'time', label: 'time' },
        { field: 'reference', label: 'attach' },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' },
        { field: 'shortcut', label: 'text command' },
        { field: 'favorite', label: 'favorite' }
    ],
    snippet: [
        { field: 'title', label: 'title', required: true },
        { field: 'description', label: 'description', required: true },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' },
        { field: 'shortcut', label: 'text command' },
        { field: 'favorite', label: 'favorite' }
    ],
    link: [
        { field: 'title', label: 'title', required: true },
        { field: 'url', label: 'url', required: true },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' },
        { field: 'shortcut', label: 'text command' },
        { field: 'favorite', label: 'favorite' }
    ],
    collection: [
        { field: 'title', label: 'title', required: true },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' }
    ],
    prompt: [
        { field: 'title', label: 'title', required: true },
        { field: 'description', label: 'description' },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' }
    ],
    agent: [
        { field: 'title', label: 'title', required: true },
        { field: 'description', label: 'prompt' },
        { field: 'tag', label: 'tags' },
        { field: 'hotkey', label: 'hotkey' },
        { field: 'shortcut', label: 'text command' },
        { field: 'favorite', label: 'favorite' }
    ],
};
export const getQuickCreateFieldConfigs = (entity: SubcommandEntity): readonly QuickCreateFieldConfig[] => QUICK_CREATE_FIELD_CONFIG_BY_ENTITY[entity] || [];
export const getQuickCreateAllowedFields = (entity: SubcommandEntity): readonly SubcommandField[] => getQuickCreateFieldConfigs(entity).map(config => config.field);
export const isQuickCreateFieldAllowed = (entity: SubcommandEntity, field: SubcommandField): boolean => getQuickCreateAllowedFields(entity).includes(field);
const FAVORITE_CREATE_FIELD_PREFIXES: Array<{
    field: SubcommandField;
    prefix: string;
}> = [
    { field: 'favorite', prefix: '-favorite' },
    { field: 'favorite', prefix: '-fav' }
];
const normalizePrefix = (value: unknown) => String(value || '')
    .trim()
    .toLowerCase();
const FIELD_BY_SETTING: Partial<Record<PrefixSettingSubcommand, SubcommandField>> = {
    field_title: 'title',
    field_title_long: 'title',
    field_title_alias_name: 'title',
    field_title_alias_plain: 'title',
    field_description: 'description',
    field_description_long: 'description',
    field_description_alias_desc: 'description',
    field_description_alias_body: 'description',
    field_url: 'url',
    field_url_long: 'url',
    field_tag: 'tag',
    field_tag_plural: 'tag',
    field_hotkey: 'hotkey',
    field_hotkey_long: 'hotkey',
    field_shortcut: 'shortcut',
    field_shortcut_long: 'shortcut',
    field_time: 'time',
    field_recurring: 'recurring',
    field_recurring_long: 'recurring',
    field_reference: 'reference',
    field_reference_attach: 'reference',
    field_reference_attachment: 'reference',
    field_reference_long: 'reference',
};
const DEFAULT_FIELD_PREFIXES: Array<{
    category: PrefixSettingSubcommand;
    field: SubcommandField;
    prefix: string;
}> = [
    { category: 'field_title', field: 'title', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_title },
    { category: 'field_title_long', field: 'title', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_title_long },
    { category: 'field_title_alias_name', field: 'title', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_title_alias_name },
    { category: 'field_title_alias_plain', field: 'title', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_title_alias_plain },
    { category: 'field_description', field: 'description', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_description },
    { category: 'field_description_long', field: 'description', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_description_long },
    { category: 'field_description_alias_desc', field: 'description', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_description_alias_desc },
    { category: 'field_description_alias_body', field: 'description', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_description_alias_body },
    { category: 'field_url', field: 'url', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_url },
    { category: 'field_url_long', field: 'url', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_url_long },
    { category: 'field_tag', field: 'tag', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_tag },
    { category: 'field_tag_plural', field: 'tag', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_tag_plural },
    { category: 'field_hotkey', field: 'hotkey', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_hotkey },
    { category: 'field_hotkey_long', field: 'hotkey', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_hotkey_long },
    { category: 'field_shortcut', field: 'shortcut', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_shortcut },
    { category: 'field_shortcut_long', field: 'shortcut', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_shortcut_long },
    { category: 'field_time', field: 'time', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_time },
    { category: 'field_recurring', field: 'recurring', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_recurring },
    { category: 'field_recurring_long', field: 'recurring', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_recurring_long },
    { category: 'field_reference', field: 'reference', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_reference },
    { category: 'field_reference_attach', field: 'reference', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_reference_attach },
    { category: 'field_reference_attachment', field: 'reference', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_reference_attachment },
    { category: 'field_reference_long', field: 'reference', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_reference_long }
];
const PRIMARY_FIELD_SETTINGS = new Set<PrefixSettingSubcommand>([
    'field_title',
    'field_description',
    'field_url',
    'field_tag',
    'field_hotkey',
    'field_shortcut',
    'field_time',
    'field_recurring',
    'field_reference'
]);
const isCurrentSubcommandPrefix = (prefix: string) => {
    return prefix.startsWith('-') && !prefix.startsWith('--');
};
const getFieldPrefixes = (entity: SubcommandEntity, prefixSettings?: PrefixSettingRecord[] | null, prefixes?: Partial<CommandTerminalPrefixes> | null): Array<{
    field: SubcommandField;
    prefix: string;
}> => {
    const allowedFields = new Set(getQuickCreateAllowedFields(entity));
    const defaults = DEFAULT_FIELD_PREFIXES.filter(entry => PRIMARY_FIELD_SETTINGS.has(entry.category)).map(entry => {
        const configuredPrimaryPrefix = (prefixes as any)?.[entry.category];
        return {
            field: entry.field,
            prefix: normalizePrefix(configuredPrimaryPrefix || entry.prefix),
        };
    }).filter(entry => entry.prefix && allowedFields.has(entry.field) && isCurrentSubcommandPrefix(entry.prefix));
    const fixedAliases = Array.from(allowedFields)
        .filter((field): field is CommandChainFieldKey => field !== 'favorite')
        .flatMap(field => getFixedCommandChainFieldPrefixes(field).map(prefix => ({
        field,
        prefix: normalizePrefix(prefix),
    })));
    const rows = Array.isArray(prefixSettings) ? prefixSettings : [];
    const configured = rows
        .filter(row => row.enabled && row.type === 'subcommand')
        .map(row => {
        const field = FIELD_BY_SETTING[row.category as PrefixSettingSubcommand];
        return field
            ? {
                field,
                prefix: normalizePrefix(row.prefix),
            }
            : null;
    })
        .filter((entry): entry is {
        field: SubcommandField;
        prefix: string;
    } => Boolean(entry?.prefix && allowedFields.has(entry.field) && isCurrentSubcommandPrefix(entry.prefix)));
    const seen = new Set<string>();
    return [...configured, ...defaults, ...fixedAliases]
        .filter(entry => {
        const key = `${entry.field}:${entry.prefix}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .sort((a, b) => b.prefix.length - a.prefix.length);
};
export function getQuickCreatePrefixLabels(entity: SubcommandEntity, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): Record<SubcommandField, string> {
    const labels: Record<SubcommandField, string> = {
        title: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_title,
        description: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_description,
        url: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_url,
        tag: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_tag,
        hotkey: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_hotkey,
        shortcut: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_shortcut,
        time: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_time,
        recurring: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_recurring,
        reference: DEFAULT_COMMAND_TERMINAL_PREFIXES.field_reference,
        favorite: '-fav',
    };
    const primarySettingByField: Partial<Record<SubcommandField, PrefixSettingSubcommand>> = {
        title: 'field_title',
        description: 'field_description',
        url: 'field_url',
        tag: 'field_tag',
        hotkey: 'field_hotkey',
        shortcut: 'field_shortcut',
        time: 'field_time',
        recurring: 'field_recurring',
        reference: 'field_reference',
    };
    const allowedFields = new Set(getQuickCreateAllowedFields(entity));
    Object.entries(primarySettingByField).forEach(([field, category]) => {
        if (!category || !allowedFields.has(field as SubcommandField))
            return;
        const configured = options.prefixSettings?.find(row => row.enabled && row.type === 'subcommand' && row.category === category);
        const prefix = normalizePrefix(configured?.prefix || (options.prefixes as any)?.[category] || labels[field as SubcommandField]);
        if (prefix && isCurrentSubcommandPrefix(prefix))
            labels[field as SubcommandField] = prefix;
    });
    return labels;
}
export function getQuickCreatePrefixList(entity: SubcommandEntity, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): string[] {
    return getQuickCreatePrefixEntries(entity, options).map(entry => entry.prefix);
}
export function getQuickCreatePrefixEntries(entity: SubcommandEntity, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): Array<{
    field: SubcommandField;
    prefix: string;
}> {
    const entries = [
        ...getFieldPrefixes(entity, options.prefixSettings, options.prefixes),
        ...(isQuickCreateFieldAllowed(entity, 'favorite') ? FAVORITE_CREATE_FIELD_PREFIXES : [])
    ];
    const seen = new Set<string>();
    return entries
        .map(entry => ({ ...entry, prefix: normalizePrefix(entry.prefix) }))
        .filter(entry => {
        if (!entry.prefix || !isCurrentSubcommandPrefix(entry.prefix))
            return false;
        const key = `${entry.field}:${entry.prefix}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .sort((a, b) => b.prefix.length - a.prefix.length);
}
/**
 * Returns the currently enabled Create prefixes without compatibility defaults.
 * popup uses this for optional-field availability while required fields retain
 * their existing command-chain fallback behavior.
 */
export function getEnabledQuickCreatePrefixEntries(entity: SubcommandEntity, prefixSettings: readonly PrefixSettingRecord[]): Array<{
    field: SubcommandField;
    prefix: string;
}> {
    const allowedFields = new Set(getQuickCreateAllowedFields(entity));
    const configured = prefixSettings.flatMap(row => {
        if (!row.enabled || row.type !== 'subcommand')
            return [];
        const field = FIELD_BY_SETTING[row.category as PrefixSettingSubcommand];
        const prefix = normalizePrefix(row.prefix);
        return field && allowedFields.has(field) && isCurrentSubcommandPrefix(prefix)
            ? [{ field, prefix }]
            : [];
    });
    const favorite = allowedFields.has('favorite') ? FAVORITE_CREATE_FIELD_PREFIXES : [];
    const seen = new Set<string>();
    return [...configured, ...favorite].filter(entry => {
        const key = `${entry.field}:${entry.prefix}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
export function getNoteQuickCreatePrefixLabels(options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): Record<SubcommandField, string> {
    return getQuickCreatePrefixLabels('note', options);
}
const resolveFieldPrefixToken = (source: string, lower: string, index: number, fieldPrefixes: Array<{
    field: SubcommandField;
    prefix: string;
}>): {
    field: SubcommandField;
    prefix: string;
    tokenEnd: number;
} | null => {
    const tokenEnd = (() => {
        for (let cursor = index; cursor < source.length; cursor += 1) {
            if (/\s/.test(source[cursor]))
                return cursor;
        }
        return source.length;
    })();
    const token = lower.slice(index, tokenEnd);
    if (!token.startsWith('-') || token.length <= 1)
        return null;
    const exactMatches = fieldPrefixes.filter(entry => entry.prefix === token);
    const exactFields = Array.from(new Set(exactMatches.map(entry => entry.field)));
    if (exactFields.length === 1) {
        const field = exactFields[0];
        return field ? { field, prefix: token, tokenEnd } : null;
    }
    if (exactFields.length > 1)
        return null;
    if (tokenEnd === source.length)
        return null;
    const partialMatches = fieldPrefixes.filter(entry => entry.prefix.startsWith(token));
    const partialFields = Array.from(new Set(partialMatches.map(entry => entry.field)));
    if (partialFields.length !== 1)
        return null;
    const field = partialFields[0];
    return field ? { field, prefix: token, tokenEnd } : null;
};
const tokenizeFields = (input: string, fieldPrefixes: Array<{
    field: SubcommandField;
    prefix: string;
}>) => {
    const markers: Array<{
        field: SubcommandField;
        prefix: string;
        start: number;
        valueStart: number;
    }> = [];
    const draftBoundaries: number[] = [];
    const source = String(input || '');
    const lower = source.toLowerCase();
    for (let index = 0; index < source.length; index += 1) {
        if (index > 0 && !/\s/.test(source[index - 1]))
            continue;
        const marker = resolveFieldPrefixToken(source, lower, index, fieldPrefixes);
        if (!marker) {
            const tokenEnd = (() => {
                for (let cursor = index; cursor < source.length; cursor += 1) {
                    if (/\s/.test(source[cursor]))
                        return cursor;
                }
                return source.length;
            })();
            const token = lower.slice(index, tokenEnd);
            if (tokenEnd === source.length &&
                token.startsWith('-') &&
                token.length > 1 &&
                fieldPrefixes.some(entry => entry.prefix.startsWith(token))) {
                draftBoundaries.push(index);
                index += Math.max(tokenEnd - index - 1, 0);
            }
            continue;
        }
        markers.push({
            field: marker.field,
            prefix: marker.prefix,
            start: index,
            valueStart: marker.tokenEnd,
        });
        index += Math.max(marker.tokenEnd - index - 1, 0);
    }
    return markers.map((marker, index) => {
        const next = markers[index + 1];
        const draftBoundary = draftBoundaries.find(start => start > marker.start && (!next || start < next.start));
        return {
            field: marker.field,
            value: source.slice(marker.valueStart, draftBoundary ?? next?.start ?? source.length).trim(),
        };
    });
};
export function parseEntitySubcommandFields(entity: SubcommandEntity, input: string, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): EntitySubcommandFields {
    const fieldPrefixes = [
        ...getQuickCreatePrefixEntries(entity, options)
    ].sort((a, b) => b.prefix.length - a.prefix.length);
    const fields = tokenizeFields(input, fieldPrefixes);
    const hasCreateIntent = fields.length > 0;
    const presentFields = Array.from(new Set(fields.map(field => field.field)));
    const titleParts: string[] = [];
    const descriptionParts: string[] = [];
    const urlParts: string[] = [];
    const tagParts: string[] = [];
    const hotkeyParts: string[] = [];
    const shortcutParts: string[] = [];
    const timeParts: string[] = [];
    const recurringParts: string[] = [];
    const referenceParts: string[] = [];
    let isFavorite = false;
    fields.forEach(field => {
        if (field.field === 'favorite') {
            isFavorite = true;
            return;
        }
        if (!field.value)
            return;
        if (field.field === 'title')
            titleParts.push(field.value);
        else if (field.field === 'description')
            descriptionParts.push(field.value);
        else if (field.field === 'url')
            urlParts.push(field.value);
        else if (field.field === 'tag')
            tagParts.push(field.value);
        else if (field.field === 'hotkey')
            hotkeyParts.push(field.value);
        else if (field.field === 'shortcut')
            shortcutParts.push(field.value);
        else if (field.field === 'time')
            timeParts.push(field.value);
        else if (field.field === 'recurring')
            recurringParts.push(field.value);
        else if (field.field === 'reference')
            referenceParts.push(field.value);
    });
    const title = titleParts.join(' ').trim();
    const description = descriptionParts.join('\n').trim();
    const seenUrls = new Set<string>();
    const urls = urlParts
        .join('\n')
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean)
        .filter(url => {
        const key = url.toLowerCase();
        if (seenUrls.has(key))
            return false;
        seenUrls.add(key);
        return true;
    });
    const time = timeParts.join(' ').trim();
    const hotkey = hotkeyParts.join(' ').trim();
    const shortcut = shortcutParts.join(' ').trim();
    const recurring = recurringParts.join(' ').trim();
    const reference = referenceParts.join(' ').trim();
    const seenTagNames = new Set<string>();
    const tagNames = tagParts
        .join(',')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .filter(tag => {
        const key = tag.toLowerCase();
        if (seenTagNames.has(key))
            return false;
        seenTagNames.add(key);
        return true;
    });
    return {
        entity,
        hasCreateIntent,
        presentFields,
        title,
        description,
        urls,
        tagNames,
        hotkey,
        shortcut,
        time,
        recurring,
        reference,
        isFavorite,
        searchText: hasCreateIntent ? title || description || urls.join(' ') || time || recurring || reference || hotkey || shortcut || tagNames.join(' ') : String(input || '').trim(),
    };
}
export function parseNoteQuickCreateFields(input: string, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): NoteQuickCreateFields {
    return parseEntitySubcommandFields('note', input, options) as NoteQuickCreateFields;
}
export function parseTodoQuickCreateFields(input: string, options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CommandTerminalPrefixes> | null;
} = {}): TodoQuickCreateFields {
    return parseEntitySubcommandFields('todo', input, options) as TodoQuickCreateFields;
}

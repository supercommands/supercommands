import {
  DEFAULT_OMNIBOX_PREFIXES,
  type CustomOmniboxPrefixes,
} from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import type { PrefixSettingRecord, PrefixSettingSubcommand } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';

export type SubcommandEntity = 'note' | 'link' | 'todo' | 'snippet' | 'collection' | 'prompt';
export type SubcommandField = 'title' | 'description' | 'tag' | 'time' | 'recurring' | 'reference';

export type NoteQuickCreateFields = {
  entity: 'note';
  hasCreateIntent: boolean;
  presentFields: SubcommandField[];
  title: string;
  description: string;
  tagNames: string[];
  searchText: string;
};

export type EntitySubcommandFields = {
  entity: SubcommandEntity;
  hasCreateIntent: boolean;
  presentFields: SubcommandField[];
  title: string;
  description: string;
  tagNames: string[];
  time: string;
  recurring: string;
  reference: string;
  searchText: string;
};

export type TodoQuickCreateFields = EntitySubcommandFields & {
  entity: 'todo';
};

const FIELD_BY_SETTING: Record<PrefixSettingSubcommand, SubcommandField> = {
  field_title: 'title',
  field_description: 'description',
  field_tag: 'tag',
  field_time: 'time',
  field_recurring: 'recurring',
  field_reference: 'reference',
};

const ALLOWED_FIELDS_BY_ENTITY: Record<SubcommandEntity, readonly SubcommandField[]> = {
  note: ['title', 'description', 'tag'],
  todo: ['title', 'description', 'recurring', 'time', 'reference', 'tag'],
  snippet: ['title', 'description', 'tag'],
  collection: ['title', 'tag'],
  prompt: ['title', 'description', 'tag'],
  link: ['title', 'tag'],
};

const normalizePrefix = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const getFieldPrefixes = (
  entity: SubcommandEntity,
  prefixSettings?: PrefixSettingRecord[] | null,
  prefixes?: Partial<CustomOmniboxPrefixes> | null,
): Array<{ field: SubcommandField; prefix: string }> => {
  const allowedFields = new Set(ALLOWED_FIELDS_BY_ENTITY[entity]);
  const defaults = [
    { field: 'description' as const, prefix: normalizePrefix(prefixes?.field_description || DEFAULT_OMNIBOX_PREFIXES.field_description) },
    { field: 'title' as const, prefix: normalizePrefix(prefixes?.field_title || DEFAULT_OMNIBOX_PREFIXES.field_title) },
    { field: 'tag' as const, prefix: normalizePrefix(prefixes?.field_tag || DEFAULT_OMNIBOX_PREFIXES.field_tag) },
    { field: 'time' as const, prefix: normalizePrefix(prefixes?.field_time || DEFAULT_OMNIBOX_PREFIXES.field_time) },
    { field: 'recurring' as const, prefix: normalizePrefix(prefixes?.field_recurring || DEFAULT_OMNIBOX_PREFIXES.field_recurring) },
    { field: 'reference' as const, prefix: normalizePrefix(prefixes?.field_reference || DEFAULT_OMNIBOX_PREFIXES.field_reference) },
  ].filter(entry => entry.prefix && allowedFields.has(entry.field));
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
    .filter((entry): entry is { field: SubcommandField; prefix: string } =>
      Boolean(entry?.prefix && allowedFields.has(entry.field)),
    );

  const mergedByField = new Map<SubcommandField, string>();
  defaults.forEach(entry => mergedByField.set(entry.field, entry.prefix));
  configured.forEach(entry => mergedByField.set(entry.field, entry.prefix));

  return Array.from(mergedByField.entries())
    .map(([field, prefix]) => ({ field, prefix }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
};

export function getQuickCreatePrefixLabels(
  entity: SubcommandEntity,
  options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CustomOmniboxPrefixes> | null;
  } = {},
): Record<SubcommandField, string> {
  return getFieldPrefixes(entity, options.prefixSettings, options.prefixes).reduce<Record<SubcommandField, string>>(
    (labels, entry) => {
      if (!labels[entry.field]) labels[entry.field] = entry.prefix;
      return labels;
    },
    {
      title: DEFAULT_OMNIBOX_PREFIXES.field_title,
      description: DEFAULT_OMNIBOX_PREFIXES.field_description,
      tag: DEFAULT_OMNIBOX_PREFIXES.field_tag,
      time: DEFAULT_OMNIBOX_PREFIXES.field_time,
      recurring: DEFAULT_OMNIBOX_PREFIXES.field_recurring,
      reference: DEFAULT_OMNIBOX_PREFIXES.field_reference,
    },
  );
}

export function getNoteQuickCreatePrefixLabels(
  options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CustomOmniboxPrefixes> | null;
  } = {},
): Record<SubcommandField, string> {
  return getQuickCreatePrefixLabels('note', options);
}

const tokenizeFields = (input: string, fieldPrefixes: Array<{ field: SubcommandField; prefix: string }>) => {
  const markers: Array<{ field: SubcommandField; prefix: string; start: number; valueStart: number }> = [];
  const source = String(input || '');
  const lower = source.toLowerCase();

  for (let index = 0; index < source.length; index += 1) {
    if (index > 0 && !/\s/.test(source[index - 1])) continue;
    for (const entry of fieldPrefixes) {
      if (!lower.startsWith(entry.prefix, index)) continue;
      const nextChar = source[index + entry.prefix.length];
      if (nextChar !== undefined && !/\s/.test(nextChar)) continue;
      markers.push({
        field: entry.field,
        prefix: entry.prefix,
        start: index,
        valueStart: index + entry.prefix.length,
      });
      index += Math.max(entry.prefix.length - 1, 0);
      break;
    }
  }

  return markers.map((marker, index) => {
    const next = markers[index + 1];
    return {
      field: marker.field,
      value: source.slice(marker.valueStart, next?.start ?? source.length).trim(),
    };
  });
};

export function parseEntitySubcommandFields(
  entity: SubcommandEntity,
  input: string,
  options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CustomOmniboxPrefixes> | null;
  } = {},
): EntitySubcommandFields {
  const fieldPrefixes = getFieldPrefixes(entity, options.prefixSettings, options.prefixes);
  const fields = tokenizeFields(input, fieldPrefixes);
  const hasCreateIntent = fields.length > 0;
  const presentFields = Array.from(new Set(fields.map(field => field.field)));
  const titleParts: string[] = [];
  const descriptionParts: string[] = [];
  const tagParts: string[] = [];
  const timeParts: string[] = [];
  const recurringParts: string[] = [];
  const referenceParts: string[] = [];

  fields.forEach(field => {
    if (!field.value) return;
    if (field.field === 'title') titleParts.push(field.value);
    else if (field.field === 'description') descriptionParts.push(field.value);
    else if (field.field === 'tag') tagParts.push(field.value);
    else if (field.field === 'time') timeParts.push(field.value);
    else if (field.field === 'recurring') recurringParts.push(field.value);
    else if (field.field === 'reference') referenceParts.push(field.value);
  });

  const title = titleParts.join(' ').trim();
  const description = descriptionParts.join('\n').trim();
  const time = timeParts.join(' ').trim();
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
      if (seenTagNames.has(key)) return false;
      seenTagNames.add(key);
      return true;
    });

  return {
    entity,
    hasCreateIntent,
    presentFields,
    title,
    description,
    tagNames,
    time,
    recurring,
    reference,
    searchText: hasCreateIntent ? title || description || time || recurring || reference || tagNames.join(' ') : String(input || '').trim(),
  };
}

export function parseNoteQuickCreateFields(
  input: string,
  options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CustomOmniboxPrefixes> | null;
  } = {},
): NoteQuickCreateFields {
  return parseEntitySubcommandFields('note', input, options) as NoteQuickCreateFields;
}

export function parseTodoQuickCreateFields(
  input: string,
  options: {
    prefixSettings?: PrefixSettingRecord[] | null;
    prefixes?: Partial<CustomOmniboxPrefixes> | null;
  } = {},
): TodoQuickCreateFields {
  return parseEntitySubcommandFields('todo', input, options) as TodoQuickCreateFields;
}

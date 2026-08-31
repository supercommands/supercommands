import {
  DEFAULT_OMNIBOX_PREFIXES,
  type CustomOmniboxPrefixes,
} from '../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import type { TriggerSource } from './types';

export type ShortcutCategoryFilter =
  | 'note'
  | 'link'
  | 'snippet'
  | 'collection'
  | 'agent'
  | 'prompt'
  | 'todo'
  | 'command'
  | 'system_command'
  | 'bookmark';

export type ParsedShortcutInvocation = {
  trigger: string;
  remainingInput: string;
  triggerSource: TriggerSource;
  categoryFilter: ShortcutCategoryFilter | null;
};

export type ShortcutPrefixConfig = Partial<CustomOmniboxPrefixes> | string | null | undefined;

const normalizePrefix = (value: string | null | undefined) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();

const getPrefixConfig = (prefixes?: ShortcutPrefixConfig): Required<CustomOmniboxPrefixes> => {
  if (typeof prefixes === 'string') {
    return { ...DEFAULT_OMNIBOX_PREFIXES, command: normalizePrefix(prefixes) || DEFAULT_OMNIBOX_PREFIXES.command };
  }
  return { ...DEFAULT_OMNIBOX_PREFIXES, ...(prefixes || {}) };
};

export function buildShortcutPrefixRegistry(prefixes?: ShortcutPrefixConfig): Record<string, ShortcutCategoryFilter> {
  const merged = getPrefixConfig(prefixes);
  const entries: Array<[ShortcutCategoryFilter, string | undefined]> = [
    ['system_command', merged.system_command],
    ['bookmark', merged.bookmark],
    ['snippet', merged.snippet],
    ['collection', merged.collection],
    ['command', merged.command],
    ['prompt', merged.prompt],
    ['agent', merged.agent],
    ['note', merged.note],
    ['link', merged.link],
    ['todo', merged.todo],
  ];

  return entries.reduce<Record<string, ShortcutCategoryFilter>>((registry, [category, prefix]) => {
    const normalized = normalizePrefix(prefix);
    if (normalized && !registry[normalized]) registry[normalized] = category;
    return registry;
  }, {});
}

export function getCommandSpacePrefix(prefixes?: ShortcutPrefixConfig): string {
  return normalizePrefix(getPrefixConfig(prefixes).command) || DEFAULT_OMNIBOX_PREFIXES.command;
}

export function parseShortcutInvocation(value: string, prefixes?: ShortcutPrefixConfig): ParsedShortcutInvocation {
  const normalizedValue = String(value || '').replace(/\u00A0/g, ' ').trim();
  const withoutLegacySlash = normalizedValue.replace(/^\/+/, '');
  const lower = withoutLegacySlash.toLowerCase();
  const commandPrefix = getCommandSpacePrefix(prefixes);

  if (lower === commandPrefix || lower.startsWith(`${commandPrefix} `)) {
    const rest = withoutLegacySlash.slice(commandPrefix.length).trim();
    const [firstToken, ...remaining] = rest.split(/\s+/).filter(Boolean);
    const prefixRegistry = buildShortcutPrefixRegistry(prefixes);
    const categoryFilter = firstToken ? prefixRegistry[normalizePrefix(firstToken)] || null : null;

    if (categoryFilter && remaining.length > 0) {
      const [triggerToken, ...promptParts] = remaining;
      return {
        trigger: normalizeShortcutTrigger(triggerToken),
        remainingInput: promptParts.join(' ').trim(),
        triggerSource: 'command_space',
        categoryFilter,
      };
    }

    const [triggerToken, ...promptParts] = rest.split(/\s+/).filter(Boolean);
    return {
      trigger: normalizeShortcutTrigger(triggerToken || ''),
      remainingInput: promptParts.join(' ').trim(),
      triggerSource: 'command_space',
      categoryFilter: null,
    };
  }

  const [triggerToken, ...promptParts] = withoutLegacySlash.split(/\s+/).filter(Boolean);
  return {
    trigger: normalizeShortcutTrigger(triggerToken || withoutLegacySlash),
    remainingInput: promptParts.join(' ').trim(),
    triggerSource: 'direct_search',
    categoryFilter: null,
  };
}

export function matchesShortcutCategory(referenceType: string, categoryFilter: string | null): boolean {
  if (!categoryFilter) return true;
  const type = String(referenceType || '').toLowerCase();
  const normalizedFilter =
    categoryFilter === 'agent' || categoryFilter === 'prompt' ? 'agent' :
    categoryFilter;

  if (normalizedFilter === 'agent') return ['agent', 'chat_agent', 'aiprompt', 'ai_prompt', 'prompt'].includes(type);
  if (normalizedFilter === 'command') return type === 'command' || type === 'module';
  if (normalizedFilter === 'note') return type === 'note' || type === 'notes';
  if (normalizedFilter === 'link') return type === 'link' || type === 'links';
  if (normalizedFilter === 'collection') return ['collection', 'collections', 'collection_view'].includes(type);
  if (normalizedFilter === 'snippet') return type === 'snippet' || type === 'snippets';
  if (normalizedFilter === 'todo') return type === 'todo' || type === 'todos';
  if (normalizedFilter === 'bookmark') return type === 'bookmark' || type === 'bookmarks';
  if (normalizedFilter === 'system_command') return type === 'system_command' || type === 'system';
  return true;
}

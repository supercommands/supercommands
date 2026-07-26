import type { CommandRecord } from '../../../../src/allObjectFolder/src/createObject/commands/commandTypes';
import type { CustomOmniboxPrefixes } from '../../../../src/storage/localStorage/customSearchPrefixesForOmniboxStorage';

export const DEFAULT_OMNIBOX_PREFIXES = {
  note: ['n', 'note'],
  link: ['l', 'link'],
  command: ['c', 'cmd', 'command'],
} as const;

export type ResolvedOmniboxInput = {
  prefix: string;
  type: 'note' | 'link' | 'command' | null;
  query: string;
};

export type OmniboxLocalData = {
  links: any[];
  notes: any[];
  commands: CommandRecord[];
  userShortcuts: any[];
};

export type LooseMatchKind = 'shortcut' | 'note' | 'link' | 'command';

export type LooseMatchCandidate = {
  kind: LooseMatchKind;
  rank: number;
  content: string;
  description: string;
  titleKey: string;
  target: any;
};

type LooseCandidateHandlers = {
  executeShortcut: (shortcut: any) => boolean;
  openNote: (noteId: string) => void;
  openUrls: (urls: string[]) => void;
  executeCommand: (command: CommandRecord) => void;
};

function normalizeOmniboxKey(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeShortcutTrigger(trigger: string) {
  return String(trigger || '')
    .trim()
    .toLowerCase();
}

export function extractSnippetId(compoundId: string): string {
  if (!compoundId || !compoundId.includes('-')) return compoundId;
  const parts = compoundId.split('-');
  return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
}

export function isSameSnippetIdentity(left: any, right: any): boolean {
  const leftId = normalizeOmniboxKey(left);
  const rightId = normalizeOmniboxKey(right);
  if (!leftId || !rightId) return false;

  if (leftId === rightId) return true;

  const leftSnippetId = extractSnippetId(leftId);
  const rightSnippetId = extractSnippetId(rightId);
  return leftSnippetId === rightSnippetId || leftSnippetId === rightId || leftId === rightSnippetId;
}

function resolveUniquePrefix(
  type: 'note' | 'link' | 'command',
  candidates: Array<string | null | undefined>,
  usedPrefixes: Set<string>,
): string {
  for (const candidate of candidates) {
    const normalized = normalizeOmniboxKey(candidate);
    if (!normalized) continue;
    if (usedPrefixes.has(normalized)) continue;

    usedPrefixes.add(normalized);
    return normalized;
  }

  const fallback =
    DEFAULT_OMNIBOX_PREFIXES[type].find(prefix => !usedPrefixes.has(prefix)) ?? `${type}-${usedPrefixes.size}`;
  usedPrefixes.add(fallback);
  return fallback;
}

export function buildRegistry(
  commands: CommandRecord[],
  customPrefixes: CustomOmniboxPrefixes | null,
): Record<string, 'note' | 'link' | 'command'> {
  let noteKey: string | null = null;
  let linkKey: string | null = null;
  let commandKey: string | null = null;

  for (const cmd of commands) {
    if (cmd.id === 'search_notes' && cmd.prefix && cmd.prefix.trim()) {
      noteKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    } else if (cmd.id === 'search_links' && cmd.prefix && cmd.prefix.trim()) {
      linkKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    } else if (cmd.id === 'search_commands' && cmd.prefix && cmd.prefix.trim()) {
      commandKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    }
  }

  if (customPrefixes?.note && customPrefixes.note.trim()) noteKey = customPrefixes.note.trim().toLowerCase();
  if (customPrefixes?.link && customPrefixes.link.trim()) linkKey = customPrefixes.link.trim().toLowerCase();
  if (customPrefixes?.command && customPrefixes.command.trim())
    commandKey = customPrefixes.command.trim().toLowerCase();

  const registry: Record<string, 'note' | 'link' | 'command'> = {};
  const usedPrefixes = new Set<string>();
  registry[resolveUniquePrefix('note', [noteKey, 'n', 'note'], usedPrefixes)] = 'note';
  registry[resolveUniquePrefix('link', [linkKey, 'l', 'link'], usedPrefixes)] = 'link';
  registry[resolveUniquePrefix('command', [commandKey, 'c', 'cmd', 'command'], usedPrefixes)] = 'command';

  return registry;
}

const isSymbolPrefix = (value: string) => /^[^a-z0-9]+$/i.test(value);

export function parseInput(text: string, registry: Record<string, 'note' | 'link' | 'command'>): ResolvedOmniboxInput {
  const trimmed = text.trim();
  if (!trimmed) return { prefix: '', type: null, query: '' };

  const candidatePrefixes = Object.keys(registry).sort((a, b) => b.length - a.length);
  const lowerTrimmed = trimmed.toLowerCase();

  for (const prefix of candidatePrefixes) {
    const lowerPrefix = prefix.toLowerCase();
    if (!lowerPrefix) continue;

    if (isSymbolPrefix(lowerPrefix)) {
      if (lowerTrimmed.startsWith(lowerPrefix)) {
        return {
          prefix,
          type: registry[prefix],
          query: trimmed.slice(prefix.length).trimStart(),
        };
      }
      continue;
    }

    if (lowerTrimmed === lowerPrefix) {
      return { prefix, type: registry[prefix], query: '' };
    }

    if (lowerTrimmed.startsWith(`${lowerPrefix} `)) {
      return {
        prefix,
        type: registry[prefix],
        query: trimmed.slice(prefix.length).trimStart(),
      };
    }
  }

  return { prefix: '', type: null, query: '' };
}

const rankByQuery = (value: string, query: string): number | null => {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();
  const normalizedQuery = String(query || '')
    .trim()
    .toLowerCase();
  if (!normalizedValue || !normalizedQuery) return null;
  if (normalizedValue === normalizedQuery) return 0;
  if (normalizedValue.startsWith(normalizedQuery)) return 1;
  if (normalizedQuery.length >= 2 && normalizedValue.includes(normalizedQuery)) return 2;
  return null;
};

const bestRankByQuery = (query: string, ...values: string[]) => {
  const ranks = values.map(value => rankByQuery(value, query)).filter((rank): rank is number => rank !== null);

  return ranks.length > 0 ? Math.min(...ranks) : null;
};

const getAssignedCommandIds = (userShortcuts: any[]) =>
  new Set(
    (userShortcuts || [])
      .filter((shortcut: any) => shortcut.referenceType === 'command')
      .map((shortcut: any) => String(shortcut.referenceId || '')),
  );

export function buildLooseCandidates(query: string, state: OmniboxLocalData): LooseMatchCandidate[] {
  const normalizedQuery = String(query || '')
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return [];

  const candidates: LooseMatchCandidate[] = [];
  const assignedCommandIds = getAssignedCommandIds(state.userShortcuts || []);

  for (const shortcut of state.userShortcuts || []) {
    const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
    const rank = rankByQuery(trigger, normalizedQuery);
    if (rank === null) continue;

    const targetTitle =
      shortcut.referenceType === 'note'
        ? (state.notes || []).find((n: any) => {
            const nid = n.id ?? '';
            return isSameSnippetIdentity(nid, shortcut.referenceId);
          })?.title || 'Untitled Note'
        : shortcut.referenceType === 'link'
          ? (state.links || []).find((l: any) => {
              const lid = l.id ?? l.snippet_id ?? '';
              return isSameSnippetIdentity(lid, shortcut.referenceId);
            })?.title || 'Untitled Link'
          : shortcut.referenceType === 'command'
            ? (state.commands || []).find(
                (command: any) => String(command.id || '') === String(shortcut.referenceId || ''),
              )?.label ||
              shortcut.referenceId ||
              'Untitled Command'
            : 'Untitled';
    const isCommandShortcut = shortcut.referenceType === 'command';

    candidates.push({
      kind: 'shortcut',
      rank: rank + (isCommandShortcut ? -30 : 0),
      content: trigger,
      description: `Shortcut: <match>${shortcut.trigger}</match> - ${isCommandShortcut ? 'Run command' : `Open ${shortcut.referenceType}`}: ${targetTitle}`,
      titleKey: targetTitle,
      target: shortcut,
    });
  }

  for (const note of state.notes || []) {
    const title = String(note.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;

    candidates.push({
      kind: 'note',
      rank: rank + 10,
      content: title,
      description: `Note: <match>${title || note.id || 'Untitled'}</match>`,
      titleKey: title,
      target: note,
    });
  }

  for (const link of state.links || []) {
    const title = String(link.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;

    candidates.push({
      kind: 'link',
      rank: rank + 10,
      content: title,
      description: `Link: <match>${title || link.id || 'Untitled'}</match>`,
      titleKey: title,
      target: link,
    });
  }

  for (const command of state.commands || []) {
    const label = String(command.label || '').trim();
    const prefix = String(command.prefix || '').trim();
    const id = String(command.id || '').trim();
    const rank = bestRankByQuery(normalizedQuery, label, prefix, id);
    if (rank === null || rank === undefined) continue;
    const hasAssignedShortcut = assignedCommandIds.has(id);

    candidates.push({
      kind: 'command',
      rank: rank + (hasAssignedShortcut ? 15 : 30),
      content: id,
      description: `${hasAssignedShortcut ? 'Assigned command' : 'Command'}: <match>${label || id}</match>`,
      titleKey: label || id,
      target: command,
    });
  }

  candidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.titleKey.length - b.titleKey.length;
  });

  return candidates;
}

export function runLooseCandidates(candidates: LooseMatchCandidate[], handlers: LooseCandidateHandlers): boolean {
  for (const candidate of candidates) {
    if (candidate.kind === 'shortcut') {
      if (handlers.executeShortcut(candidate.target)) {
        return true;
      }
      continue;
    }

    if (candidate.kind === 'note') {
      handlers.openNote(candidate.target.id);
      return true;
    }

    if (candidate.kind === 'link') {
      const urls = candidate.target?.urls;
      if (Array.isArray(urls) && urls.length > 0) {
        handlers.openUrls(urls);
        return true;
      }
      continue;
    }

    if (candidate.kind === 'command') {
      handlers.executeCommand(candidate.target as CommandRecord);
      return true;
    }
  }

  return false;
}

import { type CommandDefinition } from '../commandConfigurations/commands';
import { LOCAL_COMMANDS, type LocalCommandDefinition, type LocalCommandId } from '../commandConfigurations/localCommands';
import { LOCAL_COMMAND_KEYWORDS } from '../commandConfigurations/commandKeywords';

export type IndexedCommand =
  | {
      kind: 'remote';
      definition: CommandDefinition;
      tokens: string[];
      keywordTokens: Set<string>;
    }
  | {
      kind: 'local';
      definition: LocalCommandDefinition;
      tokens: string[];
      keywordTokens: Set<string>;
    };

export type CommandSearchResult =
  | {
      kind: 'remote';
      definition: CommandDefinition;
      score: number;
      matchedTokens: string[];
    }
  | {
      kind: 'local';
      definition: LocalCommandDefinition;
      score: number;
      matchedTokens: string[];
    };

export type ModuleSuggestionItem = {
  _kind: 'module';
  id: string;
  module: any;
};

export type ModuleGroupSuggestionItem = {
  _kind: 'module_group';
  id: string;
  name: string;
  iconHost: string;
  modules: any[];
};

export interface CommandSearchOptions {
  limit?: number;
  minScore?: number;
}

const DEFAULT_MIN_SCORE = 1;

const normalize = (value: string | null | undefined): string => {
  if (value == null) return '';
  if (typeof value !== 'string') return String(value).trim().toLowerCase();
  return value.trim().toLowerCase();
};

const splitIntoParts = (value: string): string[] =>
  value
    .split(/[^a-z0-9]+/i)
    .map(part => part.trim())
    .filter(Boolean);

const addToken = (set: Set<string>, raw: string | any) => {
  const normalized = normalize(typeof raw === 'string' ? raw : raw != null ? String(raw) : '');
  if (!normalized) return;
  set.add(normalized);
  splitIntoParts(normalized).forEach(part => set.add(part));
};

const collectTokensForCommand = (
  definition: { id: string; label: string; prefix: string },
  keywords: (string | any)[] | undefined,
) => {
  const tokens = new Set<string>();
  const keywordTokens = new Set<string>();

  addToken(tokens, definition.id);
  addToken(tokens, definition.prefix.replace(/^\//, ''));
  addToken(tokens, definition.label);

  keywords?.forEach(keyword => {
    if (typeof keyword !== 'string') return; // skip non-string entries
    addToken(tokens, keyword);
    addToken(keywordTokens, keyword);
  });

  return { tokens: Array.from(tokens), keywordTokens };
};

export const createCommandIndex = (remoteCommands: CommandDefinition[]): IndexedCommand[] => {
  const remote: IndexedCommand[] = remoteCommands
    .filter(c => c.showInDashboard !== false && (c as any).surface !== 'website')
    .map(definition => {
      // Keywords are now part of the definition
      const keywords = definition.keywords ?? [];
      const prepared = collectTokensForCommand(definition, keywords);
      return {
        kind: 'remote' as const,
        definition,
        tokens: prepared.tokens,
        keywordTokens: prepared.keywordTokens,
      };
    });

  const local: IndexedCommand[] = LOCAL_COMMANDS.map(definition => {
    const keywords = LOCAL_COMMAND_KEYWORDS[definition.id as LocalCommandId] ?? [];
    const prepared = collectTokensForCommand(definition, keywords);
    return {
      kind: 'local' as const,
      definition,
      tokens: prepared.tokens,
      keywordTokens: prepared.keywordTokens,
    };
  });

  return [...remote, ...local];
};

const scoreTokenMatch = (queryToken: string, tokens: string[], keywordTokens: Set<string>) => {
  let bestScore = 0;
  let bestToken = '';

  for (const token of tokens) {
    let candidateScore = 0;
    if (token === queryToken) {
      candidateScore = 6;
    } else if (token.startsWith(queryToken)) {
      candidateScore = 4;
    } else if (queryToken.startsWith(token)) {
      candidateScore = 3;
    } else if (token.includes(queryToken)) {
      candidateScore = 2;
    } else if (queryToken.includes(token)) {
      candidateScore = 1;
    }

    if (candidateScore > 0 && keywordTokens.has(token)) {
      candidateScore += 0.5;
    }

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestToken = token;
    }
  }

  return { score: bestScore, token: bestToken };
};

const ensureQueryTokens = (rawQuery: string): string[] => {
  const normalized = normalize(rawQuery);
  if (!normalized) return [];
  const parts = splitIntoParts(normalized);
  const set = new Set<string>([normalized, ...parts]);
  return Array.from(set);
};

export const searchCommands = (
  index: IndexedCommand[],
  rawQuery: string,
  options: CommandSearchOptions = {},
): CommandSearchResult[] => {
  const queryTokens = ensureQueryTokens(rawQuery);
  if (queryTokens.length === 0) {
    // Return all commands with a base score if the query is empty
    return index.map(entry => ({
      kind: entry.kind,
      definition: entry.definition,
      score: 1,
      matchedTokens: [],
    } as CommandSearchResult)).sort((a, b) => a.definition.label.localeCompare(b.definition.label));
  }

  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const results: CommandSearchResult[] = [];

  for (const entry of index) {
    let totalScore = 0;
    const matched = new Set<string>();

    for (const queryToken of queryTokens) {
      const { score, token } = scoreTokenMatch(queryToken, entry.tokens, entry.keywordTokens);
      if (score > 0 && token) {
        totalScore += score;
        matched.add(token);
      }
    }

    if (totalScore >= minScore) {
      results.push({
        kind: entry.kind,
        definition: entry.definition,
        score: totalScore,
        matchedTokens: Array.from(matched),
      } as CommandSearchResult);
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const labelA = a.definition.label.toLowerCase();
    const labelB = b.definition.label.toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });

  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
};

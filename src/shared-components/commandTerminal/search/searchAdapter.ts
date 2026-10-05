import type { CommandRecord } from '../../../allObjectFolder/src/createObject/commands/commandTypes';
import type { CommandDefinition } from '../../searchBarMain/commandConfigurations/commands';
import { searchAll, type SearchOptions, type UnifiedSearchResult, } from '../../searchBarMain/searchLogicAndAlgorithms/searchEngine';
import { getOrganisationDashboardViews } from '../../../pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';
type SearchAllDataFields = Partial<Pick<SearchOptions, 'bookmarks' | 'notes' | 'links' | 'snippets' | 'prompts' | 'agents' | 'todos'>>;
export type CommandTerminalSearchData = SearchAllDataFields & {
    commands?: Array<CommandRecord | CommandDefinition>;
    collections?: SearchOptions['sessions'];
};
export type CommandTerminalSearchResultKind = UnifiedSearchResult['_kind'];
type CommandTerminalSearchSnapshot = CommandTerminalSearchData & {
    widgetViews?: SearchOptions['sessions'];
    aiPrompts?: SearchOptions['prompts'];
    chatAgents?: SearchOptions['agents'];
};
/**
 * Build the shared search input from a surface-owned IndexedDB snapshot.
 *
 * Surfaces may use different local property names (`widgetViews`, `aiPrompts`,
 * `chatAgents`), but the output here matches the existing `searchAll()` input
 * shape. Keep data loading and execution in the caller.
 */
export function createCommandTerminalSearchData(localData: CommandTerminalSearchSnapshot): CommandTerminalSearchData {
    return {
        commands: localData.commands,
        notes: localData.notes,
        links: localData.links,
        snippets: localData.snippets,
        // This adapter powers the background omnibox as well as Alt + S Search.
        // Keep the internal Home dashboard out even when a caller supplies raw
        // IndexedDB dashboard records instead of the UI store projection.
        collections: getOrganisationDashboardViews(localData.collections || localData.widgetViews || []),
        prompts: localData.prompts || localData.aiPrompts,
        agents: localData.agents || localData.chatAgents,
        todos: localData.todos,
        bookmarks: localData.bookmarks,
    };
}
/** Run `searchAll()` with command-terminal defaults for surfaces that do not search browser history. */
function searchCommandTerminalData(query: string, data: CommandTerminalSearchData): UnifiedSearchResult[] {
    return searchAll(query, {
        commands: (data.commands || []) as unknown as CommandDefinition[],
        localCommands: [],
        historyItems: null,
        bookmarks: data.bookmarks || [],
        commonCommands: [],
        notes: data.notes || [],
        links: data.links || [],
        snippets: data.snippets || [],
        sessions: data.collections || [],
        prompts: data.prompts || [],
        agents: data.agents || [],
        todos: data.todos || [],
        surface: 'command_terminal',
        allowLongQuery: true,
        literalQuery: true,
    });
}
const normalizeSearchText = (value: unknown) => String(value || '')
    .trim()
    .toLowerCase();
const resultToCommandTerminalItem = (result: UnifiedSearchResult) => result._kind === 'command' ? (result as any).command : result;
/** Return ranked items from `searchAll()` for one existing shared result kind. */
export function searchCommandTerminalItems<T = any>(resultKind: CommandTerminalSearchResultKind, query: string, data: CommandTerminalSearchData): T[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery)
        return [];
    // Constrain sources before the shared engine applies its result limit.
    const scopedData: CommandTerminalSearchData = {};
    switch (resultKind) {
        case 'command':
            scopedData.commands = data.commands;
            break;
        case 'note':
            scopedData.notes = data.notes;
            break;
        case 'link':
            scopedData.links = data.links;
            break;
        case 'snippet':
            scopedData.snippets = data.snippets;
            break;
        case 'session':
            scopedData.collections = data.collections;
            break;
        case 'prompt':
            scopedData.prompts = data.prompts;
            break;
        case 'agent_collection':
            scopedData.agents = data.agents;
            break;
        case 'todo':
            scopedData.todos = data.todos;
            break;
        case 'bookmark':
            scopedData.bookmarks = data.bookmarks;
            break;
        default: return [];
    }
    return searchCommandTerminalData(normalizedQuery, scopedData)
        .filter(result => result._kind === resultKind)
        .map(resultToCommandTerminalItem)
        .filter((item): item is T => Boolean(item));
}
/** Resolve the first shared-search match for Enter/open flows. */
export function findBestCommandTerminalItemMatch<T = any>(resultKind: CommandTerminalSearchResultKind, query: string, data: CommandTerminalSearchData): T | null {
    return searchCommandTerminalItems<T>(resultKind, query, data)[0];
}
/** Convenience wrapper for command rows, still backed by the same `searchAll()` call. */
export function searchCommandTerminalCommands(query: string, commands: CommandRecord[]): CommandRecord[] {
    return searchCommandTerminalItems<CommandRecord>('command', query, { commands });
}

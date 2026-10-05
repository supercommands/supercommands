import type { PrefixSettingAction, PrefixSettingCategory, PrefixSettingKey, PrefixSettingRecord, PrefixSettingSubcommand, PrefixSettingType, } from './prefixSettingTypes';
/**
 * Resolved command-terminal prefix map.
 *
 * This pure type is shared by settings, newtab, website, omnibox, and parser
 * adapters. Persistence remains in `prefixSettingData.ts`.
 */
export type CommandTerminalPrefixes = {
    note: string;
    link: string;
    command: string;
    system_command?: string;
    session?: string;
    collection?: string;
    collection_capture?: string;
    collection_link?: string;
    collection_article?: string;
    collection_screenshot?: string;
    collection_web_scraping?: string;
    automation?: string;
    agent?: string;
    snippet?: string;
    todo?: string;
    bookmark?: string;
    prompt?: string;
    capture_screenshot?: string;
    capture_clip_screenshot?: string;
    capture_full_screenshot?: string;
    capture_element_screenshot?: string;
    downloadallimages?: string;
    downloadalltables?: string;
    save_note?: string;
    save_snippet?: string;
    save_chat?: string;
    send_to_agent?: string;
    summarize_page?: string;
    merge_windows?: string;
    close_duplicate_tabs?: string;
    mute_all_tabs?: string;
    unmute_all_tabs?: string;
    field_title?: string;
    field_description?: string;
    field_url?: string;
    field_tag?: string;
    field_hotkey?: string;
    field_shortcut?: string;
    field_time?: string;
    field_recurring?: string;
    field_reference?: string;
    field_title_long?: string;
    field_title_alias_name?: string;
    field_title_alias_plain?: string;
    field_description_long?: string;
    field_description_alias_desc?: string;
    field_description_alias_body?: string;
    field_url_long?: string;
    field_tag_plural?: string;
    field_hotkey_long?: string;
    field_shortcut_long?: string;
    field_recurring_long?: string;
    field_reference_attach?: string;
    field_reference_attachment?: string;
    field_reference_long?: string;
    chain_action_save?: string;
    chain_action_save_long?: string;
    chain_action_filter?: string;
    chain_action_filter_long?: string;
    chain_action_filter_alias_plain?: string;
    chain_action_favorite?: string;
    chain_action_favorite_long?: string;
    chain_action_favorite_alias_plain?: string;
    chain_action_unfavorite?: string;
    chain_action_unfavorite_long?: string;
    chain_action_unfavorite_alias_plain?: string;
};
export type CommandChainFieldKey = 'title' | 'description' | 'url' | 'tag' | 'hotkey' | 'shortcut' | 'time' | 'recurring' | 'reference';
export type FixedCommandChainFieldAliasConfig = {
    primary: string;
    aliases: string[];
    reservedTextAliases: string[];
};
/**
 * Fixed single-dash grammar for command-chain field aliases.
 *
 * The primary value is the default display token. Aliases are accepted by
 * parsers and scoring, but should not render as duplicate dropdown rows.
 * Bare text aliases are reserved so user text commands cannot shadow grammar.
 */
export const FIXED_COMMAND_CHAIN_FIELD_ALIASES: Record<CommandChainFieldKey, FixedCommandChainFieldAliasConfig> = {
    title: {
        primary: '-t',
        aliases: ['-tit', '-title', '-name'],
        reservedTextAliases: ['t', 'tit', 'title', 'name'],
    },
    description: {
        primary: '-d',
        aliases: ['-desc', '-description', '-body'],
        reservedTextAliases: ['d', 'desc', 'description', 'body'],
    },
    url: {
        primary: '-u',
        aliases: ['-url', '-link'],
        reservedTextAliases: ['u', 'url', 'link'],
    },
    tag: {
        primary: '-tag',
        aliases: ['-tags'],
        reservedTextAliases: ['tag', 'tags'],
    },
    hotkey: {
        primary: '-hk',
        aliases: ['-hotkey'],
        reservedTextAliases: ['hk', 'hotkey'],
    },
    shortcut: {
        primary: '-cmd',
        aliases: ['-command', '-shortcut'],
        reservedTextAliases: ['cmd', 'command', 'shortcut'],
    },
    time: {
        primary: '-time',
        aliases: ['-date', '-due'],
        reservedTextAliases: ['time', 'date', 'due'],
    },
    recurring: {
        primary: '-r',
        aliases: ['-rec', '-recurring'],
        reservedTextAliases: ['r', 'rec', 'recurring'],
    },
    reference: {
        primary: '-ref',
        aliases: ['-reference', '-attach', '-attachment'],
        reservedTextAliases: ['ref', 'reference', 'attach', 'attachment'],
    },
};
export const getFixedCommandChainFieldPrefixes = (field: CommandChainFieldKey): string[] => {
    const config = FIXED_COMMAND_CHAIN_FIELD_ALIASES[field];
    return Array.from(new Set([config.primary, ...config.aliases].map(normalizePrefixSettingValue).filter(Boolean)));
};
export const getFixedCommandChainReservedTextAliases = (): string[] => {
    return Array.from(new Set(Object.values(FIXED_COMMAND_CHAIN_FIELD_ALIASES)
        .flatMap(config => config.reservedTextAliases)
        .map(normalizePrefixSettingValue)
        .filter(Boolean)));
};
/**
 * Default command-terminal prefixes used to seed prefix settings.
 *
 * These values live in the prefix-settings domain so there is one default source
 * for newtab, website snapshot mapping, omnibox, and background adapters.
 */
export const DEFAULT_COMMAND_TERMINAL_PREFIXES: Required<CommandTerminalPrefixes> = {
    note: 'note',
    link: 'link',
    command: 'c',
    system_command: 'sc',
    session: '',
    collection: 'workspace',
    collection_capture: 'clip',
    collection_link: 'linkclip',
    collection_article: 'article',
    collection_screenshot: 'screenclip',
    collection_web_scraping: 'elementclip',
    automation: '',
    agent: 'agent',
    snippet: 'text',
    todo: 'todo',
    bookmark: 'bk',
    prompt: 'prompt',
    capture_screenshot: 'visiblescreen',
    capture_clip_screenshot: 'screen',
    capture_full_screenshot: 'fullscreen',
    capture_element_screenshot: 'element',
    downloadallimages: 'dp',
    downloadalltables: 'tables',
    save_note: 'cn',
    save_snippet: 'cs',
    save_chat: 'save_agent',
    send_to_agent: 'send_agent',
    summarize_page: 'summ',
    merge_windows: 'merge',
    close_duplicate_tabs: 'duplicate',
    mute_all_tabs: 'mute',
    unmute_all_tabs: 'unmute',
    field_title: '-t',
    field_description: '-d',
    field_url: '-u',
    field_tag: '-tag',
    field_hotkey: '-hk',
    field_shortcut: '-cmd',
    field_time: '-time',
    field_recurring: '-r',
    field_reference: '-ref',
    field_title_long: '-title',
    field_title_alias_name: '-name',
    field_title_alias_plain: '-tit',
    field_description_long: '-description',
    field_description_alias_desc: '-desc',
    field_description_alias_body: '-body',
    field_url_long: '-url',
    field_tag_plural: '-tags',
    field_hotkey_long: '-hotkey',
    field_shortcut_long: '-command',
    field_recurring_long: '-recurring',
    field_reference_attach: '-attach',
    field_reference_attachment: '-attachment',
    field_reference_long: '-reference',
    chain_action_save: '-s',
    chain_action_save_long: '-save',
    chain_action_filter: '-f',
    chain_action_filter_long: '-filter',
    chain_action_filter_alias_plain: '-search',
    chain_action_favorite: '-fav',
    chain_action_favorite_long: '-favorite',
    chain_action_favorite_alias_plain: '-star',
    chain_action_unfavorite: '-unfav',
    chain_action_unfavorite_long: '-unfavorite',
    chain_action_unfavorite_alias_plain: '-unstar',
};
/**
 * Prefix setting categories that are valid top-level entity filters.
 */
export const PREFIX_SETTING_CATEGORIES = [
    'note',
    'link',
    'collection',
    'collection_capture',
    'todo',
    'bookmark',
    'command',
    'system_command',
    'snippet',
    'agent',
    'prompt'
] as const satisfies readonly PrefixSettingCategory[];
/**
 * Prefix setting categories that are valid page or command actions.
 */
export const PREFIX_SETTING_ACTIONS = [
    'collection_link',
    'collection_article',
    'collection_screenshot',
    'collection_web_scraping',
    'capture_screenshot',
    'capture_clip_screenshot',
    'capture_full_screenshot',
    'capture_element_screenshot',
    'downloadallimages',
    'downloadalltables',
    'save_note',
    'save_snippet',
    'save_chat',
    'send_to_agent',
    'summarize_page',
    'merge_windows',
    'close_duplicate_tabs',
    'mute_all_tabs',
    'unmute_all_tabs'
] as const satisfies readonly PrefixSettingAction[];
/**
 * Prefix setting categories that are valid inside category command chains.
 */
export const PREFIX_SETTING_SUBCOMMANDS = [
    'chain_action_save',
    'chain_action_save_long',
    'chain_action_filter',
    'chain_action_filter_long',
    'chain_action_filter_alias_plain',
    'chain_action_favorite',
    'chain_action_favorite_long',
    'chain_action_favorite_alias_plain',
    'chain_action_unfavorite',
    'chain_action_unfavorite_long',
    'chain_action_unfavorite_alias_plain',
    'field_title',
    'field_title_long',
    'field_title_alias_name',
    'field_title_alias_plain',
    'field_description',
    'field_description_long',
    'field_description_alias_desc',
    'field_description_alias_body',
    'field_url',
    'field_url_long',
    'field_tag',
    'field_tag_plural',
    'field_hotkey',
    'field_hotkey_long',
    'field_shortcut',
    'field_shortcut_long',
    'field_time',
    'field_recurring',
    'field_recurring_long',
    'field_reference',
    'field_reference_attach',
    'field_reference_attachment',
    'field_reference_long'
] as const satisfies readonly PrefixSettingSubcommand[];
/**
 * Default rows used to seed the IndexedDB prefix settings table.
 */
export const DEFAULT_PREFIX_ROWS: ReadonlyArray<Omit<PrefixSettingRecord, 'createdAt' | 'updatedAt'>> = [
    { id: 'prefix_note', type: 'category', category: 'note', label: 'Notes', prefix: 'note', enabled: true },
    { id: 'prefix_link', type: 'category', category: 'link', label: 'Links', prefix: 'link', enabled: true },
    { id: 'prefix_collection_capture', type: 'category', category: 'collection_capture', label: 'Web Clips', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.collection_capture, enabled: true },
    { id: 'prefix_action_collection_link', type: 'action', category: 'collection_link', label: 'Link clip', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.collection_link, enabled: true },
    { id: 'prefix_action_collection_article', type: 'action', category: 'collection_article', label: 'Article clip', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.collection_article, enabled: true },
    { id: 'prefix_action_collection_screenshot', type: 'action', category: 'collection_screenshot', label: 'Screenshot clip', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.collection_screenshot, enabled: true },
    { id: 'prefix_action_collection_web_scraping', type: 'action', category: 'collection_web_scraping', label: 'Element clip', prefix: DEFAULT_COMMAND_TERMINAL_PREFIXES.collection_web_scraping, enabled: true },
    { id: 'prefix_collection', type: 'category', category: 'collection', label: 'Workspace Sessions', prefix: 'workspace', enabled: true },
    { id: 'prefix_todo', type: 'category', category: 'todo', label: 'Todo', prefix: 'todo', enabled: true },
    { id: 'prefix_bookmark', type: 'category', category: 'bookmark', label: 'Bookmarks', prefix: 'bk', enabled: true },
    { id: 'prefix_command', type: 'category', category: 'command', label: 'Commands', prefix: 'c', enabled: true },
    { id: 'prefix_system_command', type: 'category', category: 'system_command', label: 'System Commands', prefix: 'sc', enabled: true },
    { id: 'prefix_snippet', type: 'category', category: 'snippet', label: 'Text Expanders', prefix: 'text', enabled: true },
    { id: 'prefix_agent', type: 'category', category: 'agent', label: 'Chat Agents', prefix: 'agent', enabled: true },
    { id: 'prefix_prompt', type: 'category', category: 'prompt', label: 'Chat Agents', prefix: 'prompt', enabled: true },
    { id: 'prefix_action_capture_screenshot', type: 'action', category: 'capture_screenshot', label: 'Capture Visible Screenshot', prefix: 'visiblescreen', enabled: true },
    { id: 'prefix_action_capture_clip_screenshot', type: 'action', category: 'capture_clip_screenshot', label: 'Clip & Download Screenshot', prefix: 'screen', enabled: true },
    { id: 'prefix_action_capture_full_screenshot', type: 'action', category: 'capture_full_screenshot', label: 'Capture Full Screenshot', prefix: 'fullscreen', enabled: true },
    { id: 'prefix_action_capture_element_screenshot', type: 'action', category: 'capture_element_screenshot', label: 'Capture Element', prefix: 'element', enabled: true },
    { id: 'prefix_action_downloadallimages', type: 'action', category: 'downloadallimages', label: 'Download All Images', prefix: 'dp', enabled: true },
    { id: 'prefix_action_downloadalltables', type: 'action', category: 'downloadalltables', label: 'Download All Tables', prefix: 'tables', enabled: true },
    { id: 'prefix_action_save_note', type: 'action', category: 'save_note', label: 'Save Note', prefix: 'cn', enabled: true },
    { id: 'prefix_action_save_snippet', type: 'action', category: 'save_snippet', label: 'Save Text Expander', prefix: 'cs', enabled: true },
    { id: 'prefix_action_save_chat', type: 'action', category: 'save_chat', label: 'Save Chat Agent', prefix: 'save_agent', enabled: true },
    { id: 'prefix_action_send_to_agent', type: 'action', category: 'send_to_agent', label: 'Send to Agent', prefix: 'send_agent', enabled: true },
    { id: 'prefix_action_summarize_page', type: 'action', category: 'summarize_page', label: 'Summarize Page', prefix: 'summ', enabled: true },
    { id: 'prefix_action_merge_windows', type: 'action', category: 'merge_windows', label: 'Merge All Windows', prefix: 'merge', enabled: true },
    { id: 'prefix_action_close_duplicate_tabs', type: 'action', category: 'close_duplicate_tabs', label: 'Close Duplicate Tabs', prefix: 'duplicate', enabled: true },
    { id: 'prefix_action_mute_all_tabs', type: 'action', category: 'mute_all_tabs', label: 'Mute All Tabs', prefix: 'mute', enabled: true },
    { id: 'prefix_action_unmute_all_tabs', type: 'action', category: 'unmute_all_tabs', label: 'Unmute All Tabs', prefix: 'unmute', enabled: true },
    { id: 'prefix_subcommand_chain_action_save', type: 'subcommand', category: 'chain_action_save', label: 'Save Chain Action', prefix: '-s', enabled: true },
    { id: 'prefix_subcommand_chain_action_save_long', type: 'subcommand', category: 'chain_action_save_long', label: 'Save Chain Action Alias', prefix: '-save', enabled: true },
    { id: 'prefix_subcommand_chain_action_filter', type: 'subcommand', category: 'chain_action_filter', label: 'Search Chain Action', prefix: '-f', enabled: true },
    { id: 'prefix_subcommand_chain_action_filter_long', type: 'subcommand', category: 'chain_action_filter_long', label: 'Search Chain Action Alias', prefix: '-filter', enabled: true },
    { id: 'prefix_subcommand_chain_action_filter_alias_plain', type: 'subcommand', category: 'chain_action_filter_alias_plain', label: 'Search Chain Action Search Alias', prefix: '-search', enabled: true },
    { id: 'prefix_subcommand_chain_action_favorite', type: 'subcommand', category: 'chain_action_favorite', label: 'Favorite Chain Action', prefix: '-fav', enabled: true },
    { id: 'prefix_subcommand_chain_action_favorite_long', type: 'subcommand', category: 'chain_action_favorite_long', label: 'Favorite Chain Action Alias', prefix: '-favorite', enabled: true },
    { id: 'prefix_subcommand_chain_action_favorite_alias_plain', type: 'subcommand', category: 'chain_action_favorite_alias_plain', label: 'Favorite Chain Action Star Alias', prefix: '-star', enabled: true },
    { id: 'prefix_subcommand_chain_action_unfavorite', type: 'subcommand', category: 'chain_action_unfavorite', label: 'Unfavorite Chain Action', prefix: '-unfav', enabled: true },
    { id: 'prefix_subcommand_chain_action_unfavorite_long', type: 'subcommand', category: 'chain_action_unfavorite_long', label: 'Unfavorite Chain Action Alias', prefix: '-unfavorite', enabled: true },
    { id: 'prefix_subcommand_chain_action_unfavorite_alias_plain', type: 'subcommand', category: 'chain_action_unfavorite_alias_plain', label: 'Unfavorite Chain Action Unstar Alias', prefix: '-unstar', enabled: true },
    { id: 'prefix_subcommand_field_title', type: 'subcommand', category: 'field_title', label: 'Title Field', prefix: '-t', enabled: true },
    { id: 'prefix_subcommand_field_title_long', type: 'subcommand', category: 'field_title_long', label: 'Title Field Alias', prefix: '-title', enabled: true },
    { id: 'prefix_subcommand_field_title_alias_name', type: 'subcommand', category: 'field_title_alias_name', label: 'Title Field Name Alias', prefix: '-name', enabled: true },
    { id: 'prefix_subcommand_field_title_alias_plain', type: 'subcommand', category: 'field_title_alias_plain', label: 'Title Field Short Alias', prefix: '-tit', enabled: true },
    { id: 'prefix_subcommand_field_description', type: 'subcommand', category: 'field_description', label: 'Description Field', prefix: '-d', enabled: true },
    { id: 'prefix_subcommand_field_description_long', type: 'subcommand', category: 'field_description_long', label: 'Description Field Alias', prefix: '-description', enabled: true },
    { id: 'prefix_subcommand_field_description_alias_desc', type: 'subcommand', category: 'field_description_alias_desc', label: 'Description Field Desc Alias', prefix: '-desc', enabled: true },
    { id: 'prefix_subcommand_field_description_alias_body', type: 'subcommand', category: 'field_description_alias_body', label: 'Description Field Body Alias', prefix: '-body', enabled: true },
    { id: 'prefix_subcommand_field_url', type: 'subcommand', category: 'field_url', label: 'URL Field', prefix: '-u', enabled: true },
    { id: 'prefix_subcommand_field_url_long', type: 'subcommand', category: 'field_url_long', label: 'URL Field Alias', prefix: '-url', enabled: true },
    { id: 'prefix_subcommand_field_tag', type: 'subcommand', category: 'field_tag', label: 'Tag Field', prefix: '-tag', enabled: true },
    { id: 'prefix_subcommand_field_tag_plural', type: 'subcommand', category: 'field_tag_plural', label: 'Tags Field Alias', prefix: '-tags', enabled: true },
    { id: 'prefix_subcommand_field_hotkey', type: 'subcommand', category: 'field_hotkey', label: 'Hotkey Field', prefix: '-hk', enabled: true },
    { id: 'prefix_subcommand_field_hotkey_long', type: 'subcommand', category: 'field_hotkey_long', label: 'Hotkey Field Alias', prefix: '-hotkey', enabled: true },
    { id: 'prefix_subcommand_field_shortcut', type: 'subcommand', category: 'field_shortcut', label: 'Text Command Field', prefix: '-cmd', enabled: true },
    { id: 'prefix_subcommand_field_shortcut_long', type: 'subcommand', category: 'field_shortcut_long', label: 'Text Command Field Alias', prefix: '-command', enabled: true },
    { id: 'prefix_subcommand_field_time', type: 'subcommand', category: 'field_time', label: 'Time Field', prefix: '-time', enabled: true },
    { id: 'prefix_subcommand_field_recurring', type: 'subcommand', category: 'field_recurring', label: 'Recurring Field', prefix: '-r', enabled: true },
    { id: 'prefix_subcommand_field_recurring_long', type: 'subcommand', category: 'field_recurring_long', label: 'Recurring Field Alias', prefix: '-recurring', enabled: true },
    { id: 'prefix_subcommand_field_reference', type: 'subcommand', category: 'field_reference', label: 'Reference Field', prefix: '-ref', enabled: true },
    { id: 'prefix_subcommand_field_reference_attach', type: 'subcommand', category: 'field_reference_attach', label: 'Attach Field Alias', prefix: '-attach', enabled: true },
    { id: 'prefix_subcommand_field_reference_attachment', type: 'subcommand', category: 'field_reference_attachment', label: 'Attachment Field Alias', prefix: '-attachment', enabled: true },
    { id: 'prefix_subcommand_field_reference_long', type: 'subcommand', category: 'field_reference_long', label: 'Reference Field Alias', prefix: '-reference', enabled: true }
];
/**
 * Normalizes a stored prefix setting value for parser comparison.
 */
export const normalizePrefixSettingValue = (value: string | null | undefined) => String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
export type ReservedCommandGrammarKind = PrefixSettingType;
export type ReservedCommandGrammarEntry = {
    value: string;
    kind: ReservedCommandGrammarKind;
    category: PrefixSettingKey;
    label: string;
};
/**
 * Collects enabled command grammar tokens that cannot be reused as user text
 * shortcuts. Exact matching is handled by the shortcut validator.
 */
export const getReservedCommandGrammarEntries = (rows: PrefixSettingRecord[] | null | undefined): ReservedCommandGrammarEntry[] => {
    const entries: ReservedCommandGrammarEntry[] = [];
    const seen = new Set<string>();
    const addEntry = (entry: ReservedCommandGrammarEntry) => {
        const key = `${entry.kind}:${entry.value}`;
        if (seen.has(key))
            return;
        seen.add(key);
        entries.push(entry);
    };
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!row.enabled || !isSupportedPrefixKey(row.category))
            continue;
        const value = normalizePrefixSettingValue(row.prefix);
        if (!value)
            continue;
        addEntry({
            value,
            kind: row.type,
            category: row.category,
            label: row.label || String(row.category),
        });
    }
    Object.entries(FIXED_COMMAND_CHAIN_FIELD_ALIASES).forEach(([field, config]) => {
        [...getFixedCommandChainFieldPrefixes(field as CommandChainFieldKey), ...config.reservedTextAliases].forEach(value => {
            addEntry({
                value,
                kind: 'subcommand',
                category: `field_${field}` as PrefixSettingKey,
                label: `${field} field alias`,
            });
        });
    });
    return entries;
};
/**
 * Converts prefix-setting rows into the resolved prefix map used by command surfaces.
 *
 * Use this when a content-script UI receives rows from background instead of
 * reading IndexedDB directly.
 */
export const buildPrefixMapFromSettings = (rows: PrefixSettingRecord[] | null | undefined): Required<CommandTerminalPrefixes> => {
    const map: Required<CommandTerminalPrefixes> = { ...DEFAULT_COMMAND_TERMINAL_PREFIXES };
    for (const row of Array.isArray(rows) ? rows : []) {
        if (row.releasedTextCommandPrefix && isSupportedPrefixKey(row.category)) {
            (map as any)[row.category] = '';
            continue;
        }
        if (!row.enabled || !(isSupportedPrefixKey(row.category)))
            continue;
        (map as any)[row.category] = normalizePrefixSettingValue(row.prefix);
    }
    map.session = '';
    map.automation = '';
    return map;
};
/**
 * Built-in executable commands whose prefix is owned by prefixSettings.
 *
 * Category and subcommand prefix settings are parser grammar and intentionally
 * do not resolve as executable command prefixes.
 */
export const getCommandPrefixSettingKey = (commandId: string | null | undefined): PrefixSettingAction | null => {
    const normalized = String(commandId || '').trim();
    return (PREFIX_SETTING_ACTIONS as readonly string[]).includes(normalized)
        ? (normalized as PrefixSettingAction)
        : null;
};
/**
 * Resolve an executable command prefix from prefixSettings when that command is
 * backed by a configurable action prefix.
 */
export const resolveCommandPrefixFromSettings = (commandId: string | null | undefined, fallbackPrefix: string | null | undefined, rows: PrefixSettingRecord[] | null | undefined): string => {
    const settingKey = getCommandPrefixSettingKey(commandId);
    if (!settingKey)
        return normalizePrefixSettingValue(fallbackPrefix);
    if ((rows || []).some(row => row.type === 'action' && row.category === settingKey && row.releasedTextCommandPrefix))
        return '';
    const configured = (Array.isArray(rows) ? rows : []).find(row => row.enabled !== false && row.type === 'action' && row.category === settingKey);
    return normalizePrefixSettingValue(configured?.prefix || fallbackPrefix);
};
/**
 * Checks whether a prefix-setting category is supported by the command terminal.
 */
export const isSupportedPrefixKey = (category: string): category is PrefixSettingKey => (PREFIX_SETTING_CATEGORIES as readonly string[]).includes(category) ||
    (PREFIX_SETTING_ACTIONS as readonly string[]).includes(category) ||
    (PREFIX_SETTING_SUBCOMMANDS as readonly string[]).includes(category);

type NewtabLaunchParams = {
    type?: string;
    id?: string;
    query?: string;
    entityId?: string;
    openBehavior?: string;
    triggerHotkey?: boolean;
    omnibox?: boolean;
    altsAction?: boolean;
    editMode?: boolean;
    runPrompt?: boolean;
    createLink?: boolean;
    createNote?: boolean;
    createSnippet?: boolean;
    createTodo?: boolean;
    createPrompt?: boolean;
    createChatAgent?: boolean;
    sessionMode?: boolean;
    activeTabUrl?: string;
    activeTabTitle?: string;
    lockCommand?: string;
};
export type CommandTerminalLaunchTarget = {
    kind: 'website-popup';
    creatorType: string;
} | {
    kind: 'newtab-path';
    path: string;
};
type BooleanRouteParam = keyof Pick<NewtabLaunchParams, 'triggerHotkey' | 'omnibox' | 'altsAction' | 'editMode' | 'runPrompt' | 'createLink' | 'createNote' | 'createSnippet' | 'createTodo' | 'createPrompt' | 'createChatAgent' | 'sessionMode'>;
type StringRouteParam = keyof Pick<NewtabLaunchParams, 'type' | 'id' | 'query' | 'entityId' | 'openBehavior' | 'activeTabUrl' | 'activeTabTitle' | 'lockCommand'>;
type CommandLaunchRecordLike = {
    id: string;
    surface?: string;
    category?: string;
};
const BOOLEAN_ROUTE_PARAMS: ReadonlyArray<[
    BooleanRouteParam,
    string
]> = [
    ['triggerHotkey', 'trigger_hotkey'],
    ['omnibox', 'omnibox'],
    ['altsAction', 'alts_action'],
    ['editMode', 'edit_mode'],
    ['runPrompt', 'runPrompt'],
    ['createLink', 'create_link'],
    ['createNote', 'create_note'],
    ['createSnippet', 'create_snippet'],
    ['createTodo', 'create_todo'],
    ['createPrompt', 'create_prompt'],
    ['createChatAgent', 'create_chat_agent'],
    ['sessionMode', 'session_mode']
];
const STRING_ROUTE_PARAMS: ReadonlyArray<[
    StringRouteParam,
    string
]> = [
    ['type', 'type'],
    ['id', 'id'],
    ['query', 'query'],
    ['entityId', 'entityId'],
    ['openBehavior', 'openBehavior'],
    ['activeTabUrl', 'active_tab_url'],
    ['activeTabTitle', 'active_tab_title'],
    ['lockCommand', 'lock_command']
];
const isWebsiteOwnedCommand = (command: CommandLaunchRecordLike): boolean => command.surface === 'website';
/** Encodes a newtab command URL path without depending on chrome.runtime or browser APIs. */
export function buildCommandTerminalNewtabPath(params: NewtabLaunchParams): string {
    const searchParams = new URLSearchParams();
    BOOLEAN_ROUTE_PARAMS.forEach(([key, paramName]) => {
        if (params[key])
            searchParams.set(paramName, 'true');
    });
    STRING_ROUTE_PARAMS.forEach(([key, paramName]) => {
        const value = params[key];
        if (value)
            searchParams.set(paramName, value);
    });
    const query = searchParams.toString();
    return `AltS_search_newtab/index.html${query ? `?${query}` : ''}`;
}
/** Builds the path used when a command should be rendered by the newtab command URL trigger. */
export function buildNewtabCommandExecutionPath(commandId: string, prompt = ''): string {
    return buildCommandTerminalNewtabPath({
        omnibox: true,
        type: 'command',
        id: commandId,
        query: prompt,
    });
}
/** Builds the path used when an embedded command must hand off execution to the full newtab page. */
export function buildNewtabHotkeyCommandPath(commandId: string): string {
    return buildCommandTerminalNewtabPath({
        triggerHotkey: true,
        type: 'command',
        id: commandId,
    });
}
/** Decides whether a command should open a newtab URL or render the website popup in-place. */
export function resolveCommandTerminalCommandLaunch(commandOrId: string | CommandLaunchRecordLike, options: {
    prompt?: string;
    activeTabUrl?: string;
    activeTabTitle?: string;
} = {}): CommandTerminalLaunchTarget {
    const commandId = typeof commandOrId === 'string' ? commandOrId : commandOrId.id;
    if (commandId === 'save_link') {
        return {
            kind: 'newtab-path',
            path: buildCommandTerminalNewtabPath({
                createLink: true,
                activeTabUrl: options.activeTabUrl,
                activeTabTitle: options.activeTabTitle,
            }),
        };
    }
    if (typeof commandOrId !== 'string' && isWebsiteOwnedCommand(commandOrId)) {
        return { kind: 'website-popup', creatorType: commandId };
    }
    return {
        kind: 'newtab-path',
        path: buildNewtabCommandExecutionPath(commandId, options.prompt),
    };
}

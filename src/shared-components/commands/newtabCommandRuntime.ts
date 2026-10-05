import { CMDOS_DOCS_URL } from '../../storage/API/core/apiConfig';
import { useUIStore } from '../uiStateManager';
import { buildCommandTerminalNewtabPath, buildNewtabHotkeyCommandPath } from '../commandTerminal/runtime';
import { SHARED_ALL_COMMANDS } from './surface';
import type { CommandContext, SearchPopupView } from './types';
type CommandServiceBase = {
    toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    navigation: (view: SearchPopupView | any) => void;
    reload: () => void;
};
type OpenTabOptions = {
    url: string;
    active?: boolean;
};
type ExecuteNewtabAppCommandOptions = {
    commandId: string;
    isEmbedded?: boolean;
    openTab: (options: OpenTabOptions) => void;
    setSelectedSidebarSection?: (section: string) => void;
};
export function isRetiredCreateUiActionId(commandId: string, options: {
    includeCreateMenuAi?: boolean;
} = {}): boolean {
    const normalizedCommandId = String(commandId || '').trim().toLowerCase();
    if (normalizedCommandId === 'ai')
        return Boolean(options.includeCreateMenuAi);
    return [
        'createnote',
        'createnotes',
        'createlink',
        'createlinks',
        'createsnippet',
        'createtodo',
        'createprompt',
        'agent'
    ].includes(normalizedCommandId);
}
export function executeRetiredCreateUiAction(commandId: string, options: {
    includeCreateMenuAi?: boolean;
} = {}): boolean {
    const normalizedCommandId = String(commandId || '').trim().toLowerCase();
    const store = useUIStore.getState();
    switch (normalizedCommandId) {
        case 'createnote':
        case 'createnotes':
            store.openCreateItem('note', { id: 'new', props: { category: 'note' } });
            return true;
        case 'createlink':
        case 'createlinks':
            store.openCreateItem('link', { id: 'new', props: { category: 'link' } });
            return true;
        case 'createsnippet':
            store.openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
            return true;
        case 'createtodo':
            store.setTodoCreatePrefill({ isCreateModalOnly: true } as any);
            store.openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
            return true;
        case 'createprompt':
            store.openCreateItem('aiPrompt', { id: 'new', props: {} });
            return true;
        case 'agent':
            store.openCreateItem('agent', {
                id: 'new',
                isNew: true,
                props: { editMode: false },
            });
            return true;
        case 'ai':
            if (!options.includeCreateMenuAi)
                return false;
            store.openCreateItem('agent', {
                id: 'new',
                isNew: true,
                props: { editMode: false },
            });
            return true;
        default:
            return false;
    }
}
const CREATE_PATH_BUILDERS: ReadonlyArray<{
    aliases: readonly string[];
    buildPath: () => string;
}> = [
    { aliases: ['notes'], buildPath: () => buildCommandTerminalNewtabPath({ createNote: true }) },
    { aliases: ['snippets', 'text expander', 'text expanders'], buildPath: () => buildCommandTerminalNewtabPath({ createSnippet: true }) },
    { aliases: ['links', 'bookmarks'], buildPath: () => buildCommandTerminalNewtabPath({ createLink: true }) },
    { aliases: ['sessions', 'tab sessions'], buildPath: () => buildCommandTerminalNewtabPath({ sessionMode: true }) },
    { aliases: ['todos'], buildPath: () => buildCommandTerminalNewtabPath({ createTodo: true }) },
    { aliases: ['chat agents', 'chat_agents'], buildPath: () => buildCommandTerminalNewtabPath({ createChatAgent: true }) },
    { aliases: ['commands', 'system commands', 'system_commands'], buildPath: () => buildNewtabHotkeyCommandPath('new') }
];
/** Creates the service object passed into shared command definitions when they run inside the newtab surface. */
export function createNewtabCommandServices(_state: any, baseServices: CommandServiceBase): CommandContext['services'] {
    return {
        ...baseServices,
        navigateToView: (view: any) => useUIStore.getState().setView(view),
        setPendingAgent: (agent: any) => useUIStore.getState().setPendingAgent(agent),
        setSelectedOrganisation: (organisation: any) => useUIStore.getState().setSelectedOrganisationId(organisation?.organisation_id ?? organisation?.id ?? null),
        setSelectedSnippet: (snippet: any) => useUIStore.getState().setSelectedSnippetId(snippet?.id ?? snippet?.snippet_id ?? null),
        setIsAutoExpandMode: (isAutoExpand: boolean) => useUIStore.getState().setIsAutoExpandMode(isAutoExpand),
        urls: {
            docs: CMDOS_DOCS_URL,
        },
    };
}
/** Converts shared command navigation intents into the concrete newtab editors and sidebars. */
export function handleNewtabCommandNavigation(view: SearchPopupView | any): void {
    if (view.kind === 'noteEditor') {
        const category = view.noteProps?.category || 'note';
        useUIStore.getState().openEditor({
            type: category === 'snippet' ? 'snippet' : 'note',
            id: 'new',
            props: { category },
        });
    }
    else if (view.kind === 'linkEditor') {
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
    }
    else if (view.kind === 'sessionEditor') {
        useUIStore.getState().openEditor({ type: 'session', id: 'new' });
    }
    else if (view.kind === 'commandList') {
        useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
    }
    else if (view.kind === 'home') {
        useUIStore.getState().setView({ type: 'home' });
    }
    else if (view.kind === 'custom') {
        useUIStore.getState().openEditor({ type: 'aiPrompt' as any, id: 'new' });
    }
}
/** Builds the extension URL used when an embedded widget must hand a UI command to the full newtab page. */
export function buildNewtabCommandTriggerUrl(commandId: string): string {
    const chromeAny = (window as any)?.chrome;
    return chromeAny.runtime.getURL(buildNewtabHotkeyCommandPath(commandId));
}
/** Maps embedded BoardView category-create requests to the matching newtab URL trigger. */
export function buildNewtabCreatePathForCategory(groupKey: string): string | null {
    const normalizedGroupKey = String(groupKey || '').trim().toLowerCase();
    return CREATE_PATH_BUILDERS.find(({ aliases }) => aliases.includes(normalizedGroupKey))?.buildPath();
}
/** Runs local newtab app commands and returns true when the command was fully handled. */
export function executeNewtabAppCommand(options: ExecuteNewtabAppCommandOptions): boolean {
    const { commandId, isEmbedded = false, openTab, setSelectedSidebarSection } = options;
    const chromeAny = (window as any)?.chrome;
    const targetCommand = SHARED_ALL_COMMANDS.find((command: any) => command.id === commandId);
    if (executeRetiredCreateUiAction(commandId)) {
        return true;
    }
    if (targetCommand && targetCommand.urlTemplate && commandId !== 'tutorials') {
        return false;
    }
    if (targetCommand && isEmbedded && chromeAny?.runtime?.getURL) {
        openTab({ url: buildNewtabCommandTriggerUrl(commandId) });
        return true;
    }
    if (targetCommand?.execute) {
        targetCommand.execute({
            services: createNewtabCommandServices(null, {
                toast: () => undefined,
                navigation: handleNewtabCommandNavigation,
                reload: () => window.location.reload(),
            }),
        } as any);
        return true;
    }
    switch (commandId) {
        case 'tutorials':
            openTab({ url: CMDOS_DOCS_URL });
            return true;
        case 'refresh':
            window.location.reload();
            return true;
        case 'toggle-dark-mode':
            document.documentElement.classList.toggle('dark');
            return true;
        case 'calendar':
            chromeAny?.runtime?.sendMessage?.({
                action: 'open_tab_with_auto_submit',
                url: 'https://gemini.google.com/app',
                autoSubmit: { kind: 'gemini', prompt: 'Help me manage my calendar and schedule.' },
                forceNewTab: true,
            });
            return true;
        case 'bookmarks':
            if (isEmbedded && chromeAny?.runtime?.getURL)
                openTab({ url: buildNewtabCommandTriggerUrl(commandId) });
            else
                setSelectedSidebarSection?.('bookmarks');
            return true;
        case 'shortcuts':
            if (isEmbedded && chromeAny?.runtime?.getURL)
                openTab({ url: buildNewtabCommandTriggerUrl(commandId) });
            else
                useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
            return true;
        case 'store':
            if (isEmbedded && chromeAny?.runtime?.getURL)
                openTab({ url: buildNewtabCommandTriggerUrl(commandId) });
            else
                useUIStore.getState().setSidebar('storeSidebar' as any, { open: true });
            return true;
        default:
            return false;
    }
}

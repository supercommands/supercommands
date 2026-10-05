import type { CommandModule } from './types';
export const SearchCommand: CommandModule = {
    id: 'search',
    label: 'Search Commands',
    prefix: 'search',
    keywords: ['search', 'commands', 'all commands', 'list'],
    behavior: 'instant',
    surface: 'both',
    execute: context => {
        if (typeof window !== 'undefined') {
            const targetUrl = new URL(window.location.href);
            targetUrl.searchParams.set('open_sheet', 'commands');
            window.history.replaceState({}, '', targetUrl.toString());
        }
        context.services.navigation({ kind: 'commandList', category: 'general_commands' });
    },
};
export const AiAllCommand: CommandModule = {
    id: 'ai',
    label: 'All AI Chat Agents',
    prefix: 'ai',
    keywords: ['ai', 'all ai', 'chat agents', 'assistant', 'prompt'],
    behavior: 'locked',
    category: 'ai',
    surface: 'both',
    url: '',
};
export const ChatGPTCommand: CommandModule = {
    id: 'gpt',
    label: 'ChatGPT',
    prefix: 'gpt',
    keywords: ['chatgpt', 'openai', 'gpt', 'ai'],
    behavior: 'instant',
    surface: 'both',
    category: 'ai',
    iconHost: 'chatgpt.com',
    autoSubmit: 'chatgpt',
    urlTemplate: 'https://chatgpt.com/',
    showInDashboard: false,
};
export const ClaudeCommand: CommandModule = {
    id: 'claude',
    label: 'Claude',
    prefix: 'claude',
    keywords: ['claude', 'anthropic', 'ai'],
    behavior: 'instant',
    surface: 'both',
    category: 'ai',
    iconHost: 'claude.ai',
    autoSubmit: 'claude',
    urlTemplate: 'https://claude.ai/new',
    showInDashboard: false,
};
export const GeminiCommand: CommandModule = {
    id: 'gemini',
    label: 'Gemini',
    prefix: 'gemini',
    keywords: ['gemini', 'google ai', 'ai'],
    behavior: 'instant',
    surface: 'both',
    category: 'ai',
    iconHost: 'gemini.google.com',
    autoSubmit: 'gemini',
    urlTemplate: 'https://gemini.google.com/app',
    showInDashboard: false,
};
export const PerplexityCommand: CommandModule = {
    id: 'perplexity',
    label: 'Perplexity',
    prefix: 'perplexity',
    keywords: ['perplexity', 'search', 'ai'],
    behavior: 'instant',
    surface: 'both',
    category: 'ai',
    iconHost: 'perplexity.ai',
    autoSubmit: 'perplexity',
    urlTemplate: 'https://www.perplexity.ai/',
    showInDashboard: false,
};
export const CaptureScreenshotCommand: CommandModule = {
    id: 'capture_screenshot',
    label: 'Capture Screenshot',
    prefix: 'screenshot',
    keywords: ['capture', 'shot', 'image', 'photo', 'screen', 'visible', 'png'],
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
    execute: () => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' });
    },
};
export const CaptureClipScreenshotCommand: CommandModule = {
    id: 'capture_clip_screenshot',
    label: 'Clip & Download Screenshot',
    prefix: 'clipscreenshot',
    keywords: ['clip', 'copy', 'screenshot', 'capture', 'shot', 'image', 'clipboard', 'png'],
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
    execute: () => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_AND_CLIP_VISIBLE_TAB' });
    },
};
export const CaptureElementCommand: CommandModule = {
    id: 'capture_element_screenshot',
    label: 'Capture Element',
    prefix: 'elementscreenshot',
    keywords: ['capture', 'element', 'part', 'select', 'pick', 'hover', 'screenshot', 'section'],
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
    showInDashboard: false,
    execute: () => {
        chrome.runtime.sendMessage({ action: 'INIT_ELEMENT_SELECTION' });
    },
};
export const CaptureFullPageCommand: CommandModule = {
    id: 'capture_full_screenshot',
    label: 'Capture Full Page',
    prefix: 'fullscreenshot',
    keywords: ['capture', 'full', 'page', 'scroll', 'screenshot', 'whole', 'entire', 'png'],
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
    execute: () => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_FULL_PAGE' });
    },
};
export const DownloadAllImagesCommand: CommandModule = {
    id: 'downloadallimages',
    label: 'Download All Images',
    prefix: 'dp',
    keywords: ['download', 'images', 'all', 'save', 'export', 'bulk', 'pictures', 'photos'],
    description: 'Scan the page and bulk-download all images',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const DownloadAllTablesCommand: CommandModule = {
    id: 'downloadalltables',
    label: 'Download All Tables',
    prefix: 'tables',
    keywords: ['download', 'tables', 'all', 'save', 'export', 'csv', 'excel', 'data', 'spreadsheet'],
    description: 'Parse all table elements and download them as CSV files',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const MergeWindowsCommand: CommandModule = {
    id: 'merge_windows',
    label: 'Merge All Windows',
    prefix: 'merge',
    keywords: ['merge', 'windows', 'tabs', 'consolidate', 'group'],
    description: 'Merge all open tabs from all windows into the current window',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const CloseDuplicateTabsCommand: CommandModule = {
    id: 'close_duplicate_tabs',
    label: 'Close Duplicate Tabs',
    prefix: 'duplicate',
    keywords: ['close', 'duplicate', 'tabs'],
    description: 'Close duplicate tabs with identical URLs',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const MuteAllTabsCommand: CommandModule = {
    id: 'mute_all_tabs',
    label: 'Mute All Tabs',
    prefix: 'mute',
    keywords: ['mute', 'tabs', 'silence'],
    description: 'Mute all open tabs in the current window',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const UnmuteAllTabsCommand: CommandModule = {
    id: 'unmute_all_tabs',
    label: 'Unmute All Tabs',
    prefix: 'unmute',
    keywords: ['unmute', 'tabs', 'sound'],
    description: 'Unmute all open tabs in the current window',
    behavior: 'instant',
    surface: 'website',
    category: 'page_action',
};
export const SaveLinkCommand: CommandModule = {
    id: 'save_link',
    label: 'Save Link',
    prefix: '',
    keywords: ['save link', 'saved link', 'current page', 'bookmark page'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const SaveTodoCommand: CommandModule = {
    id: 'save_todo',
    label: 'To Do',
    prefix: 'td',
    keywords: ['save todo', 'save task', 'todo from page', 'current page todo'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const SaveNoteCommand: CommandModule = {
    id: 'save_note',
    label: 'Save Note',
    prefix: 'cn',
    keywords: ['save note', 'note from page', 'current page note'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const SaveSnippetCommand: CommandModule = {
    id: 'save_snippet',
    label: 'Save Text Expander',
    prefix: 'cs',
    keywords: ['save text expander', 'save snippet', 'snippet from page'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const SaveChatAgentCommand: CommandModule = {
    id: 'save_chat',
    label: 'Save Chat Agent',
    prefix: 'save_agent',
    keywords: ['save chat agent', 'save agent', 'chat agent from page'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const AddToExistingWorkspaceCommand: CommandModule = {
    id: 'add_to_existing',
    label: 'Add to Existing Workspace Session',
    prefix: 'elc',
    keywords: ['add to existing', 'existing workspace session', 'save to workspace'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const AddToExistingWorkspaceSessionCommand: CommandModule = {
    id: 'add_to_existing_session',
    label: 'Add to Existing Workspace Session',
    prefix: 'es',
    keywords: ['add to existing session', 'existing workspace session', 'existing workspace'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const SendToAgentCommand: CommandModule = {
    id: 'send_to_agent',
    label: 'Send to Agent',
    prefix: 'send_agent',
    keywords: ['send to agent', 'agent', 'current page agent'],
    behavior: 'instant',
    surface: 'website',
    category: 'thissite_action',
};
export const INSTANT_COMMANDS: CommandModule[] = [
    SearchCommand,
    // CreateWorkspaceCommand,
    AiAllCommand,
    ChatGPTCommand,
    ClaudeCommand,
    GeminiCommand,
    PerplexityCommand,
    CaptureScreenshotCommand,
    CaptureClipScreenshotCommand,
    CaptureElementCommand,
    CaptureFullPageCommand,
    DownloadAllImagesCommand,
    DownloadAllTablesCommand,
    MergeWindowsCommand,
    CloseDuplicateTabsCommand,
    MuteAllTabsCommand,
    UnmuteAllTabsCommand,
    SaveLinkCommand,
    SaveTodoCommand,
    SaveNoteCommand,
    SaveSnippetCommand,
    SaveChatAgentCommand,
    AddToExistingWorkspaceCommand,
    AddToExistingWorkspaceSessionCommand,
    SendToAgentCommand
];
export const ENTITY_COMMANDS: CommandModule[] = [];
export const LOCKED_COMMANDS: CommandModule[] = [];
export const QUERY_COMMANDS: CommandModule[] = [
    {
        id: 'history',
        label: 'History',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://history',
        iconHost: 'google.com',
        keywords: ['history', 'recent', 'past', 'visited', 'core'],
        category: 'browser',
    },
    {
        id: 'extensions',
        label: 'Extensions',
        behavior: 'instant',
        prefix: 'extensions',
        urlTemplate: 'chrome://extensions',
        iconHost: 'google.com',
        keywords: ['extensions', 'plugins', 'addons', 'browser extensions', 'core'],
        category: 'browser',
    },
    {
        id: 'downloads',
        label: 'Downloads',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://downloads',
        iconHost: 'google.com',
        keywords: ['downloads', 'files', 'downloaded', 'core'],
        category: 'browser',
    },
    {
        id: 'passwords',
        label: 'Passwords',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://password-manager',
        iconHost: 'google.com',
        keywords: ['passwords', 'credentials', 'login', 'manager', 'core'],
        category: 'browser',
    },
    {
        id: 'flags',
        label: 'Flags',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://flags',
        iconHost: 'google.com',
        keywords: ['flags', 'experimental', 'features', 'dev'],
        category: 'browser',
    },
    {
        id: 'inspect',
        label: 'Inspect',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://inspect',
        iconHost: 'google.com',
        keywords: ['inspect', 'developer', 'tools', 'debug', 'dev'],
        category: 'browser',
    },
    {
        id: 'version',
        label: 'Version',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://version',
        iconHost: 'google.com',
        keywords: ['version', 'build', 'about', 'info', 'dev'],
        category: 'browser',
    },
    {
        id: 'gpu',
        label: 'GPU',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://gpu',
        iconHost: 'google.com',
        keywords: ['gpu', 'graphics', 'acceleration', 'perf', 'performance'],
        category: 'browser',
    },
    {
        id: 'dino',
        label: 'Dino Game',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://dino',
        iconHost: 'google.com',
        keywords: ['dino', 'game', 't-rex', 'offline', 'fun'],
        category: 'browser',
    },
    {
        id: 'about',
        label: 'About Browser',
        behavior: 'instant',
        prefix: '',
        urlTemplate: 'chrome://about',
        iconHost: 'google.com',
        keywords: ['about', 'list', 'urls', 'chrome urls', 'all'],
        category: 'browser',
    }
];
export const ALL_COMMANDS: CommandModule[] = [...INSTANT_COMMANDS, ...ENTITY_COMMANDS, ...LOCKED_COMMANDS, ...QUERY_COMMANDS];

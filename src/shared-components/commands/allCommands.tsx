import React from 'react';
import type { CommandModule } from './types';
import { AiPromptEditorView } from '../../allObjectFolder/src/createObject/aiPrompt';
import { useUIStore } from '../uiStateManager';

export const SearchCommand: CommandModule = {
  id: 'search',
  label: 'Search Commands',
  prefix: 'search',
  keywords: ['search', 'commands', 'all commands', 'list'],
  behavior: 'instant',
  surface: 'both',
  execute: context => {
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set('open_sheet', 'commands');
    window.history.replaceState({}, '', targetUrl.toString());

    context.services.navigation({ kind: 'commandList', category: 'general_commands' });
  },
};

export const CreateNoteCommand: CommandModule = {
  id: 'createnotes',
  label: 'Create Notes',
  prefix: 'createnotes',
  keywords: ['create note', 'new note', 'note', 'notes', 'add note', 'save note'],
  behavior: 'instant',
  execute: context => {
    context.services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'note',
        onClose: () => context.services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateSnippetCommand: CommandModule = {
  id: 'createsnippet',
  label: 'Create Snippet',
  prefix: 'createsnippet',
  keywords: ['create snippet', 'new snippet', 'snippet', 'snippets', 'add snippet', 'save snippet'],
  behavior: 'instant',
  execute: context => {
    context.services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'snippet',
        onClose: () => context.services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateLinkCommand: CommandModule = {
  id: 'createlinks',
  label: 'Create Smart Links',
  prefix: 'createlinks',
  keywords: ['create link', 'new link', 'link', 'links', 'save link', 'saved link'],
  behavior: 'instant',
  execute: context => {
    context.services.navigation({
      kind: 'linkEditor',
      linkProps: {
        onClose: () => context.services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateSessionCommand: CommandModule = {
  id: 'createsession',
  label: 'Create Tab session',
  prefix: 'createsession',
  keywords: ['create Tab Session', 'new Tab Session', 'Tab Session', 'Tab Sessions', 'session', 'sessions'],
  behavior: 'instant',
  execute: context => {
    context.services.navigation({
      kind: 'sessionEditor',
      sessionProps: {
        onClose: () => context.services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreatePromptCommand: CommandModule = {
  id: 'createprompt',
  label: 'Create AI Prompt',
  prefix: 'createprompt',
  keywords: ['create prompt', 'new prompt', 'prompt', 'prompts', 'ai prompt'],
  behavior: 'instant',
  surface: 'both',
  execute: context => {
    context.services.navigation({
      kind: 'custom',
      element: () => <AiPromptEditorView onBack={() => context.services.navigation({ kind: 'home' })} />,
    });
  },
};

export const CreateTodoCommand: CommandModule = {
  id: 'createtodo',
  label: 'Create Todo',
  prefix: 'createtodo',
  keywords: ['create todo', 'new todo', 'todo', 'task', 'add todo', 'save todo'],
  behavior: 'instant',
  surface: 'both',
  execute: context => {
    useUIStore.getState().setView({ type: 'home' });
    useUIStore.getState().openCreateItem('todo', {
      id: 'new',
      props: { prefill: { isCreateModalOnly: true } as any },
      openTodoSidebar: true,
    });
  },
};

export const CreateFolderCommand: CommandModule = {
  id: 'createfolder',
  label: 'Create Folder',
  prefix: 'createfolder',
  keywords: ['create folder', 'new folder', 'folder', 'folders'],
  behavior: 'instant',
  surface: 'both',
  execute: context => {
    context.services.navigation({
      kind: 'folderEditor',
      folderProps: {
        onClose: () => context.services.navigation({ kind: 'home' }),
        reload: context.services.reload,
      },
    });
  },
};

export const CreateWorkspaceCommand: CommandModule = {
  id: 'createworkspace',
  label: 'Create Workspace',
  prefix: 'createworkspace',
  keywords: ['create workspace', 'new workspace', 'workspace', 'workspaces'],
  behavior: 'instant',
  surface: 'both',
  execute: context => {
    context.services.navigation({ kind: 'createWorkspace' });
  },
};

export const CreateAutomationAgentCommand: CommandModule = {
  id: 'agent',
  label: 'Create Automation Agent (beta)',
  prefix: 'agent',
  keywords: ['agent', 'automation', 'automation agent', 'workflow', 'automation beta'],
  behavior: 'instant',
  surface: 'both',
  category: 'automation',
  execute: context => {
    useUIStore.getState().setView({ type: 'home' });
    useUIStore.getState().openCreateItem('agent', {
      id: 'new',
      isNew: true,
      props: { editMode: false, automation: null },
    });
    context.services.clearDraftAutomation();
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

export const CaptureElementCommand: CommandModule = {
  id: 'capture_element_screenshot',
  label: 'Capture Element',
  prefix: 'elementscreenshot',
  keywords: ['capture', 'element', 'part', 'select', 'pick', 'hover', 'screenshot', 'section'],
  behavior: 'instant',
  surface: 'website',
  category: 'page_action',
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

export const INSTANT_COMMANDS: CommandModule[] = [
  SearchCommand,
  CreateNoteCommand,
  CreateSnippetCommand,
  CreateLinkCommand,
  CreateSessionCommand,
  CreatePromptCommand,
  CreateTodoCommand,
  CreateFolderCommand,
  CreateWorkspaceCommand,
  CreateAutomationAgentCommand,
  AiAllCommand,
  ChatGPTCommand,
  ClaudeCommand,
  GeminiCommand,
  PerplexityCommand,
  CaptureScreenshotCommand,
  CaptureElementCommand,
  CaptureFullPageCommand,
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
  },
];

export const ALL_COMMANDS: CommandModule[] = [...INSTANT_COMMANDS, ...ENTITY_COMMANDS, ...LOCKED_COMMANDS, ...QUERY_COMMANDS];

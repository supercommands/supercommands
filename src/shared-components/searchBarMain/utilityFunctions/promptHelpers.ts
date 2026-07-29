import type { AnyCommandId, CommandSelectionInfo, CommandSuggestionItem } from './types';
import type { CommandId, CommandDefinition } from '../commandConfigurations/commands';
import { COMMANDS, AI_GROUP } from '../commandConfigurations/commands';
import type { LocalCommandId, LocalCommandDefinition } from '../commandConfigurations/localCommands';
import { LOCAL_COMMANDS, isLocalCommandId } from '../commandConfigurations/localCommands';
import type { SavedAutomation } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

export const BOOKMARKS_COMMAND_ID = 'bookmarks' as LocalCommandId;
export const isBookmarksCommand = (cmd: AnyCommandId | null): boolean => cmd === BOOKMARKS_COMMAND_ID;
export const trimQuery = (value: string): string => value.trim();
export const STATIC_PLACEHOLDER = 'Type to search';
export const COMMAND_PREVIEW_HINT = 'Press Tab/Enter to ask in command mode.';

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeCommandToken = (token: string): string => token.replace(/^\//, '').toLowerCase();

const ALL_AI_AGENT_IDS = new Set(['all_ai', 'all']);
const ALL_AI_ROOT_MODULE_IDS = new Set(['all_ai']);
const AI_AUTOMATION_FILTER_DEBUG_STORAGE_KEY = 'debug_ai_automation_filter';

export const isAiAutomationFilterDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const globalFlag = Boolean((window as any)?.__DEBUG_AI_AUTOMATION_FILTER__);
    return globalFlag;
  } catch {
    return false;
  }
};

export const extractPromptFromInput = (
  input: string,
  info: { id: AnyCommandId; prefix: string },
): { prompt: string; matched: boolean } => {
  const trimmed = trimQuery(input);
  if (!trimmed) {
    return { prompt: '', matched: false };
  }

  const tokens = Array.from(
    new Set([normalizeCommandToken(String(info.id)), normalizeCommandToken(info.prefix)]),
  ).filter(Boolean);
  if (tokens.length === 0) {
    return { prompt: trimmed, matched: false };
  }

  const pattern = new RegExp(`^\\/?(${tokens.map(escapeRegExp).join('|')})(?:\\s+|:)?`, 'i');
  const match = trimmed.match(pattern);
  if (!match) {
    return { prompt: trimmed, matched: false };
  }

  const prompt = trimQuery(trimmed.slice(match[0].length));
  return { prompt, matched: true };
};

export const resolvePlaceholderFromCmd = (cmd: AnyCommandId | null): string => {
  if (!cmd) return STATIC_PLACEHOLDER;
  const c = String(cmd).toLowerCase();

  // AI group: /ai and member commands
  const aiIds = new Set<string>([...AI_GROUP.members.map(id => id.toLowerCase()), 'ai']);
  if (aiIds.has(c)) {
    if (c === 'gpt') return 'Ask ChatGPT...';
    if (c === 'claude') return 'Ask Claude...';
    if (c === 'gemini') return 'Ask Gemini...';
    if (c === 'perplexity') return 'Ask Perplexity...';
    return 'Ask anything...';
  }

  if (c === 'upload_drive') {
    return 'Attach files (Ctrl+U or paste)';
  }

  // Web search commands
  if (c === 'g' || c === 'google' || c === 'bing' || c === 'duck' || c === 'yt' || c === 'perplexity') {
    return 'Search here';
  }

  if (c === 'store') {
    return 'Search the store...';
  }

  // Event creation
  if (c === 'event' || c === 'calendar') {
    return 'Eg: meeting tomorrow at 9 PM with einstein@mail.com';
  }

  // Spotify
  if (c === 'spotify') {
    return 'Enter song name...';
  }

  // Local create commands
  if (c === 'createnotes') {
    return '';
  }
  if (c === 'createlinks') {
    return '';
  }

  // Bookmarks mode
  if (c === BOOKMARKS_COMMAND_ID) {
    return 'Search bookmarks';
  }

  return STATIC_PLACEHOLDER;
};

export const getTextMatchScore = (candidate: unknown, rawQuery: string): number | null => {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim().toLowerCase();
  const query = rawQuery.trim().toLowerCase();
  if (!text || !query) return null;
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.includes(query)) return 2;
  return null;
};

export const isPureAiAutomation = (automation: SavedAutomation): boolean => {
  const debugEnabled = isAiAutomationFilterDebugEnabled();
  const debug = (message: string, extra?: Record<string, unknown>) => {
    if (!debugEnabled) return;
  };

  if (!automation || !Array.isArray(automation.steps) || automation.steps.length === 0) {
    debug('Rejected: missing or empty steps');
    return false;
  }

  const getNestedSteps = (step: any): any[] => {
    const fromSubSteps = Array.isArray(step?.subSteps) ? step.subSteps : [];
    const fromConfigSubAutomation =
      String(step?.moduleId || step?.type || '').toLowerCase() === 'sub_automation' &&
      Array.isArray(step?.config?.steps)
        ? step.config.steps
        : [];
    return [...fromSubSteps, ...fromConfigSubAutomation];
  };

  const isAllAiRootStep = (step: any): boolean => {
    const moduleId = String(step?.moduleId || step?.type || '').toLowerCase();
    if (ALL_AI_ROOT_MODULE_IDS.has(moduleId)) return true;
    if (moduleId === 'agent') {
      const agentId = String(step?.config?.agentId || step?.config?.id || '').toLowerCase();
      return ALL_AI_AGENT_IDS.has(agentId);
    }
    return false;
  };

  const walkStep = (step: any, inAllAiContext: boolean): { valid: boolean; hasAiStep: boolean } => {
    const moduleId = String(step?.moduleId || step?.type || '').toLowerCase();
    const nested = getNestedSteps(step);

    if (isAllAiRootStep(step)) {
      const nestedResult = nested.length > 0 ? walkSteps(nested, true) : { valid: true, hasAiStep: false };
      if (!nestedResult.valid) return { valid: false, hasAiStep: false };
      debug('Accepted: ALL AI root found', { moduleId, agentId: step?.config?.agentId });
      return { valid: true, hasAiStep: true };
    }

    if (!inAllAiContext && nested.length > 0) {
      const nestedResult = walkSteps(nested, false);
      if (nestedResult.valid && nestedResult.hasAiStep) {
        debug('Accepted: ALL AI root found in nested substeps', { moduleId });
        return { valid: true, hasAiStep: true };
      }
      if (!nestedResult.valid) {
        return { valid: false, hasAiStep: false };
      }
    }

    if (!inAllAiContext) {
      debug('Rejected: missing ALL AI root', { moduleId });
      return { valid: false, hasAiStep: false };
    }

    if (nested.length === 0) {
      return { valid: true, hasAiStep: false };
    }

    return walkSteps(nested, true);
  };

  const walkSteps = (steps: any[], inAiContext: boolean): { valid: boolean; hasAiStep: boolean } => {
    let hasAiStep = false;

    for (const step of steps) {
      const stepResult = walkStep(step, inAiContext);
      if (!stepResult.valid) return { valid: false, hasAiStep: false };
      if (stepResult.hasAiStep) hasAiStep = true;
    }

    return { valid: true, hasAiStep };
  };

  const result = walkSteps(automation.steps, false);
  if (debugEnabled) {
    debug(result.valid && result.hasAiStep ? 'Accepted: ALL AI root found' : 'Rejected: missing ALL AI root', {
      valid: result.valid,
      hasAiStep: result.hasAiStep,
    });
  }
  return result.valid && result.hasAiStep;
};

export const buildSelectionInfoFromSuggestion = (item: CommandSuggestionItem): CommandSelectionInfo | null => {
  if (!item) return null;
  if (item.commandType === 'remote') {
    // Browser commands don't require inline queries - they execute immediately
    const isBrowserCommand = item.command?.category === 'browser' && !item.command.urlTemplate.includes('{query}');
    return {
      id: item.id,
      label: item.label,
      prefix: item.prefix,
      commandType: 'remote',
      requiresInlineQuery: !isBrowserCommand && !AI_GROUP.members.includes(item.id as any), // Browser commands don't need prompts, AI commands use main Searchbar
    };
  }
  if (item.commandType === 'aggregate') {
    return {
      id: item.id,
      label: item.label,
      prefix: item.prefix,
      commandType: 'aggregate',
      requiresInlineQuery: item.id !== 'ai', // AI Chat ('ai') uses a large middle input, not the inline pill box
    };
  }
  // Local commands generally don't use inline query mode
  return {
    id: item.id,
    label: item.label,
    prefix: item.prefix,
    commandType: 'local',
    requiresInlineQuery: item.id === 'calendar',
  };
};

export const buildSelectionInfoFromId = (
  commandId: AnyCommandId,
  commands: CommandDefinition[],
): CommandSelectionInfo | null => {
  if (commandId === 'ai') {
    return {
      id: 'ai',
      label: AI_GROUP.label,
      prefix: AI_GROUP.prefix,
      commandType: 'aggregate',
      requiresInlineQuery: false, // AI Chat uses a large middle input, not the inline pill box
    };
  }
  if (commandId === 'store') {
    return {
      id: 'store',
      label: 'Automation Store',
      prefix: '/store',
      commandType: 'local',
      requiresInlineQuery: false,
    };
  }
  const remoteDef = commands.find(c => String(c.id) === String(commandId as CommandId)) ||
    COMMANDS.find(c => String(c.id) === String(commandId as CommandId));
  if (remoteDef) {
    // Browser commands don't require inline queries - they execute immediately
    const isBrowserCommand = remoteDef.category === 'browser' && !remoteDef.urlTemplate.includes('{query}');
    return {
      id: remoteDef.id,
      label: remoteDef.label,
      prefix: remoteDef.prefix,
      commandType: 'remote',
      requiresInlineQuery: !isBrowserCommand, // Browser commands don't need prompts
    };
  }
  if (isLocalCommandId(commandId)) {
    const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
    if (!localDef) return null;
    return {
      id: localDef.id as LocalCommandId,
      label: localDef.label,
      prefix: localDef.prefix,
      commandType: 'local',
      requiresInlineQuery:
        (localDef.id === 'calendar' || localDef.behavior === 'locked') &&
        localDef.id !== 'bookmarks',
    };
  }
  return null;
};

export const commandSupportsInlineQuery = (info: CommandSelectionInfo | null): info is CommandSelectionInfo => {
  return Boolean(info && info.requiresInlineQuery);
};

export const mapFullNameToShortcut = (text: string, slashFilterMeta?: Record<string, { label: string }>): string => {
  const mapping: Record<string, string> = {
    '/all': '/a',
    '/todos': '/t',
    '/notes': '/n',
    '/snippets': '/sn',
    '/tab sessions': '/se',
    '/sessions': '/se',
    '/prompts': '/p',
    '/links': '/l',
    '/commands': '/c',
    '/bookmarks': '/bm',
    '/chat agents': '/g',
    '/agents': '/g',
  };

  if (slashFilterMeta) {
    for (const [alias, meta] of Object.entries(slashFilterMeta)) {
      const fullName = `/${String(meta.label || '').trim().toLowerCase()}`;
      if (fullName.length <= 1) continue;
      mapping[fullName] = `/${alias}`;
    }
  }

  const lower = text.toLowerCase();
  for (const [fullName, shortcut] of Object.entries(mapping)) {
    if (lower.startsWith(fullName)) {
      return shortcut + text.slice(fullName.length);
    }
  }
  return text;
};

export const getHighlightedHtml = (val: string, slashFilterMeta?: Record<string, { label: string }>): string => {
  const match = val.match(/^\/[^\s\u00A0]*/);
  if (match && match[0]) {
    const prefix = match[0];
    const rest = val.slice(prefix.length);

    const lowerPrefix = prefix.toLowerCase();
    const staticLabels: Record<string, string> = {
      '/a': 'All',
      '/n': 'Notes',
      '/nm': 'Notes',
      '/sn': 'Snippets',
      '/s': 'Tab Sessions',
      '/se': 'Tab Sessions',
      '/p': 'Prompts',
      '/l': 'Links',
      '/c': 'Commands',
      '/b': 'Bookmarks',
      '/bm': 'Bookmarks',
      '/t': 'Todos',
      '/au': 'Automations',
      '/ca': 'Chat Agents',
      '/g': 'Chat Agents',
      '/sc': 'System Commands',
    };
    const dynamicLabel = slashFilterMeta?.[lowerPrefix.slice(1)]?.label;
    const label = dynamicLabel || staticLabels[lowerPrefix] || prefix;
    const isFilterShortcut = !!dynamicLabel || !!staticLabels[lowerPrefix];

    const escapedRest = rest
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/ /g, '\u00A0');
    const escapedPrefix = prefix
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const hasSpaceAfter = rest.startsWith(' ') || rest.startsWith('\u00A0');

    if (isFilterShortcut && hasSpaceAfter) {
      return `<span data-slash-filter-chip="true" contenteditable="false" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(156, 163, 175, 0.15); border: 1.5px solid #9ca3af; color: #9ca3af; border-radius: 6px; padding: 1px 6px; font-weight: 700; margin-right: 4px; font-family: monospace; font-size: 13px;">${label}</span>${escapedRest}`;
    }

    return `${escapedPrefix}${escapedRest}`;
  }
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '\u00A0');
};

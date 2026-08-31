import type { LinkItem } from '../links/linkTypes';
import type { AiPromptRecord } from '../aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../ChatAgent/chatAgentTypes';
import { hasRunnableAiPrompt, runAiPrompt } from '../aiPrompt/runAiPrompt';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import {
  buildSessionLaunchUrls,
  parseSessionReferenceUrl,
} from './sessionReferenceUtils';
import {
  buildSessionLaunchPayload,
  launchSessionSmart,
  type LaunchSessionSmartInput,
} from '../../../../shared-components/sessions/launchSessionSmart';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSessionAgentSnapshot, type SessionAgentProviderKind } from './sessionAgentSnapshot';

export const SESSION_MISSING_AI_PROMPT_INPUT_EVENT = 'cmdos:session-missing-ai-prompt-input';

export type SessionMissingAiPromptInputEventDetail = {
  promptRecord?: AiPromptRecord;
  promptId: string;
  title?: string;
  targets?: SessionPromptTarget[];
};

export type SessionPromptTarget = {
  tabId: number;
  url: string;
  kind: SessionAgentProviderKind;
};

const requestMissingAiPromptInput = (
  detail: SessionMissingAiPromptInputEventDetail,
  shouldContinue?: () => boolean | Promise<boolean>,
): boolean => {
  if (typeof window === 'undefined') return false;
  // Session-control handoffs can arrive while App effects are still mounting.
  window.setTimeout(async () => {
    if (shouldContinue && (await shouldContinue()) === false) return;
    window.dispatchEvent(new CustomEvent(SESSION_MISSING_AI_PROMPT_INPUT_EVENT, { detail }));
  }, 0);
  return true;
};

export const handleSessionReferenceLaunchActions = async (
  items: Array<Pick<LinkItem, 'url' | 'title' | 'name' | 'originalData'> & { targetTabId?: number }> | undefined,
  {
    aiPrompts = [],
    chatAgents = [],
    shouldContinue,
  }: {
    aiPrompts?: AiPromptRecord[];
    chatAgents?: ChatAgentRecord[];
    shouldContinue?: () => boolean | Promise<boolean>;
  },
): Promise<void> => {
  if (!Array.isArray(items) || items.length === 0) return;

  const canContinue = async (): Promise<boolean> => {
    if (!shouldContinue) return true;
    try {
      return (await shouldContinue()) !== false;
    } catch {
      return false;
    }
  };
  if (!(await canContinue())) return;

  const missingPromptTargets = new Map<string, { title: string; targets: SessionPromptTarget[] }>();
  const handledKeys = new Set<string>();
  for (const item of items) {
    if (!(await canContinue())) return;
    const snapshot = getSessionAgentSnapshot(item);
    if (snapshot && typeof item.targetTabId === 'number' && snapshot.providerKind !== 'unknown') {
      const target = { tabId: item.targetTabId, url: item.url, kind: snapshot.providerKind };
      if (snapshot.prompt.trim()) {
        chrome.runtime
          .sendMessage({
            action: 'open_tab_with_auto_submit',
            url: item.url,
            targetTabId: item.targetTabId,
            active: false,
            forceNewTab: false,
            autoSubmit: { kind: snapshot.providerKind, prompt: snapshot.prompt.trim() },
          })
          .catch(error => console.error('[sessionReferenceActions] Failed to submit snapshot prompt:', error));
      } else {
        const pending = missingPromptTargets.get(snapshot.sourceId) || {
          title: snapshot.sourceTitle,
          targets: [],
        };
        pending.targets.push(target);
        missingPromptTargets.set(snapshot.sourceId, pending);
      }
      continue;
    }

    const reference = parseSessionReferenceUrl(item.url);
    if (!reference) continue;

    const referenceKey = `${reference.type}:${String(reference.id)}`;
    if (handledKeys.has(referenceKey)) continue;
    handledKeys.add(referenceKey);

    if (reference.type !== 'agent') continue;

    const promptRecord = aiPrompts.find(prompt => String(prompt.id) === String(reference.id));
    if (promptRecord) {
      if (hasRunnableAiPrompt(promptRecord)) {
        try {
          await runAiPrompt(promptRecord);
        } catch (error) {
          console.error('[sessionReferenceActions] Failed to run AI prompt reference:', error);
        }
      } else if (!requestMissingAiPromptInput(
        {
          promptRecord,
          promptId: String(promptRecord.id),
        },
        canContinue,
      )) {
        useUIStore.getState().openItemEditor('aiPrompt', String(promptRecord.id));
      }
      continue;
    }

    const chatAgentRecord = chatAgents.find(agent => String(agent.id) === String(reference.id));
    if (chatAgentRecord) {
      useUIStore.getState().openEditor({ type: 'ai', id: String(chatAgentRecord.id) });
    }
  }

  const missingGroups = Array.from(missingPromptTargets.entries());
  if (missingGroups.length > 0 && await canContinue()) {
    const promptId = missingGroups.map(([sourceId]) => sourceId).join(',');
    const title = missingGroups.length === 1 ? missingGroups[0][1].title : 'Session Chat Agents';
    requestMissingAiPromptInput(
      {
        promptId,
        title,
        targets: missingGroups.flatMap(([, pending]) => pending.targets),
      },
      canContinue,
    );
  }
};

export const openAddedSessionItems = async (
  items: LinkItem[],
  {
    sessionId,
    windowId,
    links = [],
    aiPrompts = [],
    chatAgents = [],
  }: {
    sessionId: string;
    windowId?: number;
    links?: Array<{ id?: string; title?: string; name?: string; urls?: unknown[] }>;
    aiPrompts?: AiPromptRecord[];
    chatAgents?: ChatAgentRecord[];
  },
): Promise<void> => {
  const launchUrls = buildSessionLaunchUrls(items, links);
  const openedTabsByUrl = new Map<string, number[]>();

  for (const url of launchUrls.openUrls) {
    if (!url) continue;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'open_tab_in_session',
        sessionId,
        url,
        ...(typeof windowId === 'number' ? { windowId } : {}),
      });
      if (typeof response?.tabId === 'number') {
        const tabIds = openedTabsByUrl.get(url) || [];
        tabIds.push(response.tabId);
        openedTabsByUrl.set(url, tabIds);
      }
    } catch (error) {
      console.error('[sessionReferenceActions] Failed to open added session URL:', error);
    }
  }

  const actionItems = items.map(item => {
    if (!getSessionAgentSnapshot(item)) return item;
    const tabIds = openedTabsByUrl.get(item.url) || [];
    const targetTabId = tabIds.shift();
    return typeof targetTabId === 'number' ? { ...item, targetTabId } : item;
  });
  await handleSessionReferenceLaunchActions(actionItems, { aiPrompts, chatAgents });
};

export const launchSessionSmartWithReferences = async (
  session: any,
  overrides: Omit<Partial<LaunchSessionSmartInput>, 'initialUrls' | 'initialNames' | 'openUrls' | 'openNames'> & {
    source: LaunchSessionSmartInput['source'];
  },
): Promise<any> => {
  const state = useDbStore.getState();
  const sessionItems = (Array.isArray(session?.urls) ? session.urls : [])
    .map((item: any) => (typeof item === 'string' ? { url: item, name: item } : item))
    .filter((item: any) => Boolean(item?.url));
  const launchUrls = buildSessionLaunchUrls(sessionItems, state.links || []);
  const controlTabActionItems = sessionItems.filter(item => {
    if (getSessionAgentSnapshot(item)) return true;
    const reference = parseSessionReferenceUrl(item.url);
    return Boolean(reference && reference.type !== 'note' && reference.type !== 'snippet');
  });

  const response = await launchSessionSmart({
    ...buildSessionLaunchPayload(session),
    ...overrides,
    initialUrls: launchUrls.initialUrls,
    initialNames: launchUrls.initialNames,
    openUrls: launchUrls.openUrls,
    openNames: launchUrls.openNames,
    sessionReferenceItems: controlTabActionItems,
  });

  return response;
};

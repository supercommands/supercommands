import type { AiPromptRecord } from '../aiPrompt/aiPromptTypes';
import { getAiPromptExecutionText } from '../aiPrompt/runAiPrompt';
import { resolveEnabledAiPromptModels } from '../aiPrompt/aiPromptModelHelpers';
import type { ChatAgentRecord } from '../ChatAgent/chatAgentTypes';
import type { LinkItem } from '../links/linkTypes';

export type SessionAgentProviderKind =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'mistral'
  | 'copilot'
  | 'google'
  | 'unknown';

export type SessionAgentTarget = {
  id: string;
  name: string;
  url: string;
  kind: SessionAgentProviderKind;
};

export type SessionAgentSuggestion = {
  id: string;
  title: string;
  prompt: string;
  targets: SessionAgentTarget[];
};

export type SessionAgentSnapshot = {
  sourceId: string;
  sourceTitle: string;
  providerId: string;
  providerName: string;
  providerKind: SessionAgentProviderKind;
  prompt: string;
};

export const normalizeSessionAgentUrl = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    parsed.searchParams.delete('cmd_select_status');
    return parsed.toString();
  } catch {
    return '';
  }
};

export const getSessionAgentUrlComparisonKey = (value: string): string => normalizeSessionAgentUrl(value);

export const getSessionAgentProviderKind = (value: string): SessionAgentProviderKind => {
  try {
    const host = new URL(normalizeSessionAgentUrl(value)).hostname.toLowerCase();
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return 'chatgpt';
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return 'claude';
    if (host === 'gemini.google.com') return 'gemini';
    if (host === 'perplexity.ai' || host.endsWith('.perplexity.ai')) return 'perplexity';
    if (host === 'mistral.ai' || host.endsWith('.mistral.ai')) return 'mistral';
    if (host === 'copilot.microsoft.com') return 'copilot';
    if (host.endsWith('.google.com')) return 'google';
  } catch {
    // Unsupported custom providers still remain normal session URLs.
  }
  return 'unknown';
};

const isDefaultProviderLandingUrl = (value: string): boolean => {
  const normalizedUrl = normalizeSessionAgentUrl(value);
  if (!normalizedUrl) return false;

  try {
    const parsed = new URL(normalizedUrl);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const hasTargetingData = parsed.search.length > 0 || parsed.hash.length > 0;
    if (hasTargetingData) return false;

    switch (getSessionAgentProviderKind(normalizedUrl)) {
      case 'chatgpt':
      case 'perplexity':
      case 'mistral':
      case 'copilot':
        return path === '/';
      case 'claude':
        return path === '/' || path === '/new';
      case 'gemini':
        return path === '/' || path === '/app';
      default:
        return false;
    }
  } catch {
    return false;
  }
};

const uniqueTargets = (targets: SessionAgentTarget[]): SessionAgentTarget[] => {
  const seen = new Set<string>();
  return targets.reduce<SessionAgentTarget[]>((items, target) => {
    const normalizedUrl = normalizeSessionAgentUrl(target.url);
    if (!normalizedUrl || isDefaultProviderLandingUrl(normalizedUrl) || seen.has(normalizedUrl)) return items;
    seen.add(normalizedUrl);
    items.push({ ...target, url: normalizedUrl });
    return items;
  }, []);
};

export const buildSessionAgentSuggestions = ({
  chatAgents,
  aiPrompts,
  excludedModelIds = [],
}: {
  chatAgents: ChatAgentRecord[];
  aiPrompts: AiPromptRecord[];
  excludedModelIds?: readonly string[];
}): SessionAgentSuggestion[] =>
  [
    ...chatAgents.map(agent => ({
      id: String(agent.id),
      title: agent.title || 'Untitled Agent',
      prompt: '',
      targets: uniqueTargets(
        (agent.urls || []).map((url, index) => {
          const normalizedUrl = normalizeSessionAgentUrl(url);
          let name = `Provider ${index + 1}`;
          try {
            name = new URL(normalizedUrl).hostname;
          } catch {
            // Keep the stable fallback name.
          }
          return {
            id: `url-${index}`,
            name,
            url: normalizedUrl,
            kind: getSessionAgentProviderKind(normalizedUrl),
          };
        }),
      ),
    })),
    ...aiPrompts.map(prompt => ({
      id: String(prompt.id),
      title: prompt.title || 'Untitled Agent',
      prompt: getAiPromptExecutionText(prompt),
      targets: uniqueTargets(
        resolveEnabledAiPromptModels(prompt, excludedModelIds)
          .map(model => {
            const url = normalizeSessionAgentUrl(prompt.modelUrls?.[model.id] || '');
            if (!url) return null;
            return {
              id: model.id,
              name: model.name || model.id,
              url,
              kind: getSessionAgentProviderKind(url),
            };
          })
          .filter((target): target is SessionAgentTarget => Boolean(target)),
      ),
    })),
  ].filter(agent => agent.targets.length > 0);

export const getSessionAgentSnapshot = (item: Pick<LinkItem, 'originalData'>): SessionAgentSnapshot | null => {
  const snapshot = item.originalData?.sessionAgentSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (!snapshot.sourceId || !snapshot.providerId || !snapshot.providerKind) return null;
  return snapshot as SessionAgentSnapshot;
};

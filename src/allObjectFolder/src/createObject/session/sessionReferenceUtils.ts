import type { LinkItem } from '../links/linkTypes';
import type { SessionRecord } from './sessionTypes';
import { updateSession } from './sessionData';
import { db } from '../../../../storage/indexDB/dbConfig';

export type SessionReferenceType = 'note' | 'link' | 'snippet' | 'agent';

export type SessionReferenceInfo = {
  type: SessionReferenceType;
  id: string;
};

const SESSION_REFERENCE_TYPES = new Set(['note', 'link', 'snippet', 'agent']);

export const parseSessionReferenceUrl = (url?: string): SessionReferenceInfo | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url, 'chrome-extension://session-reference/');
    const type = parsed.searchParams.get('type');
    if (!type || !SESSION_REFERENCE_TYPES.has(type)) return null;

    const id =
      parsed.searchParams.get('id') ||
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('noteid') ||
      parsed.searchParams.get('linkid') ||
      parsed.searchParams.get('snippetid') ||
      parsed.searchParams.get('agentid') ||
      '';

    if (!id) return null;
    return { type: type as SessionReferenceType, id };
  } catch {
    return null;
  }
};

export const resolveSessionReferenceSource = (
  item?: Pick<LinkItem, 'source' | 'url'>,
): LinkItem['source'] | undefined => {
  return parseSessionReferenceUrl(item?.url)?.type || item?.source;
};

export const isSessionReferenceTo = (
  item: Pick<LinkItem, 'url'>,
  type: SessionReferenceType,
  id: string,
): boolean => {
  const reference = parseSessionReferenceUrl(item.url);
  return Boolean(reference && reference.type === type && String(reference.id) === String(id));
};

export const normalizeSessionReferenceUrlForStorage = (url: string): string => {
  const reference = parseSessionReferenceUrl(url);
  if (!reference) return url;

  try {
    const parsed = new URL(url, 'chrome-extension://session-reference/');
    parsed.search = '';
    parsed.searchParams.set('session_reference', 'true');
    parsed.searchParams.set('type', reference.type);
    parsed.searchParams.set('id', reference.id);
    return parsed.href;
  } catch {
    return `AltS_search_newtab/index.html?session_reference=true&type=${encodeURIComponent(reference.type)}&id=${encodeURIComponent(reference.id)}`;
  }
};

export type SessionReferenceExistenceIndex = Record<SessionReferenceType, Set<string>>;

export const createSessionReferenceExistenceIndex = ({
  notes = [],
  links = [],
  snippets = [],
  chatAgents = [],
}: {
  notes?: Array<{ id?: string; snippet_id?: string }>;
  links?: Array<{ id?: string }>;
  snippets?: Array<{ id?: string }>;
  chatAgents?: Array<{ id?: string }>;
}): SessionReferenceExistenceIndex => ({
  note: new Set(notes.flatMap(item => [item.id, item.snippet_id].filter(Boolean).map(String))),
  link: new Set(links.map(item => item.id).filter(Boolean).map(String)),
  snippet: new Set(snippets.map(item => item.id).filter(Boolean).map(String)),
  agent: new Set(chatAgents.map(item => item.id).filter(Boolean).map(String)),
});

export const isSessionReferenceAvailable = (
  item: Pick<LinkItem, 'url'>,
  index: SessionReferenceExistenceIndex,
): boolean => {
  const reference = parseSessionReferenceUrl(item.url);
  if (!reference) return true;
  if (index[reference.type].size === 0) return true;
  return index[reference.type].has(String(reference.id));
};

export const filterAvailableSessionReferenceItems = <T extends Pick<LinkItem, 'url'>>(
  items: T[] | undefined,
  index: SessionReferenceExistenceIndex,
): T[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter(item => isSessionReferenceAvailable(item, index));
};

export const buildSessionLaunchUrls = (
  items: Array<Pick<LinkItem, 'url' | 'name' | 'title' | 'originalData'>> | undefined,
  _linkRecords: Array<{ id?: string; title?: string; name?: string; urls?: unknown[] }> = [],
): {
  initialUrls: string[];
  initialNames: string[];
  openUrls: string[];
  openNames: string[];
} => {
  const initialUrls: string[] = [];
  const initialNames: string[] = [];
  const openUrls: string[] = [];
  const openNames: string[] = [];
  (items || []).forEach(item => {
    const url = item?.url;
    if (!url) return;

    const title = item.name || item.title || url;
    const reference = parseSessionReferenceUrl(url);
    initialUrls.push(reference ? normalizeSessionReferenceUrlForStorage(url) : url);
    initialNames.push(title);

    if (reference?.type === 'note' || reference?.type === 'snippet') {
      openUrls.push(normalizeSessionReferenceUrlForStorage(url));
      openNames.push(title);
      return;
    }

    if (!reference) {
      openUrls.push(url);
      openNames.push(title);
      return;
    }

    // Reference entities remain one logical session item. Link entities are
    // not expanded into their child URLs during session launch.
  });

  return { initialUrls, initialNames, openUrls, openNames };
};

export const removeSessionReferencesForEntity = async (
  type: SessionReferenceType,
  id: string,
): Promise<number> => {
  return removeSessionReferencesForEntities([{ type, id }]);
};

export const removeSessionReferencesForEntities = async (
  targets: Array<{ type: SessionReferenceType; id: string }>,
): Promise<number> => {
  const targetKeys = new Set(targets.map(target => `${target.type}:${String(target.id)}`));
  if (targetKeys.size === 0) return 0;

  const sessions = await db.sessions.toArray();
  const changedSessions: Array<Pick<SessionRecord, 'id'> & { urls: LinkItem[] }> = [];

  sessions.forEach(session => {
    const urls = Array.isArray(session.urls) ? session.urls : [];
    const nextUrls = urls.filter(item => {
      const reference = parseSessionReferenceUrl(item.url);
      return !reference || !targetKeys.has(`${reference.type}:${String(reference.id)}`);
    });
    if (nextUrls.length !== urls.length) {
      changedSessions.push({ id: session.id, urls: nextUrls });
    }
  });

  await Promise.all(
    changedSessions.map(session => updateSession(session.id, { urls: session.urls })),
  );
  await removeActiveSessionReferences(targetKeys);

  return changedSessions.length;
};

const removeActiveSessionReferences = async (targetKeys: Set<string>): Promise<void> => {
  const chromeAny = (globalThis as any)?.chrome;
  if (!chromeAny?.storage?.local || targetKeys.size === 0) return;

  await new Promise<void>(resolve => {
    chromeAny.storage.local.get('active_sessions', (result: any) => {
      const activeSessions = Array.isArray(result?.active_sessions) ? result.active_sessions : [];
      let didChange = false;
      const nextActiveSessions = activeSessions.map((session: any) => {
        const capturedUrls = Array.isArray(session?.capturedUrls) ? session.capturedUrls : [];
        const capturedNames = Array.isArray(session?.capturedNames) ? session.capturedNames : [];
        if (capturedUrls.length === 0) return session;

        let sessionDidChange = false;
        const nextUrls: string[] = [];
        const nextNames: string[] = [];
        capturedUrls.forEach((url: string, index: number) => {
          const reference = parseSessionReferenceUrl(url);
          if (reference && targetKeys.has(`${reference.type}:${String(reference.id)}`)) {
            sessionDidChange = true;
            didChange = true;
            return;
          }
          nextUrls.push(url);
          if (capturedNames[index] !== undefined) {
            nextNames.push(capturedNames[index]);
          }
        });

        return sessionDidChange
          ? {
              ...session,
              capturedUrls: nextUrls,
              capturedNames: nextNames,
            }
          : session;
      });

      if (!didChange) {
        resolve();
        return;
      }

      chromeAny.storage.local.set({ active_sessions: nextActiveSessions }, () => resolve());
    });
  });
};

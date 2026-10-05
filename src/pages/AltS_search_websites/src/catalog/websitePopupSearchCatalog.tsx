import {
  getWebsitePopupEntityLabel,
  getWebsitePopupClipLabel,
} from '../../../../shared-components/websitePopup/websitePopupLabels';
import TextExpanderIcon from '../../../../shared-components/icons/TextExpanderIcon';
import { WEBSITE_POPUP_ENTITY_SOURCES } from '../../../../shared-components/websitePopup/websitePopupEntityRecords';
/**
 * Adapter from the shared new-tab search engine into neutral popup result rows.
 *
 * Ranking remains owned by searchAll(). This file owns only website-popup
 * grouping, presentation metadata, existing icons, and semantic identities.
 */
import type React from 'react';
import { BsCalendarCheck } from 'react-icons/bs';
import { FaFileAlt, FaFolder, FaImage, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import NotesIcon from '../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../shared-components/icons/stackedLinkIcon';
import {
  searchAll,
  type UnifiedSearchResult,
} from '../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/searchEngine';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
import type { WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
import type {
  WebsitePopupSaveTargetEntity,
  WebsitePopupTextCommandTargetEntity,
} from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
import { getMatchingShortcutAssignments } from '../../../../shared-components/triggers/shortcutRuntime';
import { withWebCollectionNames } from '../../../../shared-components/collections/webCollectionSearch';
import { buildPrefixMapFromSettings } from '../../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingRecord } from '../../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export type WebsitePopupSearchResultKind =
  'note' | 'link' | 'snippet' | 'todo' | 'bookmark' | 'prompt' | 'agent' | 'collection';
type SearchGroupDefinition = {
  kind: WebsitePopupSearchResultKind;
  engineKind: UnifiedSearchResult['_kind'];
  label: string;
};
const SEARCH_GROUPS: readonly SearchGroupDefinition[] = [
  { kind: 'note', engineKind: 'note', label: getWebsitePopupEntityLabel('note') },
  { kind: 'link', engineKind: 'link', label: getWebsitePopupEntityLabel('link') },
  { kind: 'snippet', engineKind: 'snippet', label: getWebsitePopupEntityLabel('snippet') },
  { kind: 'todo', engineKind: 'todo', label: getWebsitePopupEntityLabel('todo') },
  { kind: 'bookmark', engineKind: 'bookmark', label: 'Bookmarks' },
  { kind: 'prompt', engineKind: 'prompt', label: 'AI Prompts' },
  { kind: 'agent', engineKind: 'agent_collection', label: 'Chat Agents' },
  { kind: 'collection', engineKind: 'session', label: getWebsitePopupEntityLabel('collection') },
];
const normalizeText = (value: unknown) => {
  let source = '';
  if (typeof value === 'string' || typeof value === 'number') {
    source = String(value);
  } else if (value) {
    try {
      source = JSON.stringify(value);
    } catch {
      source = '';
    }
  }
  return source
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
type SearchRecord = Record<string, unknown>;
const toSearchRecord = (value: unknown): SearchRecord =>
  value && typeof value === 'object' ? (value as SearchRecord) : {};
const getRecordId = (value: unknown) => {
  const item = toSearchRecord(value);
  return String(item?.id || item?.todo_id || item?.snippet_id || item?.linkid || item?.url || '').trim();
};
const displayTextCommand = (value: string) => value.trim().replace(/^\/+/, '');
const findTextCommand = (
  snapshot: WebsitePopupSearchSnapshot,
  kind: WebsitePopupTextCommandTargetEntity,
  targetId: string,
) =>
  snapshot.shortcuts.find(
    candidate =>
      (candidate.referenceType === kind ||
        (kind === 'prompt' && candidate.referenceType === 'aiPrompt') ||
        (kind === 'collection' && ['session'].includes(String(candidate.referenceType)))) &&
      (candidate.referenceId === targetId ||
        (kind !== 'webCollection' && extractSnippetIdFromCompoundId(candidate.referenceId) === targetId)),
  );
const getRecordUrls = (item: SearchRecord): string[] => {
  const record = toSearchRecord(item.record);
  const candidates = [
    item?.url,
    ...(Array.isArray(item?.urls) ? item.urls : []),
    ...(Array.isArray(record.urls) ? record.urls : []),
  ];
  return Array.from(
    new Set(
      candidates
        .map(value => (typeof value === 'string' ? value : toSearchRecord(value).url))
        .map(value => String(value || '').trim())
        .filter(Boolean),
    ),
  );
};
const getDomains = (urls: readonly string[]) =>
  urls.flatMap(url => {
    try {
      return [new URL(url).hostname.replace(/^www\./i, '')];
    } catch {
      return [];
    }
  });
const decorateWithShortcuts = <T extends object>(
  items: readonly T[],
  snapshot: WebsitePopupSearchSnapshot,
  referenceTypes: readonly string[],
) =>
  items.map(item => {
    const recordId = getRecordId(item);
    const shortcut = (snapshot.shortcuts || []).find(
      candidate =>
        referenceTypes.includes(String(candidate.referenceType)) &&
        (String(candidate.referenceId) === recordId ||
          extractSnippetIdFromCompoundId(candidate.referenceId) === recordId),
    );
    return shortcut ? { ...item, _displayShortcut: displayTextCommand(shortcut.trigger) } : item;
  });
const buildEngineResults = (query: string, snapshot: WebsitePopupSearchSnapshot) =>
  searchAll(query, {
    commands: [],
    localCommands: [],
    historyItems: null,
    bookmarks: decorateWithShortcuts(snapshot.bookmarks || [], snapshot, ['bookmark']),
    commonCommands: [],
    // This snapshot search has no history; full saved names must remain searchable.
    allowLongQuery: true,
    notes: decorateWithShortcuts(snapshot.notes || [], snapshot, ['note']),
    links: decorateWithShortcuts(snapshot.links || [], snapshot, ['link']),
    snippets: decorateWithShortcuts(snapshot.snippets || [], snapshot, ['snippet']),
    todos: decorateWithShortcuts(snapshot.todos || [], snapshot, ['todo']),
    prompts: decorateWithShortcuts(snapshot.prompts || [], snapshot, ['prompt', 'aiPrompt']),
    agents: decorateWithShortcuts(snapshot.agents || [], snapshot, ['agent']),
    sessions: decorateWithShortcuts(snapshot.collections || [], snapshot, ['collection', 'session']),
    collectionRecords: snapshot.newCollections || [],
    collectionItems: withWebCollectionNames(snapshot.collectionItems, snapshot.newCollections),
    surface: 'alts_website_overlay',
    suppressSiteActionDuplicates: true,
  });
const getResultTitle = (kind: WebsitePopupSearchResultKind, result: SearchRecord) => {
  if (kind === 'bookmark') return normalizeText(result.title || result.url) || 'Untitled Bookmark';
  if (kind === 'snippet') return normalizeText(result.title || result.key || result.name) || 'Untitled Text Expander';
  if (kind === 'todo') return normalizeText(result.title || result.name || result.key) || 'Untitled Todo';
  if (kind === 'collection') {
    return normalizeText(result.title || result.sessionName || result.name) || 'Untitled Workspace Session';
  }
  if (kind === 'prompt') return normalizeText(result.title || result.name) || 'Untitled Prompt';
  if (kind === 'agent') return normalizeText(result.title || result.name) || 'Untitled Chat Agent';
  if (kind === 'link') return normalizeText(result.title || result.name) || 'Untitled Link';
  return normalizeText(result.title || result.name) || 'Untitled Note';
};
const getResultDetail = (kind: WebsitePopupSearchResultKind, result: SearchRecord) => {
  const urls = getRecordUrls(result);
  const domains = getDomains(urls);
  if (kind === 'note') return normalizeText(result.body || result.content || result.description);
  if (kind === 'link') return domains.join(', ') || `${urls.length} saved URL${urls.length === 1 ? '' : 's'}`;
  if (kind === 'snippet') {
    return normalizeText(result.description || result.content || result.value || result.config);
  }
  if (kind === 'todo') {
    const scheduled =
      result.scheduleType !== 'anytime' && Number(result.scheduleTime) > 0
        ? new Date(Number(result.scheduleTime)).toLocaleString()
        : '';
    return normalizeText([result.description || result.body, scheduled].filter(Boolean).join(' · '));
  }
  if (kind === 'bookmark') {
    return normalizeText([domains[0]].filter(Boolean).join(' · '));
  }
  if (kind === 'prompt') return normalizeText(result.prompt || result.rules || result.description);
  if (kind === 'agent') {
    return (
      normalizeText(result.prompt || result.description) || `${urls.length} saved URL${urls.length === 1 ? '' : 's'}`
    );
  }
  return normalizeText(
    [`${urls.length} tab${urls.length === 1 ? '' : 's'}`, domains.slice(0, 2).join(' · ')].filter(Boolean).join(' · '),
  );
};
const getResultIcon = (kind: WebsitePopupSearchResultKind, result: SearchRecord): React.ReactNode => {
  const urls = getRecordUrls(result);
  if (kind === 'link' || kind === 'bookmark') {
    return <StackedLinkIcon urls={urls} size={18} fallback="link" className="website-popup-stacked-icon" />;
  }
  if (kind === 'collection') {
    return <StackedLinkIcon urls={urls} size={18} fallback="session" className="website-popup-stacked-icon" />;
  }
  if (kind === 'note') return <NotesIcon />;
  if (kind === 'todo') return <BsCalendarCheck />;
  if (kind === 'snippet') return <TextExpanderIcon />;
  return <LuSparkles />;
};
export function buildWebsitePopupSearchSections(
  query: string,
  snapshot: WebsitePopupSearchSnapshot,
  prefixSettings: readonly WebsitePopupPrefixSettingLike[],
): WebsitePopupResolvedSection[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const assigned = getMatchingShortcutAssignments(
    query,
    snapshot.shortcuts,
    buildPrefixMapFromSettings(prefixSettings as PrefixSettingRecord[]),
  );
  const assignedResults = assigned.matches.length
    ? [
        ...SEARCH_GROUPS.flatMap(group => {
          const references = assigned.matches.filter(
            assignment =>
              assignment.referenceType === group.kind ||
              (group.kind === 'prompt' && assignment.referenceType === 'aiPrompt') ||
              (group.kind === 'collection' && ['session'].includes(String(assignment.referenceType))),
          );
          return snapshot[WEBSITE_POPUP_ENTITY_SOURCES[group.kind].snapshot].flatMap(item => {
            const targetId = getRecordId(item);
            return references.some(assignment => extractSnippetIdFromCompoundId(assignment.referenceId) === targetId)
              ? [
                  {
                    ...toSearchRecord(item),
                    _kind: group.engineKind,
                    id: targetId,
                    score: 0,
                  } as unknown as UnifiedSearchResult,
                ]
              : [];
          });
        }),
        ...snapshot.newCollections
          .filter(collection =>
            assigned.matches.some(
              assignment => assignment.referenceType === 'webCollection' && assignment.referenceId === collection.id,
            ),
          )
          .map(collection => ({
            ...collection,
            _kind: 'collection_record' as const,
            title: collection.name,
            score: 0,
          })),
      ]
    : [];
  // Bare text remains a name search even when it matches an assigned trigger.
  const candidates =
    assigned.matches.length && assigned.invocation.triggerSource !== 'direct_search'
      ? assignedResults
      : [...assignedResults, ...buildEngineResults(normalizedQuery, snapshot)];
  const seenResults = new Set<string>();
  const results = candidates.filter(result => {
    const identity = `${result._kind}:${result.id}`;
    if (seenResults.has(identity)) return false;
    seenResults.add(identity);
    return true;
  });
  const commandPrefix = String(
    (prefixSettings || []).find(setting => setting.type === 'category' && setting.category === 'command')?.prefix || '',
  ).trim();
  const existingSections = SEARCH_GROUPS.flatMap(group => {
    const groupResults = results.filter(result => result._kind === group.engineKind);
    if (groupResults.length === 0) return [];
    const rows = groupResults.map(result => {
      const record = toSearchRecord(result);
      const targetId = getRecordId(record);
      const assignment = findTextCommand(snapshot, group.kind, targetId);
      const shortcut = normalizeText(assignment ? displayTextCommand(assignment.trigger) : record._displayShortcut);
      const trailing = shortcut ? [commandPrefix, shortcut].filter(Boolean).join(' ') : undefined;
      const isStacked = group.kind === 'link' || group.kind === 'bookmark' || group.kind === 'collection';
      return {
        id: `${group.kind}:${targetId}`,
        title: getResultTitle(group.kind, record),
        detail: getResultDetail(group.kind, record),
        icon: getResultIcon(group.kind, record),
        iconLayout: isStacked ? ('stacked' as const) : ('standard' as const),
        iconTone: isStacked
          ? undefined
          : group.kind === 'prompt' || group.kind === 'agent'
            ? ('ai' as const)
            : ('action' as const),
        trailing,
        trailingTone: trailing ? ('key' as const) : undefined,
        textCommandEdit:
          group.kind === 'bookmark'
            ? undefined
            : {
                entity: group.kind,
                targetId,
                referenceId: assignment?.referenceId || targetId,
                value: assignment ? displayTextCommand(assignment.trigger) : '',
                title: getResultTitle(group.kind, record),
              },
        resultEdit: { entity: group.kind, targetId },
        intent: {
          kind: 'open-entity' as const,
          entity: group.kind,
          targetId,
        },
      };
    });
    return [{ id: `search-${group.kind}`, label: group.label, rows }];
  });
  const collectionResults = results.filter(result => result._kind === 'collection_record');
  const collectionItemResults = results.filter(result => result._kind === 'collection_item');
  const collectionNames = new Map(snapshot.newCollections.map(collection => [collection.id, collection.name]));
  const newSections: WebsitePopupResolvedSection[] = [];
  if (collectionResults.length)
    newSections.push({
      id: 'search-new-collections',
      label: 'Web Clips',
      rows: collectionResults.map(result => {
        const assignment = findTextCommand(snapshot, 'webCollection', result.id);
        const value = assignment ? displayTextCommand(assignment.trigger) : '';
        const trailing = value ? [commandPrefix, value].filter(Boolean).join(' ') : undefined;
        return {
          id: `new-collection:${result.id}`,
          title: result.title,
          detail: 'Web Clip',
          icon: <FaFolder />,
          iconTone: 'collection' as const,
          trailing,
          trailingTone: trailing ? ('key' as const) : undefined,
          textCommandEdit: {
            entity: 'webCollection' as const,
            targetId: result.id,
            referenceId: result.id,
            value,
            title: result.title,
          },
          intent: {
            kind: 'open-web-collection' as const,
            organisationId: result.organisationId,
            collectionId: result.id,
          },
        };
      }),
    });
  if (collectionItemResults.length)
    newSections.push({
      id: 'search-collection-items',
      label: 'Web Clip Items',
      rows: collectionItemResults.map(result => {
        const type = result.type;
        const source = snapshot.collectionItems.find(item => item.id === result.id);
        return {
          id: `collection-item:${result.id}`,
          title: result.title,
          detail: [
            getWebsitePopupClipLabel(type),
            collectionNames.get(result.collectionId),
            source?.note || getDomains([result.url])[0],
          ]
            .filter(Boolean)
            .join(' · '),
          icon: type === 'link' ? <FaLink /> : type === 'screenshot' ? <FaImage /> : <FaFileAlt />,
          iconTone: 'collection' as const,
          intent: {
            kind: 'open-web-collection-item' as const,
            organisationId: result.organisationId,
            collectionId: result.collectionId,
            itemId: result.id,
          },
        };
      }),
    });
  return [...existingSections, ...newSections];
}
const TITLE_SEARCH_ENTITY_KINDS: Record<string, WebsitePopupSearchResultKind> = {
  note: 'note',
  link: 'link',
  snippet: 'snippet',
  todo: 'todo',
  bookmark: 'bookmark',
  prompt: 'prompt',
  agent: 'agent',
  collection: 'collection',
};
const getTitleSearchRecords = (
  kind: WebsitePopupSearchResultKind,
  snapshot: WebsitePopupSearchSnapshot,
): SearchRecord[] => snapshot[WEBSITE_POPUP_ENTITY_SOURCES[kind].snapshot].map(toSearchRecord);
export function buildWebsitePopupTitleSearchSections(
  mode: 'save' | 'filter',
  entity: string,
  query: string,
  snapshot: WebsitePopupSearchSnapshot,
  prefixSettings: readonly WebsitePopupPrefixSettingLike[],
): WebsitePopupResolvedSection[] {
  const kind = TITLE_SEARCH_ENTITY_KINDS[entity];
  if (!kind) return [];
  const saveTargetKinds: readonly WebsitePopupSaveTargetEntity[] = [
    'note',
    'link',
    'todo',
    'snippet',
    'prompt',
    'collection',
  ];
  if (mode === 'save' && !saveTargetKinds.includes(kind as WebsitePopupSaveTargetEntity)) return [];
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    const rankedSection = buildWebsitePopupSearchSections(query, snapshot, prefixSettings).find(
      section => section.id === `search-${kind}`,
    );
    if (!rankedSection) return [];
    return [
      {
        ...rankedSection,
        id: `${mode}-${kind}`,
        label: '',
        rows:
          mode === 'save'
            ? rankedSection.rows.map(row =>
                row.intent.kind === 'open-entity'
                  ? {
                      ...row,
                      intent: {
                        kind: 'save-page-to-entity' as const,
                        entity: kind as WebsitePopupSaveTargetEntity,
                        targetId: row.intent.targetId,
                      },
                    }
                  : row,
              )
            : rankedSection.rows,
      },
    ];
  }
  const records = getTitleSearchRecords(kind, snapshot).filter(record => {
    return getResultTitle(kind, record).toLowerCase().includes(normalizedQuery);
  });
  const rows = records.map(record => {
    const targetId = getRecordId(record);
    const assignment = findTextCommand(snapshot, kind, targetId);
    const shortcut = normalizeText(assignment ? displayTextCommand(assignment.trigger) : '');
    const commandPrefix = String(
      prefixSettings.find(setting => setting.type === 'category' && setting.category === 'command')?.prefix || '',
    ).trim();
    const trailing = shortcut ? [commandPrefix, shortcut].filter(Boolean).join(' ') : undefined;
    const isStacked = kind === 'link' || kind === 'bookmark' || kind === 'collection';
    return {
      id: `${mode}:${kind}:${targetId}`,
      title: getResultTitle(kind, record),
      detail: getResultDetail(kind, record),
      icon: getResultIcon(kind, record),
      iconLayout: isStacked ? ('stacked' as const) : ('standard' as const),
      iconTone: isStacked ? undefined : kind === 'prompt' || kind === 'agent' ? ('ai' as const) : ('action' as const),
      trailing,
      trailingTone: trailing ? ('key' as const) : undefined,
      resultEdit: mode === 'save' ? { entity: kind, targetId } : undefined,
      textCommandEdit:
        kind === 'bookmark'
          ? undefined
          : {
              entity: kind,
              targetId,
              referenceId: assignment?.referenceId || targetId,
              value: assignment ? displayTextCommand(assignment.trigger) : '',
              title: getResultTitle(kind, record),
            },
      intent:
        mode === 'save'
          ? {
              kind: 'save-page-to-entity' as const,
              entity: kind as WebsitePopupSaveTargetEntity,
              targetId,
            }
          : {
              kind: 'open-entity' as const,
              entity: kind,
              targetId,
            },
    };
  });
  if (rows.length === 0) return [];
  return [{ id: `${mode}-${kind}`, label: '', rows }];
}

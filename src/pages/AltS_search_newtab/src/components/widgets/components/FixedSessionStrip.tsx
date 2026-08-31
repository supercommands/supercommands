import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, X } from 'lucide-react';
import { FaCode, FaTimes } from 'react-icons/fa';
import { FiSave, FiSettings, FiTarget } from 'react-icons/fi';
import { LuExternalLink } from 'react-icons/lu';
import clsx from 'clsx';

import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { db } from '../../../../../../storage/indexDB/dbConfig';
import {
  FIXED_SESSION_STRIP_SESSION_SETTING_KEY,
  renameWidgetDashboardViewAsync,
  setDefaultWidgetDashboardViewAsync,
  updateFixedSessionStripSessionForViewAsync,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import { updateSession } from '../../../../../../allObjectFolder/src/createObject/session/sessionData';
import {
  type SessionOpenSettings,
  normalizeSessionOpenSettings,
} from '../../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import { generateEntityId } from '../../../../../../shared-components/utils/idGenerator';
import {
  buildSessionLaunchUrls,
  createSessionReferenceExistenceIndex,
  filterAvailableSessionReferenceItems,
  parseSessionReferenceUrl,
  resolveSessionReferenceSource,
} from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceUtils';
import SessionAddLinksModal from '../../../../../../allObjectFolder/src/createObject/session/ui/SessionAddLinksModal';
import type { LinkItem, SelectedLink } from '../../../../../../allObjectFolder/src/createObject/links/linkTypes';
import { useChromeTabs } from '../../../../../../allObjectFolder/src/createObject/links/ui/hooks/useChromeTabs';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import type { WidgetInstance } from '../widgetDashboard.types';
import NotesIcon from '../../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../../shared-components/icons/stackedLinkIcon';
import CircularModelStackIcon from '../../../../../../shared-components/icons/circularModelStackIcon';
import { launchSessionSmart } from '../../../../../../shared-components/sessions/launchSessionSmart';
import CreateCollectionDialog, {
  createEmptySessionDraft,
  type CreateCollectionDialogState,
} from '../../altsNewtabSidebar/CreateCollectionDialog';
import { normalizeDashboardViewIconId } from '../../altsNewtabSidebar/dashboardViewIcons';
import { useShortcutValidation, saveShortcut, clearShortcut } from '../../../../../../shared-components/shortcuts';
import { clearHotkey, saveHotkey, useHotkeyValidation } from '../../../../../../shared-components/hotkeys';
import { normalizeHotkeyString } from '../../../../../../shared-components/hotkeys/core/eventParser';
import {
  resolveEnabledAiPromptModels,
  useExcludedAiPromptModels,
  type AiModelTarget,
} from '../../../../../../allObjectFolder/src/createObject/aiPrompt';
import {
  handleSessionReferenceLaunchActions,
  launchSessionSmartWithReferences,
} from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';

type ActiveSessionStorageEntry = {
  sessionId?: string;
  sessionName?: string;
  windowId?: number;
  capturedUrls?: string[];
  capturedNames?: string[];
};

const normalizeWidgetType = (type?: string): string =>
  type === 'daily-quote' ? 'quote-of-the-day' : type || 'generic';

const getMappedValueForView = (map: Record<string, string>, viewId: string): string => {
  const directValue = map[viewId];
  if (directValue) return directValue;
  const matchingKey = Object.keys(map).find(key =>
    key === viewId ||
    key.endsWith(`-${viewId}`) ||
    key.endsWith(`:${viewId}`) ||
    key.endsWith(`_${viewId}`),
  );
  return matchingKey ? map[matchingKey] || '' : '';
};

const getHostname = (url: string) => {
  try {
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(safeUrl).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
};

const normalizeUrlForCompare = (url?: string) => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return trimmed.replace(/\/$/, '').toLowerCase();
  }
};

const normalizeCustomUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getUrlsFromLinkItems = (items?: unknown[]) => {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => (typeof item === 'string' ? item : (item as { url?: string })?.url))
    .filter((url): url is string => Boolean(url));
};

const getHostFromUrl = (url?: string) => {
  if (!url) return '';
  try {
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(safeUrl).hostname;
  } catch {
    return '';
  }
};

const getWidgetSessionId = (widget: WidgetInstance | undefined) => {
  if (!widget) return null;
  if (widget.sessionId) return widget.sessionId;
  if (widget.referenceType === 'session' && widget.referenceId) return widget.referenceId;
  return null;
};

const getFixedSessionStripSessionId = (settings?: Record<string, unknown>) => {
  const sessionId = settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : null;
};

const getChromeApi = () => (typeof chrome !== 'undefined' ? chrome : undefined);

const sendRuntimeMessage = <T = unknown,>(message: Record<string, unknown>) =>
  new Promise<T | null>(resolve => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.runtime?.sendMessage) {
      resolve(null);
      return;
    }
    chromeApi.runtime.sendMessage(message, response => resolve(response ?? null));
  });

const getCurrentChromeWindowId = () =>
  new Promise<number | null>(resolve => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.windows?.getCurrent) {
      resolve(null);
      return;
    }
    chromeApi.windows.getCurrent({ populate: false }, currentWindow => {
      resolve(typeof currentWindow?.id === 'number' ? currentWindow.id : null);
    });
  });

const normalizeDeepFocusDomain = (value?: string): string => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const safeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(safeUrl).hostname.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
};

interface SessionSettingsRowProps {
  title: string;
  description: string;
  badge?: string;
  enabled: boolean;
  onClick: () => void;
  isLast?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const SessionSettingsRow: React.FC<SessionSettingsRowProps> = ({
  title,
  description,
  badge,
  enabled,
  onClick,
  isLast = false,
  disabled = false,
  icon,
}) => (
  <button
    type="button"
    disabled={disabled}
    aria-disabled={disabled}
    onClick={disabled ? undefined : onClick}
    className={clsx(
      'w-full flex items-center justify-between gap-2 text-left py-1.5 px-2 rounded-lg transition-colors',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5',
      !isLast && 'border-b border-black/5 dark:border-white/5',
    )}>
    <div className="min-w-0 flex-1 flex items-start gap-3">
      {icon && <div className="shrink-0 mt-0.5 text-neutral-400">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </span>
          {badge && (
            <span className="shrink-0 rounded-md border border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-neutral-500 dark:text-neutral-400">{description}</div>
      </div>
    </div>
    <div
      className={clsx(
        'relative h-5 w-9 shrink-0 rounded-full transition-all duration-200',
        enabled ? 'bg-indigo-600 shadow-sm' : 'bg-neutral-300 dark:bg-neutral-700',
      )}
      aria-hidden="true">
      <span
        className={clsx(
          'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
          enabled ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </div>
  </button>
);

const FixedSessionStrip = () => {
  const dashboardState = useWidgetDashboardStore(state => state.state);
  const dashboardWorkspaceId = useWidgetDashboardStore(state => state.workspaceId);
  const setDashboardState = useWidgetDashboardStore(state => state.setDashboardState);
  const sessions = useDbStore(state => state.sessions);
  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const chatAgents = useDbStore(state => state.chatAgents);
  const aiPrompts = useDbStore(state => state.aiPrompts);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const { validateShortcut } = useShortcutValidation();
  const { validateHotkey } = useHotkeyValidation();
  const { excludedModelIds, isLoading: isAgentModelsLoading } = useExcludedAiPromptModels();
  const { tabsByWindow, currentWindowId } = useChromeTabs(true);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionStorageEntry[]>([]);
  const [isAddLinksOpen, setIsAddLinksOpen] = useState(false);
  const [isAutoSaveUpdating, setIsAutoSaveUpdating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState<CreateCollectionDialogState | null>(null);
  const [collectionDialogError, setCollectionDialogError] = useState<string | null>(null);
  const [pendingCollectionDialogAction, setPendingCollectionDialogAction] = useState<string | null>(null);
  const [deepFocusDomainInput, setDeepFocusDomainInput] = useState('');
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const emptySessionDraft = useMemo(() => createEmptySessionDraft(), []);
  const emptyPendingWidgetIds = useMemo(() => new Set<string>(), []);

  const activeView = useMemo(() => {
    if (!dashboardState?.activeViewId) return null;
    return (Array.isArray(dashboardState.views) ? dashboardState.views : []).find(
      view => view.id === dashboardState.activeViewId,
    ) || null;
  }, [dashboardState]);

  const sessionWidget = useMemo(() => {
    if (!dashboardState?.activeViewId) return undefined;
    return (Array.isArray(dashboardState.widgets) ? dashboardState.widgets : []).find(widget => {
      if (widget.viewId !== dashboardState.activeViewId) return false;
      return normalizeWidgetType(widget.type) === 'session-item';
    });
  }, [dashboardState]);

  const fixedSessionId = useMemo(
    () => getFixedSessionStripSessionId(activeView?.settings),
    [activeView?.settings],
  );
  const widgetSessionId = useMemo(() => getWidgetSessionId(sessionWidget), [sessionWidget]);
  const sessionId = fixedSessionId || widgetSessionId;
  const sessionRecord = useMemo(
    () => (sessionId ? sessions.find(session => session.id === sessionId) || null : null),
    [sessionId, sessions],
  );

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (!collectionDialog) return;
      const shortcut = collectionDialog.shortcut || '';
      const viewId = collectionDialog.viewId || '';
      if (!shortcut) {
        if (active) {
          setCollectionDialog(prev =>
            prev ? { ...prev, shortcutError: null, isShortcutOverrideable: false, shortcutConflictId: null } : prev,
          );
        }
        return;
      }
      const result = await validateShortcut(shortcut, viewId || 'new');
      if (!active) return;
      setCollectionDialog(prev =>
        prev
          ? {
              ...prev,
              shortcutError: result.isValid ? null : result.errorMessage || 'This shortcut is already taken.',
              isShortcutOverrideable: !!result.isOverrideable,
              shortcutConflictId: result.conflictId || null,
            }
          : prev,
      );
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [collectionDialog?.shortcut, collectionDialog?.viewId, validateShortcut]);

  useEffect(() => {
    let active = true;
    const checkHotkey = async () => {
      if (!collectionDialog) return;
      const result = await validateHotkey(collectionDialog.hotkey || '', collectionDialog.viewId || 'new');
      if (!active) return;
      setCollectionDialog(prev =>
        prev ? { ...prev, hotkeyError: result.isValid ? null : result.errorMessage || 'This hotkey is already taken.' } : prev,
      );
    };
    void checkHotkey();
    return () => {
      active = false;
    };
  }, [collectionDialog?.hotkey, collectionDialog?.viewId, validateHotkey]);
  const sessionAgents = useMemo(
    () => [
      ...chatAgents.map(agent => ({
        id: agent.id,
        title: agent.title || 'Untitled Agent',
      })),
      ...aiPrompts.map(prompt => ({
        id: prompt.id,
        title: prompt.title || 'Untitled Agent',
      })),
    ],
    [aiPrompts, chatAgents],
  );
  const sessionReferenceIndex = useMemo(
    () => createSessionReferenceExistenceIndex({ notes, links, snippets, chatAgents: sessionAgents }),
    [links, notes, sessionAgents, snippets],
  );

  useEffect(() => {
    if (!activeView?.id || !widgetSessionId || fixedSessionId === widgetSessionId) return;
    updateFixedSessionStripSessionForViewAsync(activeView.id, widgetSessionId).catch(error => {
      console.error('[FixedSessionStrip] Failed to persist fixed strip session:', error);
    });
  }, [activeView?.id, fixedSessionId, widgetSessionId]);

  useEffect(() => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.storage?.local) return;

    const loadActiveSessions = () => {
      chromeApi.storage.local.get('active_sessions', result => {
        setActiveSessions(Array.isArray(result?.active_sessions) ? result.active_sessions : []);
      });
    };

    loadActiveSessions();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes.active_sessions) return;
      setActiveSessions(Array.isArray(changes.active_sessions.newValue) ? changes.active_sessions.newValue : []);
    };

    chromeApi.storage.onChanged?.addListener(handleStorageChange);
    return () => {
      chromeApi.storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  const activeWindowSession = useMemo(() => {
    if (!sessionId || typeof currentWindowId !== 'number') return null;
    return activeSessions.find(
      session => session.sessionId === sessionId && session.windowId === currentWindowId,
    ) || null;
  }, [activeSessions, currentWindowId, sessionId]);

  const displayLinks = useMemo<LinkItem[]>(() => {
    if (activeWindowSession) {
      const savedLinksByUrl = new Map(
        (Array.isArray(sessionRecord?.urls) ? sessionRecord.urls : [])
          .filter(item => item.url)
          .map(item => [normalizeUrlForCompare(item.url), item]),
      );
      return (activeWindowSession.capturedUrls || []).reduce<LinkItem[]>((items, url, index) => {
        if (!url) return items;
        const savedLink = savedLinksByUrl.get(normalizeUrlForCompare(url));
        const title = activeWindowSession.capturedNames?.[index]?.trim() || getHostname(url);
        items.push({
          ...(savedLink || {}),
          id: savedLink?.id || `active-session-${index}-${url}`,
          title,
          name: savedLink?.name || title,
          url,
          source: resolveSessionReferenceSource({ source: savedLink?.source, url }) || 'tab',
        });
        return items;
      }, []);
    }
    return Array.isArray(sessionRecord?.urls)
      ? sessionRecord.urls.map(item => ({
          ...item,
          source: resolveSessionReferenceSource(item) || 'tab',
        }))
      : [];
  }, [activeWindowSession, sessionRecord]);

  const availableDisplayLinks = useMemo(
    () => filterAvailableSessionReferenceItems(displayLinks, sessionReferenceIndex),
    [displayLinks, sessionReferenceIndex],
  );

  const getStackedUrlsForSessionLink = useCallback((item: LinkItem) => {
    const inlineUrls = getUrlsFromLinkItems(item.originalData?.urls);
    if (inlineUrls.length > 0) return inlineUrls;

    const triggerInfo = parseSessionReferenceUrl(item.url);
    if (triggerInfo?.type !== 'link' || !triggerInfo.id) return [];

    const linkRecord = links.find(link => String(link.id) === String(triggerInfo.id));
    return getUrlsFromLinkItems(linkRecord?.urls);
  }, [links]);

  const getAgentModelsForSessionLink = useCallback((item: LinkItem): AiModelTarget[] => {
    const triggerInfo = parseSessionReferenceUrl(item.url);
    if (triggerInfo?.type !== 'agent' || !triggerInfo.id) return [];

    const promptRecord = aiPrompts.find(prompt => String(prompt.id) === String(triggerInfo.id));
    if (promptRecord) {
      return resolveEnabledAiPromptModels(promptRecord, excludedModelIds);
    }

    const chatAgentRecord = chatAgents.find(agent => String(agent.id) === String(triggerInfo.id));
    const urls = Array.isArray((chatAgentRecord as any)?.urls) ? (chatAgentRecord as any).urls : [];
    return urls
      .map((url: string, index: number) => {
        const host = getHostFromUrl(url);
        if (!host) return null;
        return {
          id: `${triggerInfo.id}-${index}`,
          name: host,
          host,
        };
      })
      .filter((model: AiModelTarget | null): model is AiModelTarget => Boolean(model));
  }, [aiPrompts, chatAgents, excludedModelIds]);

  const renderDisplayLinkIcon = useCallback((item: LinkItem, isCompact: boolean = false) => {
    const iconClass = 'text-[var(--color-iconDefault)]';
    const iconSize = isCompact ? 18 : 22;
    const itemSource = resolveSessionReferenceSource(item);
    if (itemSource === 'note') {
      return <NotesIcon size={iconSize} className={iconClass} />;
    }
    if (itemSource === 'snippet') {
      return <FaCode size={iconSize} className={iconClass} />;
    }
    if (itemSource === 'agent') {
      return (
        <span className={isCompact ? 'scale-90' : undefined}>
          <CircularModelStackIcon
            models={getAgentModelsForSessionLink(item)}
            isLoading={isAgentModelsLoading}
            variant="compact"
          />
        </span>
      );
    }
    if (itemSource === 'link') {
      const stackedUrls = getStackedUrlsForSessionLink(item);
      if (stackedUrls.length > 0) {
        return <StackedLinkIcon urls={stackedUrls} size={iconSize} fallback="link" />;
      }
      return <Link2 size={iconSize} className={iconClass} />;
    }
    if (item.favIconUrl) {
      return <img src={item.favIconUrl} alt="" className={`${isCompact ? 'h-[1.125rem] w-[1.125rem]' : 'h-[clamp(1.125rem,3.2vw,1.5rem)] w-[clamp(1.125rem,3.2vw,1.5rem)]'} object-contain`} />;
    }
    return (
      <img
        src={getFaviconUrl(getHostname(item.url))}
        alt=""
        className={`${isCompact ? 'h-[1.125rem] w-[1.125rem]' : 'h-[clamp(1.125rem,3.2vw,1.5rem)] w-[clamp(1.125rem,3.2vw,1.5rem)]'} object-contain`}
      />
    );
  }, [getAgentModelsForSessionLink, getStackedUrlsForSessionLink, isAgentModelsLoading]);

  const displayUrlSet = useMemo(() => {
    return new Set(availableDisplayLinks.map(item => normalizeUrlForCompare(item.url)).filter(Boolean));
  }, [availableDisplayLinks]);

  const currentWindowTabs = useMemo(
    () => (typeof currentWindowId === 'number' ? tabsByWindow[currentWindowId] || [] : []),
    [currentWindowId, tabsByWindow],
  );

  const availableTabs = useMemo<SelectedLink[]>(() => {
    return currentWindowTabs
      .filter(tab => tab.url && !displayUrlSet.has(normalizeUrlForCompare(tab.url)))
      .map(tab => ({
        id: String(tab.id),
        title: tab.title || getHostname(tab.url),
        name: tab.title || getHostname(tab.url),
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        source: 'tab',
        originalData: tab,
      }));
  }, [currentWindowTabs, displayUrlSet]);

  const isAutoSaveEnabled = sessionRecord?.sessionOpenSettings?.autoSaveMode === 'auto_save';
  const isFocusModeEnabled = useMemo(
    () => sessionRecord?.sessionOpenSettings?.focusWindow === true || sessionRecord?.sessionOpenSettings?.deepFocusMode === true,
    [sessionRecord?.sessionOpenSettings],
  );

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setIsOverflowing(el.scrollWidth > el.clientWidth + 2);
    };
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [availableDisplayLinks.length]);

  const isCompactStrip = availableDisplayLinks.length >= 6;
  const isTightStrip = availableDisplayLinks.length >= 9 || isOverflowing;
  const stripPaddingClass = isTightStrip ? 'px-3' : isCompactStrip ? 'px-4' : 'px-6';
  const outerGapClass = isTightStrip ? 'gap-2' : isCompactStrip ? 'gap-3' : 'gap-4';
  const stripGapClass = isTightStrip ? 'gap-1' : isCompactStrip ? 'gap-1.5' : 'gap-2';
  const stripItemClass = isTightStrip
    ? 'min-w-[2.25rem] max-w-[3.5rem]'
    : isCompactStrip
      ? 'min-w-[2.5rem] max-w-[3.875rem]'
      : 'min-w-[2.75rem] max-w-[4.25rem]';
  const stripButtonGapClass = isTightStrip ? 'gap-0.5' : 'gap-1';
  const stripIconShellClass = isTightStrip
    ? 'h-9 w-9'
    : isCompactStrip
      ? 'h-[2.625rem] w-[2.625rem]'
      : 'h-[clamp(2.5rem,6vw,3rem)] w-[clamp(2.5rem,6vw,3rem)]';
  const stripTextClass = isTightStrip ? 'text-[10px]' : isCompactStrip ? 'text-[10px]' : 'text-[11px]';

  const deepFocusManualDomains = useMemo(
    () => (Array.isArray(sessionRecord?.sessionOpenSettings?.deepFocusAllowedDomains) ? sessionRecord.sessionOpenSettings.deepFocusAllowedDomains : []),
    [sessionRecord?.sessionOpenSettings?.deepFocusAllowedDomains],
  );

  const deepFocusBlockedDomains = useMemo(
    () => (Array.isArray(sessionRecord?.sessionOpenSettings?.deepFocusBlockedDomains) ? sessionRecord.sessionOpenSettings.deepFocusBlockedDomains : []),
    [sessionRecord?.sessionOpenSettings?.deepFocusBlockedDomains],
  );

  const deepFocusAutoDomains = useMemo(() => {
    const rawAutoDomains = availableDisplayLinks.map(link => normalizeDeepFocusDomain(link.url)).filter(Boolean);
    const blockedSet = new Set(deepFocusBlockedDomains.map(d => d.toLowerCase()));
    return Array.from(new Set(rawAutoDomains))
      .filter(domain => !blockedSet.has(domain.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [availableDisplayLinks, deepFocusBlockedDomains]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const syncActiveSessionUrls = useCallback(
    async (links: LinkItem[]) => {
      if (!sessionId || typeof currentWindowId !== 'number') return;
      await sendRuntimeMessage({
        action: 'update_active_session_urls',
        sessionId,
        windowId: currentWindowId,
        urls: links.map(link => link.url),
        names: links.map(link => link.title || link.name || getHostname(link.url)),
      });
    },
    [currentWindowId, sessionId],
  );

  const appendSessionLink = useCallback(
    async (link: LinkItem) => {
      if (!sessionId) return null;
      const latestSession = await db.sessions.get(sessionId);
      if (!latestSession) return null;

      const nextUrl = normalizeUrlForCompare(link.url);
      const existingUrls = Array.isArray(latestSession.urls) ? latestSession.urls : [];
      if (!nextUrl || existingUrls.some(item => normalizeUrlForCompare(item.url) === nextUrl)) {
        return latestSession;
      }

      const nextLinks = [...existingUrls, link];
      const updated = await updateSession(sessionId, { urls: nextLinks });
      await syncActiveSessionUrls(updated.urls);
      return updated;
    },
    [sessionId, syncActiveSessionUrls],
  );

  const appendSessionLinks = useCallback(
    async (linksToAdd: LinkItem[]) => {
      if (!sessionId) return null;
      const latestSession = await db.sessions.get(sessionId);
      if (!latestSession) return null;

      const existingUrls = Array.isArray(latestSession.urls) ? latestSession.urls : [];
      const seenUrls = new Set(existingUrls.map(item => normalizeUrlForCompare(item.url)).filter(Boolean));
      const nextLinksToAdd = linksToAdd.reduce<LinkItem[]>((items, link, index) => {
        const normalizedUrl = normalizeUrlForCompare(link.url);
        if (!normalizedUrl || seenUrls.has(normalizedUrl)) return items;
        seenUrls.add(normalizedUrl);
        const title = link.title || link.name || getHostname(link.url);
        items.push({
          ...link,
          id: link.id || generateEntityId('linkItem'),
          title,
          name: link.name || title,
        });
        return items;
      }, []);

      if (nextLinksToAdd.length === 0) return latestSession;

      const nextLinks = [...existingUrls, ...nextLinksToAdd];
      const updated = await updateSession(sessionId, { urls: nextLinks });
      await syncActiveSessionUrls(updated.urls);
      return updated;
    },
    [sessionId, syncActiveSessionUrls],
  );

  const handleRemoveSessionLink = useCallback(
    async (itemToRemove: LinkItem) => {
      if (!sessionId) return;
      const latestSession = await db.sessions.get(sessionId);
      if (!latestSession) return;

      const targetId = String(itemToRemove.id || '').trim().toLowerCase();
      const targetUrl = String(itemToRemove.url || '').trim().toLowerCase();

      const existingUrls = Array.isArray(latestSession.urls) ? latestSession.urls : [];
      const nextLinks = existingUrls.filter(item => {
        const itemObj = typeof item === 'string' ? { url: item, id: undefined } : item;
        const itemId = String((itemObj as any)?.id || '').trim().toLowerCase();
        const itemUrl = String(itemObj?.url || '').trim().toLowerCase();

        if (targetId && itemId === targetId) return false;
        if (targetUrl && itemUrl === targetUrl) return false;
        return true;
      });

      const updated = await updateSession(sessionId, { urls: nextLinks });
      await syncActiveSessionUrls(updated.urls);
    },
    [sessionId, syncActiveSessionUrls],
  );

  const handleAddAvailableTab = useCallback(
    (item: SelectedLink) => {
      void appendSessionLink({
        id: item.id || generateEntityId('linkItem'),
        title: item.title || item.name || getHostname(item.url),
        name: item.name || item.title || getHostname(item.url),
        url: item.url,
        favIconUrl: item.favIconUrl,
        source: 'tab',
        originalData: item.originalData,
      });
    },
    [appendSessionLink],
  );

  const handleAddCustomLink = useCallback(
    async (url: string, name?: string) => {
      const normalizedUrl = normalizeCustomUrl(url);
      if (!normalizedUrl) return false;

      const title = name?.trim() || getHostname(normalizedUrl);
      const updated = await appendSessionLink({
        id: generateEntityId('linkItem'),
        title,
        name: title,
        url: normalizedUrl,
        source: 'custom',
      });

      if (!updated) return false;

      if (activeWindowSession && typeof currentWindowId === 'number' && sessionId) {
        await sendRuntimeMessage({
          action: 'open_tab_in_session',
          sessionId,
          url: normalizedUrl,
          windowId: currentWindowId,
        });
      }

      return true;
    },
    [activeWindowSession, appendSessionLink, currentWindowId, sessionId],
  );

  const handleAddSessionLinks = useCallback(
    async (items: LinkItem[]) => {
      const updated = await appendSessionLinks(items);
      if (!updated) return false;

      if (activeWindowSession && typeof currentWindowId === 'number' && sessionId) {
        const launchUrls = buildSessionLaunchUrls(items, links);
        for (const url of launchUrls.openUrls) {
          await sendRuntimeMessage({
            action: 'open_tab_in_session',
            sessionId,
            url,
            windowId: currentWindowId,
          });
        }
        void handleSessionReferenceLaunchActions(items, {
          aiPrompts,
          chatAgents,
        });
      }

      return true;
    },
    [activeWindowSession, aiPrompts, appendSessionLinks, chatAgents, currentWindowId, links, sessionId],
  );

  const handleOpenLink = useCallback(
    (item: LinkItem) => {
      const reference = parseSessionReferenceUrl(item.url);
      if (reference) {
        const launchUrls = buildSessionLaunchUrls([item], links);
        launchUrls.openUrls.forEach(url => {
          const chromeApi = getChromeApi();
          if (chromeApi?.tabs?.create && typeof currentWindowId === 'number') {
            chromeApi.tabs.create({ url, active: true, windowId: currentWindowId });
            return;
          }
          window.open(url, '_blank', 'noopener,noreferrer');
        });
        void handleSessionReferenceLaunchActions([item], {
          aiPrompts,
          chatAgents,
        });
        return;
      }

      const url = item.url;
      const chromeApi = getChromeApi();
      if (chromeApi?.tabs?.create && typeof currentWindowId === 'number') {
        chromeApi.tabs.create({ url, active: true, windowId: currentWindowId });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [aiPrompts, chatAgents, currentWindowId, links],
  );

  const handleOpenAllTabs = useCallback(async () => {
    if (!sessionId || !sessionRecord) return;

    const targetWindowId =
      typeof currentWindowId === 'number' ? currentWindowId : await getCurrentChromeWindowId();

    try {
      const response = await launchSessionSmartWithReferences(sessionRecord, {
        teamId: undefined,
        storageMode: 'local',
        openSettings: sessionRecord.sessionOpenSettings,
        source: 'dashboard_view',
        dashboardViewId: activeView?.id,
        context: { currentWindowId: targetWindowId },
        requireAutoSave: false,
      });

      if (response && response.ok === false) {
        console.error('[FixedSessionStrip] Failed to smart-open fixed strip session:', response.error);
      }
    } catch (error) {
      console.error('[FixedSessionStrip] Failed to smart-open fixed strip session:', error);
    }
  }, [activeView?.id, currentWindowId, sessionId, sessionRecord]);

  const handleOpenCollectionSettings = useCallback(() => {
    if (!activeView?.id) return;
    setIsSettingsOpen(false);
    setCollectionDialogError(null);
    setCollectionDialog({
      mode: 'rename',
      viewId: activeView.id,
      title: activeView.title,
      shortcut: getMappedValueForView(shortcutsMap, activeView.id),
      hotkey: getMappedValueForView(hotkeysMap, activeView.id),
      isDefault: Boolean(activeView.isDefault),
      viewIconId: normalizeDashboardViewIconId(activeView.settings?.viewIconId),
    });
  }, [activeView, hotkeysMap, shortcutsMap]);

  const handleCloseCollectionDialog = useCallback(() => {
    setCollectionDialog(null);
    setCollectionDialogError(null);
    setPendingCollectionDialogAction(null);
  }, []);

  const handleOverrideCollectionShortcut = useCallback(async () => {
    if (!collectionDialog?.shortcutConflictId) return;
    await clearShortcut(collectionDialog.shortcutConflictId, collectionDialog.shortcutConflictId, 'collection');
    setCollectionDialog(prev =>
      prev
        ? {
            ...prev,
            shortcutError: null,
            isShortcutOverrideable: false,
            shortcutConflictId: null,
          }
        : prev,
    );
  }, [collectionDialog?.shortcutConflictId]);

  const handleSubmitCollectionDialog = useCallback(async () => {
    if (!collectionDialog?.viewId || collectionDialog.shortcutError || collectionDialog.hotkeyError) return;

    const workspaceId = dashboardWorkspaceId || 'default';
    const targetViewId = collectionDialog.viewId;
    setPendingCollectionDialogAction('save');
    setCollectionDialogError(null);
    try {
      let nextState = await renameWidgetDashboardViewAsync(targetViewId, collectionDialog.title, workspaceId, {
        viewIconId: collectionDialog.viewIconId,
      });
      if (collectionDialog.isDefault && !nextState.views.find(view => view.id === targetViewId)?.isDefault) {
        nextState = await setDefaultWidgetDashboardViewAsync(targetViewId, workspaceId);
      }
      setDashboardState(nextState, workspaceId);

      const shortcut = collectionDialog.shortcut || '';
      if (shortcut) {
        await saveShortcut(targetViewId, targetViewId, shortcut, collectionDialog.title || 'View', 'collection');
      } else {
        await clearShortcut(targetViewId, targetViewId, 'collection');
      }

      if (collectionDialog.hotkey) {
        await saveHotkey(targetViewId, targetViewId, normalizeHotkeyString(collectionDialog.hotkey), 'collection');
      } else {
        await clearHotkey(targetViewId, targetViewId, 'collection');
      }

      handleCloseCollectionDialog();
    } catch (error) {
      console.error('[FixedSessionStrip] Failed to save collection settings:', error);
      setCollectionDialogError(error instanceof Error ? error.message : 'Could not save collection settings.');
    } finally {
      setPendingCollectionDialogAction(null);
    }
  }, [collectionDialog, dashboardWorkspaceId, handleCloseCollectionDialog, setDashboardState]);

  const handleToggleAutoSave = useCallback(async () => {
    if (!sessionId || !sessionRecord || isAutoSaveUpdating) return;
    setIsAutoSaveUpdating(true);

    try {
      const nextSettings = normalizeSessionOpenSettings({
        ...sessionRecord.sessionOpenSettings,
        autoSaveMode: isAutoSaveEnabled ? 'dont_save' : 'auto_save',
      });
      const updatedSession = await updateSession(sessionId, { sessionOpenSettings: nextSettings });

      await sendRuntimeMessage({
        action: 'update_active_session_settings',
        sessionId,
        openSettings: nextSettings,
      });

      const targetWindowId =
        typeof currentWindowId === 'number' ? currentWindowId : await getCurrentChromeWindowId();
      if (typeof targetWindowId !== 'number') return;

      if (nextSettings.autoSaveMode === 'auto_save') {
        if (!activeWindowSession) {
          const initialLinks = availableDisplayLinks.length > 0
            ? availableDisplayLinks.map(link => ({
                url: link.url,
                title: link.title || link.name || link.url,
                name: link.name || link.title || link.url,
                originalData: link.originalData,
              }))
            : currentWindowTabs.map(tab => ({
                url: tab.url,
                title: tab.title || tab.url,
                name: tab.title || tab.url,
              }));
          const launchUrls = buildSessionLaunchUrls(initialLinks, links);
          const response = await launchSessionSmart({
            sessionId,
            sessionName: updatedSession.title || sessionRecord.title || 'Untitled Tab Session',
            workspaceId: updatedSession.workspaceId,
            folderId: updatedSession.folderId ?? null,
            storageMode: 'local',
            initialUrls: launchUrls.initialUrls,
            initialNames: launchUrls.initialNames,
            openUrls: launchUrls.openUrls,
            openNames: launchUrls.openNames,
            openSettings: nextSettings,
            context: { currentWindowId: targetWindowId },
            source: 'dashboard_view',
          });

          if (response && response.ok === false) {
            throw new Error(response.error || 'Failed to start auto-save session');
          }

          void handleSessionReferenceLaunchActions(initialLinks, {
            aiPrompts,
            chatAgents,
          });
        }
      } else {
        await sendRuntimeMessage({
          action: 'deactivate_session_autosave_tracking',
          sessionId,
          currentWindowId: targetWindowId,
        });
      }
    } catch (error) {
      console.error('[FixedSessionStrip] Failed to update auto-save:', error);
    } finally {
      setIsAutoSaveUpdating(false);
    }
  }, [
    activeWindowSession,
    aiPrompts,
    chatAgents,
    currentWindowId,
    currentWindowTabs,
    availableDisplayLinks,
    isAutoSaveEnabled,
    isAutoSaveUpdating,
    links,
    sessionId,
    sessionRecord,
  ]);

  const updateSessionSettings = useCallback(
    async (partialSettings: Partial<SessionOpenSettings>) => {
      if (!sessionId || !sessionRecord) return;
      const nextSettings = normalizeSessionOpenSettings({
        ...sessionRecord.sessionOpenSettings,
        ...partialSettings,
      });
      await updateSession(sessionId, { sessionOpenSettings: nextSettings });
      await sendRuntimeMessage({
        action: 'update_active_session_settings',
        sessionId,
        openSettings: nextSettings,
      });
    },
    [sessionId, sessionRecord],
  );

  const handleToggleFocusMode = useCallback(async () => {
    if (!sessionId || !sessionRecord) return;
    const nextFocusMode = !isFocusModeEnabled;
    await updateSessionSettings({
      focusWindow: nextFocusMode,
      deepFocusMode: nextFocusMode,
    });
  }, [isFocusModeEnabled, updateSessionSettings]);

  const handleAddDeepFocusDomain = useCallback(() => {
    const normalizedDomain = normalizeDeepFocusDomain(deepFocusDomainInput);
    if (!normalizedDomain) return;

    const nextDomains = Array.from(new Set([...deepFocusManualDomains, normalizedDomain])).sort((a, b) =>
      a.localeCompare(b),
    );
    const nextBlockedDomains = deepFocusBlockedDomains.filter(domain => domain !== normalizedDomain);
    void updateSessionSettings({ deepFocusAllowedDomains: nextDomains, deepFocusBlockedDomains: nextBlockedDomains });
    setDeepFocusDomainInput('');
  }, [deepFocusBlockedDomains, deepFocusDomainInput, deepFocusManualDomains, updateSessionSettings]);

  const handleRemoveDeepFocusDomain = useCallback(
    (domainToRemove: string) => {
      const nextDomains = deepFocusManualDomains.filter(domain => domain !== domainToRemove);
      void updateSessionSettings({ deepFocusAllowedDomains: nextDomains });
    },
    [deepFocusManualDomains, updateSessionSettings],
  );

  const handleRemoveDeepFocusAutoDomain = useCallback(
    (domainToRemove: string) => {
      const normalizedDomain = normalizeDeepFocusDomain(domainToRemove);
      if (!normalizedDomain) return;
      const nextBlockedDomains = Array.from(new Set([...deepFocusBlockedDomains, normalizedDomain])).sort((a, b) =>
        a.localeCompare(b),
      );
      const nextManualDomains = deepFocusManualDomains.filter(domain => domain !== normalizedDomain);
      void updateSessionSettings({
        deepFocusAllowedDomains: nextManualDomains,
        deepFocusBlockedDomains: nextBlockedDomains,
      });
    },
    [deepFocusBlockedDomains, deepFocusManualDomains, updateSessionSettings],
  );

  if (!sessionId || !sessionRecord) return null;

  return (
    <div
      className={`group/fixed-session-strip w-full shrink-0 ${stripPaddingClass} pt-2 pb-3 text-[var(--color-textPrimary)]`}
      data-fixed-session-strip="true">
      <div className={`mx-auto flex w-full max-w-2xl items-start ${outerGapClass}`}>
        <div
          ref={scrollContainerRef}
          className={`flex min-w-0 flex-1 items-start ${stripGapClass} overflow-x-auto overflow-y-hidden pb-1 custom-scrollbar ${
            isOverflowing ? 'justify-start' : 'justify-center'
          }`}>
          {availableDisplayLinks.map((item, index) => {
            const title = String(item.title || item.name || '').trim() || getHostname(item.url);
            return (
              <div
                key={`${item.id || item.url}-${index}`}
                className={`group/item relative flex ${stripItemClass} shrink-0 flex-col items-center ${stripButtonGapClass} text-center`}>
                <button
                  type="button"
                  onClick={() => handleOpenLink(item)}
                  className={`group flex w-full flex-col items-center ${stripButtonGapClass} text-center`}
                  title={title}>
                  <span className={`flex ${stripIconShellClass} items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,var(--color-widgetBg))] text-[var(--color-textPrimary)] transition-colors group-hover:bg-[var(--color-hoverBg)] dark:border-[var(--color-widgetBorder)] dark:bg-[var(--color-widgetInnerBg,var(--color-widgetBg))]`}>
                    {renderDisplayLinkIcon(item, isCompactStrip || isTightStrip)}
                  </span>
                  <span className={`block w-full truncate ${stripTextClass} font-medium text-[var(--color-textMuted)]`}>
                    {title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    void handleRemoveSessionLink(item);
                  }}
                  className="absolute top-0 right-0 hidden group-hover/item:flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-editorBg)] border border-[var(--color-borderDefault)] text-[var(--color-iconDefault)] hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors shadow-sm z-10"
                  title="Remove from session"
                  aria-label="Remove from session">
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {!isOverflowing && (
            <button
              type="button"
              onClick={() => setIsAddLinksOpen(true)}
              className={`group flex ${stripItemClass} shrink-0 flex-col items-center ${stripButtonGapClass} text-center`}
              title="Add tabs"
              aria-label="Add tabs">
              <span className={`flex ${stripIconShellClass} items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,var(--color-widgetBg))] text-[var(--color-accent)] transition-colors group-hover:bg-[var(--color-hoverBg)] group-hover:text-[var(--color-textPrimary)] dark:border-[var(--color-widgetBorder)] dark:bg-[var(--color-widgetInnerBg,var(--color-widgetBg))]`}>
                <Plus size={isCompactStrip || isTightStrip ? 17 : 20} />
              </span>
              <span className="block h-4 w-full text-xs font-medium text-[var(--color-textMuted)]" />
            </button>
          )}
        </div>

        {isOverflowing && (
          <div className="flex shrink-0 items-start">
            <button
              type="button"
              onClick={() => setIsAddLinksOpen(true)}
              className={`group flex flex-col items-center ${stripButtonGapClass} text-center`}
              title="Add tabs"
              aria-label="Add tabs">
              <span className={`flex ${stripIconShellClass} items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,var(--color-widgetBg))] text-[var(--color-accent)] transition-colors group-hover:bg-[var(--color-hoverBg)] group-hover:text-[var(--color-textPrimary)] dark:border-[var(--color-widgetBorder)] dark:bg-[var(--color-widgetInnerBg,var(--color-widgetBg))]`}>
                <Plus size={isCompactStrip || isTightStrip ? 17 : 20} />
              </span>
              <span className="block h-4 w-full text-xs font-medium text-[var(--color-textMuted)]" />
            </button>
          </div>
        )}
        <div className="relative shrink-0" ref={settingsRef}>
          <div className="flex items-center gap-1 pt-1">
            {availableDisplayLinks.length > 0 && (
              <button
                type="button"
                onClick={handleOpenAllTabs}
                className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 opacity-0 group-hover/fixed-session-strip:opacity-100 group-focus-within/fixed-session-strip:opacity-100 cursor-pointer"
                title="Open session">
                <LuExternalLink size={14} />
              </button>
            )}
            {activeView?.id && (
              <button
                type="button"
                onClick={handleOpenCollectionSettings}
                className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 settings-btn opacity-0 group-hover/fixed-session-strip:opacity-100 group-focus-within/fixed-session-strip:opacity-100 cursor-pointer"
                title="Edit collection">
                <FiSettings size={14} />
              </button>
            )}
          </div>

          {collectionDialog && (
            <CreateCollectionDialog
              anchorRef={settingsRef}
              dialog={collectionDialog}
              setDialog={setCollectionDialog}
              onClose={handleCloseCollectionDialog}
              onSubmit={handleSubmitCollectionDialog}
              actionError={collectionDialogError}
              pendingActionId={pendingCollectionDialogAction}
              onOverrideShortcut={handleOverrideCollectionShortcut}
              stagedWidgets={[]}
              pendingWidgetIds={emptyPendingWidgetIds}
              draftSession={emptySessionDraft}
              onDraftSessionChange={() => {}}
              onStageWidget={() => {}}
              onRemoveStagedWidget={() => {}}
              linkedSessionId={sessionId}
              linkedWidgetId={sessionWidget?.id || `session-${activeView?.id || 'fixed-strip'}`}
              hideWidgetsSection
            />
          )}

          {isSettingsOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-[285px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] text-[var(--color-textSecondary)] shadow-2xl shadow-black/40 opacity-100 z-[99999]"
              onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-textMuted)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] z-10">
                <FaTimes size={11} />
              </button>
              <div className="p-1.5 pt-7">
                <div className="flex flex-col gap-1 mb-2">
                  <SessionSettingsRow
                    title="Focus Mode"
                    badge="New window only"
                    icon={<FiTarget size={14} />}
                    description="Close existing tabs and only allow the session's approved domains."
                    enabled={isFocusModeEnabled}
                    onClick={() => void handleToggleFocusMode()}
                    isLast={!isFocusModeEnabled}
                  />
                  {isFocusModeEnabled && (
                    <div className="px-3 pt-2 pb-3 border-b border-black/5 dark:border-white/5">
                      <div className="text-[11px] font-semibold text-[var(--color-textSecondary)]">
                        Allowed domains
                      </div>

                      {deepFocusAutoDomains.length > 0 && (
                        <div className="mt-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-textMuted)]">
                            From session links
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {deepFocusAutoDomains.map(domain => (
                              <span
                                key={`auto-${domain}`}
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-selectedBg)] px-2 py-1 text-[10px] font-medium text-[var(--color-textPrimary)]">
                                {domain}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDeepFocusAutoDomain(domain)}
                                  className="rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]"
                                  aria-label={`Remove session domain ${domain}`}
                                  title="Remove domain allowance; exact saved session links remain allowed">
                                  <FaTimes size={8} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2">
                        {deepFocusManualDomains.length > 0 && (
                          <>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-textMuted)]">
                              Custom domains
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {deepFocusManualDomains.map(domain => (
                                <span
                                  key={`manual-${domain}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-1 text-[10px] font-medium text-[var(--color-textPrimary)]">
                                  {domain}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDeepFocusDomain(domain)}
                                    className="rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]"
                                    aria-label={`Remove ${domain}`}>
                                    <FaTimes size={8} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex gap-1.5">
                          <input
                            value={deepFocusDomainInput}
                            onChange={event => setDeepFocusDomainInput(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddDeepFocusDomain();
                              }
                            }}
                            placeholder="chatgpt.com"
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none transition focus:border-[var(--color-borderActive)]"
                          />
                          <button
                            type="button"
                            onClick={handleAddDeepFocusDomain}
                            className="rounded-lg bg-[var(--color-accent,#3b82f6)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90">
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <SessionSettingsRow
                  title="Auto-save session"
                  icon={<FiSave size={14} />}
                  description="Automatically save changes to this session as tabs are added or removed."
                  enabled={isAutoSaveEnabled}
                  disabled={isAutoSaveUpdating}
                  onClick={() => void handleToggleAutoSave()}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <SessionAddLinksModal
        isOpen={isAddLinksOpen}
        availableTabs={availableTabs}
        notes={notes}
        links={links}
        snippets={snippets}
        chatAgents={sessionAgents as any}
        onAddAvailableTab={handleAddAvailableTab}
        onAddCustomLink={handleAddCustomLink}
        onAddSessionLinks={handleAddSessionLinks}
        onClose={() => setIsAddLinksOpen(false)}
      />
    </div>
  );
};

export default FixedSessionStrip;

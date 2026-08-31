import { createTodo } from '../../todos/todoData';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { EditorHeader } from '../../../../../shared-components/editorContainer/EditorHeader';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { getSessionTabTitle } from '../sessionHelpers';

import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronRight,
  FaSave,
  FaTimes,
  FaArrowRight,
  FaLongArrowAltRight,
  FaCheckCircle,
  FaCheck,
  FaAt,
  FaCode,
  FaPen,
  FaLink,
  FaFolder,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaKeyboard,
  FaList,
  FaCopy,
  FaTag,
  FaDirections,
} from 'react-icons/fa';
import {
  FiStar,
  FiChevronLeft,
  FiChevronRight,
  FiTag,
  FiSettings,
  FiCopy,
  FiSearch,
  FiExternalLink,
  FiTarget,
  FiSave,
} from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';

import type { WorkspaceData } from '../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { SnippetRecord } from '../../snippets/snippetTypes';

import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { clsx } from 'clsx';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../../../../shared-components/pathUtils';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { getUserId } from '../../../../../storage/API/core/api';
import { createTag } from '../../tags/tagData';
import { deleteSession, updateSession } from '../sessionData';
import {
  openSingleLink,
  openMultipleLinks,
} from '../../../../../shared-components/searchBarMain/utilityFunctions/urlHelpers';

import type { SelectedLink } from '../../links/linkTypes';
import { useChromeTabs } from '../../links/ui/hooks/useChromeTabs';
import type { SessionTabCapturePayload } from '../useSessionManager';
import { useLinkSessionManager } from '../useSessionManager';
import { HighlightedInput } from '../../links/ui/components/HighlightedInput';
import { useSessionEditor } from '../useSessionEditor';
import SessionAddLinksModal from './SessionAddLinksModal';
import { type SessionOpenSettings, DEFAULT_SESSION_SETTINGS, normalizeSessionOpenSettings } from '../sessionSettings';
import {
  buildSessionLaunchUrls,
  createSessionReferenceExistenceIndex,
  filterAvailableSessionReferenceItems,
  parseSessionReferenceUrl,
  resolveSessionReferenceSource,
} from '../sessionReferenceUtils';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { nowUtc } from '../../../../../shared-components/utils';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';
import { launchSessionSmart } from '../../../../../shared-components/sessions/launchSessionSmart';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import CircularModelStackIcon from '../../../../../shared-components/icons/circularModelStackIcon';
import { resolveEnabledAiPromptModels, useExcludedAiPromptModels, type AiModelTarget } from '../../aiPrompt';
import { handleSessionReferenceLaunchActions } from '../sessionReferenceActions';
import { buildSessionAgentSuggestions } from '../sessionAgentSnapshot';

const SESSION_WIDGET_DEBUG = false;

interface SessionEditorViewProps {
  isOpen?: boolean;
  onClose?: () => void;
  session?: any | null;
  sessionId?: string | null;
  prefill?: any | null;
  reload?: () => void; // Kept for compatibility, though we use optimistic updates
  isWidgetMode?: boolean;
  isFullScreenMode?: boolean;
  isEditMode?: boolean;
  /** Called once when a brand-new session record is first created (widget mode). */
  onSessionCreated?: (sessionId: string) => void;
  /** The widget instance ID - used to link a newly created session back to the widget. */
  widgetId?: string;
  viewId?: string;
  widgetTitle?: string;
  viewPopoverMode?: boolean;
  draftMode?: boolean;
  draftSession?: {
    title?: string;
    urls?: SelectedLink[];
    sessionOpenSettings?: SessionOpenSettings;
    workspaceId?: string | null;
    folderId?: string | null;
    tagIds?: string[];
  } | null;
  onDraftSessionChange?: (draft: {
    title?: string;
    urls: SelectedLink[];
    sessionOpenSettings: SessionOpenSettings;
    workspaceId?: string | null;
    folderId?: string | null;
    tagIds?: string[];
  }) => void;
}

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
            <span className="shrink-0 whitespace-nowrap rounded-md border border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
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

const SessionDragHandle: React.FC = () => (
  <div className="grid grid-cols-2 gap-[2px]">
    {Array.from({ length: 6 }).map((_, index) => (
      <span key={index} className="h-[2.5px] w-[2.5px] rounded-full bg-current opacity-80" />
    ))}
  </div>
);

const EMPTY_INITIAL_URLS: any[] = [];

const getSessionReorderKey = (item: { id?: string; url?: string }, index?: number): string => {
  if (item.id) return item.id;
  return `${item.url || 'session-item'}-${index ?? 0}`;
};

const SortableSessionItem = ({ id, children }: { id: string; children: (dragProps: any) => React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.8 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
};

const normalizeSessionTabUrl = (url?: string): string => {
  if (!url) return '';
  try {
    let value = String(url).toLowerCase().trim();
    value = value.replace(/^https?:\/\//, '');
    value = value.replace(/^www\./, '');
    value = value.replace(/\/$/, '');
    return value;
  } catch {
    return String(url || '')
      .toLowerCase()
      .trim();
  }
};

const getSessionUrlParts = (url?: string): { host: string; path: string } => {
  if (!url) return { host: '', path: '' };
  try {
    const parsed = new URL(String(url).includes('://') ? String(url) : `https://${url}`);
    return {
      host: parsed.hostname.toLowerCase().replace(/^www\./, ''),
      path: `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`,
    };
  } catch {
    const normalized = normalizeSessionTabUrl(url);
    const [host = '', ...pathParts] = normalized.split('/');
    return {
      host: host.replace(/^www\./, ''),
      path: pathParts.length > 0 ? `/${pathParts.join('/')}` : '/',
    };
  }
};

const isDomainOnlySessionUrl = (url?: string): boolean => {
  const { host, path } = getSessionUrlParts(url);
  return Boolean(host) && (!path || path === '/');
};

const isSameSessionUrl = (leftUrl?: string, rightUrl?: string): boolean => {
  const leftNormalized = normalizeSessionTabUrl(leftUrl);
  const rightNormalized = normalizeSessionTabUrl(rightUrl);
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftParts = getSessionUrlParts(leftUrl);
  const rightParts = getSessionUrlParts(rightUrl);
  if (!leftParts.host || leftParts.host !== rightParts.host) return false;

  const leftDomainOnly = isDomainOnlySessionUrl(leftUrl);
  const rightDomainOnly = isDomainOnlySessionUrl(rightUrl);
  if (leftDomainOnly || rightDomainOnly) {
    return leftDomainOnly && rightDomainOnly;
  }

  return leftParts.path === rightParts.path;
};

const normalizeDeepFocusDomain = (value?: string): string => {
  if (!value) return '';
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.hostname.trim();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .trim();
  }
};

const getDeepFocusDomainsFromLinks = (links: Array<{ url?: string }>): string[] => {
  const domains = links.map(link => normalizeDeepFocusDomain(link.url)).filter(Boolean);
  return Array.from(new Set(domains)).sort((a, b) => a.localeCompare(b));
};

const getTabInstanceKey = (
  item: { id?: string; source?: string; originalData?: any } | null | undefined,
): string | null => {
  if (!item || item.source !== 'tab') return null;

  const runtimeTabId = item.originalData?.id;
  if (runtimeTabId !== undefined && runtimeTabId !== null && runtimeTabId !== '') {
    return `tab:${String(runtimeTabId)}`;
  }

  if (typeof item.id === 'string' && item.id.startsWith('tab-')) {
    const suffix = item.id.slice(4);
    const parsedTabId = suffix.split('-')[0];
    if (parsedTabId) {
      return `tab:${parsedTabId}`;
    }
  }

  return null;
};

const areSameSessionItems = (
  left: { id?: string; url?: string; source?: string; originalData?: any },
  right: { id?: string; url?: string; source?: string; originalData?: any },
): boolean => {
  const leftTabKey = getTabInstanceKey(left);
  const rightTabKey = getTabInstanceKey(right);
  if (leftTabKey && rightTabKey) {
    if (leftTabKey === rightTabKey) return true;
  }

  if (left.source === right.source && left.originalData && right.originalData) {
    const leftOriginalId = left.originalData?.id || left.originalData?.snippet_id;
    const rightOriginalId = right.originalData?.id || right.originalData?.snippet_id;
    if (leftOriginalId && rightOriginalId) {
      if (leftOriginalId === rightOriginalId) return true;
    }
  }

  const leftSource = left.source || 'tab';
  const rightSource = right.source || 'tab';
  const sameUrl = isSameSessionUrl(left.url, right.url);

  // Tab rows can rehydrate without a stable source label, so URL identity is
  // the reliable match for live-tab vs saved-tab comparisons.
  if (leftSource === 'tab' || rightSource === 'tab') {
    return sameUrl;
  }

  return sameUrl && leftSource === rightSource;
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

const getCurrentSessionLaunchContext = async (): Promise<{
  currentTabId?: number;
  currentWindowId?: number;
  currentPageUrl?: string;
}> => {
  const chromeAny = (window as any).chrome;
  const currentPageUrl = window.location.href;

  const fallbackToWindow = () =>
    new Promise<{ currentWindowId?: number; currentPageUrl?: string }>(resolve => {
      if (!chromeAny?.windows?.getCurrent) {
        resolve({ currentPageUrl });
        return;
      }

      chromeAny.windows.getCurrent({ populate: false }, (win: any) => {
        resolve({
          currentWindowId: typeof win?.id === 'number' ? win.id : undefined,
          currentPageUrl,
        });
      });
    });

  if (!chromeAny?.tabs?.getCurrent) {
    return fallbackToWindow();
  }

  return new Promise(resolve => {
    chromeAny.tabs.getCurrent((tab: any) => {
      if (chromeAny.runtime?.lastError || typeof tab?.windowId !== 'number') {
        fallbackToWindow().then(resolve);
        return;
      }

      resolve({
        currentTabId: typeof tab?.id === 'number' ? tab.id : undefined,
        currentWindowId: tab.windowId,
        currentPageUrl: tab.url || currentPageUrl,
      });
    });
  });
};

const SessionEditorView: React.FC<SessionEditorViewProps> = ({
  isOpen = true,
  onClose,
  session: initialSessionProp,
  sessionId: sessionIdProp,
  prefill,
  reload,
  isWidgetMode = false,
  isFullScreenMode = false,
  isEditMode: isEditModeProp = false,
  onSessionCreated,
  widgetId: _widgetId,
  viewId: viewIdProp,
  widgetTitle: widgetTitleProp,
  viewPopoverMode = false,
  draftMode = false,
  draftSession = null,
  onDraftSessionChange,
}) => {
  const useViewPopoverLayout = isWidgetMode && viewPopoverMode;
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('session-sidebar-portal-target'));
  }, [isOpen]);

  const handleTabCaptured = useCallback((payload: SessionTabCapturePayload) => {
    if ('kind' in payload && payload.kind === 'replace_captured_tabs') {
      setSelectedLinks((previousLinks: SelectedLink[]) =>
        payload.tabs.map(tab => {
          const existing = previousLinks.find(link => link.url === tab.url);
          return existing
            ? {
                ...existing,
                name: tab.name || existing.name,
                title: tab.name || existing.title,
              }
            : tab;
        }),
      );
      return;
    }

    const newLink = payload as Extract<SessionTabCapturePayload, { id: string }>;
    setSelectedLinks((prev: SelectedLink[]) => {
      if (!newLink.url) return prev;

      const newTabId = newLink.originalData?.id;
      if (newTabId) {
        const existingIndex = prev.findIndex(link => link.originalData?.id === newTabId);
        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          if (existing.url === newLink.url && existing.name === newLink.name) {
            return prev;
          }

          const updated = [...prev];
          updated[existingIndex] = { ...existing, url: newLink.url, name: newLink.name || existing.name };
          return updated;
        }
      }

      if (prev.some((link: SelectedLink) => areSameSessionItems(link, newLink))) return prev;
      return [...prev, newLink];
    });
  }, []);
  const {
    activeSessionId,
    setActiveSessionId,
    sessionName,
    setSessionName,
    sessionError,
    setSessionError,
    isStartingSession,
    setIsStartingSession,
  } = useLinkSessionManager(handleTabCaptured);
  const [localSessionOverride, setLocalSessionOverride] = useState<any | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hasUserModifiedRef = useRef(false);
  const [hasUserEditedTitle, setHasUserEditedTitle] = useState(false);
  const autoSaveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setLocalSessionOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
      setHasUserEditedTitle(false);
    } else {
      hasUserModifiedRef.current = false;
      setHasUserEditedTitle(false);
      if (!initialSessionProp) {
      }
    }
  }, [isOpen, initialSessionProp]);

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const sessions = useDbStore(state => state.sessions);
  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const chatAgents = useDbStore(state => state.chatAgents);
  const aiPrompts = useDbStore(state => state.aiPrompts);
  const { excludedModelIds, isLoading: isAgentModelsLoading } = useExcludedAiPromptModels();
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const tags = useDbStore(state => state.tags);
  const { isFavorite, toggleFavorite, addFavorite } = useFavorites();

  const workspaceNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach((w: any) => {
      map[w.id] = w.workspaceName;
    });
    return map;
  }, [workspaces]);

  const folderNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach((f: any) => {
      map[f.id] = f.folderName;
    });
    return map;
  }, [folders]);

  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach((t: any) => {
      map[t.id] = t.name;
    });
    return map;
  }, [tags]);

  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const rightSideSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setIsRightPanelExpanded(true);
        setTimeout(() => {
          rightSideSearchInputRef.current?.focus();
          rightSideSearchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sortedSessions = useMemo(() => {
    const query = tableSearchQuery.trim().toLowerCase();
    const sorted = [...(sessions || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!query) return sorted;
    return sorted.filter(session => {
      const titleMatch = (session.title || (session as any).name || '').toLowerCase().includes(query);
      const previewMatch = (session.urls || (session as any).tabs || []).some((item: any) =>
        `${item.name || ''} ${item.url || ''}`.toLowerCase().includes(query),
      );
      return titleMatch || previewMatch;
    });
  }, [sessions, tableSearchQuery]);

  const explicitSessionRecord = useMemo(() => {
    if (!sessionIdProp) return null;
    const found = sessions.find(session => String(session.id) === String(sessionIdProp));
    return found || null;
  }, [sessionIdProp, sessions]);

  const resolvedActiveSession = useMemo(() => {
    if (!activeSessionId) return null;
    const found = sessions.find(session => String(session.id) === String(activeSessionId));
    return found || null;
  }, [activeSessionId, sessions]);

  const initialSession = isForceCreateNew
    ? null
    : explicitSessionRecord || localSessionOverride || initialSessionProp || resolvedActiveSession;
  const currentSessionId = isForceCreateNew
    ? null
    : initialSession?.id || (initialSession as any)?.snippet_id || sessionIdProp || activeSessionId || null;

  useEffect(() => {
    if (!isWidgetMode || !SESSION_WIDGET_DEBUG) return;
    console.log(
      '[SessionWidgetDebug][resolve-session]',
      JSON.stringify(
        {
          widgetId: _widgetId,
          sessionIdProp,
          globalActiveSessionId: activeSessionId,
          explicitSessionRecordId: explicitSessionRecord?.id || null,
          resolvedActiveSessionId: resolvedActiveSession?.id || null,
          initialSessionId: initialSession?.id || (initialSession as any)?.snippet_id || null,
          currentSessionId,
        },
        null,
        2,
      ),
    );
  }, [
    _widgetId,
    activeSessionId,
    currentSessionId,
    explicitSessionRecord,
    initialSession,
    isWidgetMode,
    resolvedActiveSession,
    sessionIdProp,
  ]);
  const persistedSessionRecord = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find(session => String(session.id) === String(currentSessionId)) || null;
  }, [currentSessionId, sessions]);
  const isMac = navigator.userAgent.includes('Mac');
  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);

  const initialUrls = useMemo(() => {
    if (!prefill) return EMPTY_INITIAL_URLS;
    if (prefill.category === 'TabGroup') return EMPTY_INITIAL_URLS;
    return [
      {
        id: prefill.id || (prefill as any).snippet_id || generateEntityId('linkItem'),
        url: typeof prefill.value === 'string' ? prefill.value : '',
        name: prefill.key || '',
        source: 'link',
      },
    ];
  }, [prefill]);

  const {
    sessionTitle: title,
    setSessionTitle: setTitle,
    sessionDescription,
    setSessionDescription,
    sessionUrls: selectedLinks,
    setSessionUrls: setSelectedLinks,
    setSessionShortcut,
    isSessionShortcutManuallyEditedRef,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    isDirty: hasUnsavedChanges,
    handleSave: executeSave,
    activeSessionId: liveSessionId,
    resetEditor,
    isInitialized,
    workspaceId,
    setWorkspaceId,
    folderId,
    setFolderId,
    tagIds,
    setTagIds,
    openSettings: sessionOpenSettings,
    setOpenSettings: setSessionOpenSettings,
    versionHistory,
    versionHistoryItems,
    selectedVersionId,
    setSelectedVersionId,
    isViewingHistory,
  } = useSessionEditor({
    sessionId: currentSessionId || undefined,
    initialDraftKey: draftMode ? draftSession?.title || prefill?.key || '' : prefill?.key || '',
    initialDraftUrls: draftMode ? draftSession?.urls || EMPTY_INITIAL_URLS : EMPTY_INITIAL_URLS,
  });

  useEffect(() => {
    if (!draftMode) return;
    setTitle(draftSession?.title || '');
    setSelectedLinks(draftSession?.urls || []);
    setSessionOpenSettings(normalizeSessionOpenSettings(draftSession?.sessionOpenSettings));
    if (draftSession?.workspaceId !== undefined) setWorkspaceId(draftSession.workspaceId);
    if (draftSession?.folderId !== undefined) setFolderId(draftSession.folderId);
    if (draftSession?.tagIds) setTagIds(draftSession.tagIds);
  }, [draftMode]);

  const sessionAgents = useMemo(
    () => buildSessionAgentSuggestions({ chatAgents, aiPrompts }),
    [aiPrompts, chatAgents],
  );
  const sessionReferenceIndex = useMemo(
    () => createSessionReferenceExistenceIndex({ notes, links, snippets, chatAgents: sessionAgents }),
    [links, notes, sessionAgents, snippets],
  );
  const visibleSelectedLinks = useMemo(
    () => filterAvailableSessionReferenceItems(selectedLinks, sessionReferenceIndex),
    [selectedLinks, sessionReferenceIndex],
  );
  const visibleSelectedLinkEntries = useMemo(
    () =>
      selectedLinks.map((item, index) => ({ item, index })).filter(({ item }) => visibleSelectedLinks.includes(item)),
    [selectedLinks, visibleSelectedLinks],
  );

  // When this widget started without a sessionId and the user's first save
  // creates one, fire onSessionCreated so the widget record gets linked.
  const prevEditorSessionIdRef = useRef<string | null>(currentSessionId || null);
  useEffect(() => {
    const wasEmpty = !prevEditorSessionIdRef.current;
    const hasNew = !!liveSessionId && liveSessionId !== prevEditorSessionIdRef.current;
    if (wasEmpty && hasNew && onSessionCreated) {
      onSessionCreated(liveSessionId!);
    }
    prevEditorSessionIdRef.current = liveSessionId || null;
  }, [liveSessionId, onSessionCreated]);

  // Clear validation errors when switching between active sessions/drafts
  useEffect(() => {
    if (setSessionError) setSessionError(null);
  }, [liveSessionId, setSessionError]);

  const effectiveSessionWorkspaceId =
    workspaceId ||
    persistedSessionRecord?.workspaceId ||
    (initialSession as any)?.workspace_id ||
    (initialSession as any)?.workspaceId ||
    null;
  const effectiveSessionFolderId = workspaceId
    ? folderId
    : (persistedSessionRecord?.folderId ??
      (initialSession as any)?.folder_id ??
      (initialSession as any)?.folderId ??
      null);

  const sessionCompoundId = useMemo(() => {
    if (!currentSessionId) return '';

    return getItemCompoundId({
      id: currentSessionId,
      workspace_id: effectiveSessionWorkspaceId || undefined,
      folder_id: effectiveSessionFolderId || undefined,
      snippet: {
        id: currentSessionId,
        category: 'session',
      },
    });
  }, [currentSessionId, effectiveSessionWorkspaceId, effectiveSessionFolderId]);

  useEffect(() => {
    if (liveSessionId && liveSessionId !== activeSessionId) {
      setActiveSessionId(liveSessionId);
    }
  }, [liveSessionId, activeSessionId, setActiveSessionId]);

  useEffect(() => {
    hasUserModifiedRef.current = false;
    setHasUserEditedTitle(false);
  }, [activeSessionId]);

  const [runningSessionId, setRunningSessionId] = useState<string | null>(null);

  // Determine mode based on whether a snippet is passed or has been saved
  const isEditMode = isEditModeProp || !!initialSession || !!liveSessionId || !!currentSessionId;

  const { tabsByWindow, allTabs, currentWindowId, collapsedWindows, setCollapsedWindows, hasFetchedTabs, fetchTabs } =
    useChromeTabs(isOpen);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    let handleStorageChange: any = null;

    if (chromeAny?.storage?.local && currentWindowId !== null && currentWindowId !== undefined) {
      const checkRunningSession = () => {
        chromeAny.storage.local.get('active_sessions', (result: any) => {
          const sessionsList = result.active_sessions || [];
          const matched = sessionsList.find((s: any) => s.windowId === currentWindowId);
          if (isWidgetMode && SESSION_WIDGET_DEBUG) {
            console.log(
              '[SessionWidgetDebug][running-session-window]',
              JSON.stringify(
                {
                  widgetId: _widgetId,
                  currentWindowId,
                  currentSessionId,
                  matchedSessionId: matched?.sessionId || null,
                  matchedLaunchSource: matched?.launchSource || null,
                  activeSessions: sessionsList.map((s: any) => ({
                    sessionId: s.sessionId,
                    windowId: s.windowId,
                    capturedCount: Array.isArray(s.capturedUrls) ? s.capturedUrls.length : 0,
                    launchSource: s.launchSource || null,
                  })),
                },
                null,
                2,
              ),
            );
          }
          setRunningSessionId(matched ? matched.sessionId : null);
        });
      };

      checkRunningSession();
      handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local' && changes.active_sessions) {
          checkRunningSession();
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (chromeAny?.storage?.onChanged && handleStorageChange) {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [currentWindowId, currentSessionId, isWidgetMode, _widgetId]);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [hasAutoPinned, setHasAutoPinned] = useState(false);

  // Pin the tab automatically when a new session is saved for the first time
  useEffect(() => {
    if (!initialSession && saveStatus === 'saved' && !hasAutoPinned) {
      setHasAutoPinned(true);
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to auto-pin extension tab:', e);
      }
    }
  }, [saveStatus, initialSession, hasAutoPinned]);

  // Session open-behavior settings state
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const [deepFocusDomainInput, setDeepFocusDomainInput] = useState('');
  const [isDeepFocusHeaderPopupOpen, setIsDeepFocusHeaderPopupOpen] = useState(false);
  const [deepFocusHeaderDomainInput, setDeepFocusHeaderDomainInput] = useState('');
  const [isSettingsAddingDomain, setIsSettingsAddingDomain] = useState(false);
  const settingsPopupRef = useRef<HTMLDivElement | null>(null);
  const [settingsPopupMaxHeight, setSettingsPopupMaxHeight] = useState<number | undefined>(undefined);
  const hasPendingSessionChanges = hasUnsavedChanges;

  useEffect(() => {
    if (isSettingsPopupOpen && settingsPopupRef.current) {
      const calculateHeight = () => {
        if (!settingsPopupRef.current) return;
        const boundary = isWidgetMode
          ? settingsPopupRef.current.closest('[data-session-widget-root]')
          : document.documentElement;
        const boundaryRect = boundary?.getBoundingClientRect();
        const popupRect = settingsPopupRef.current.getBoundingClientRect();
        const boundaryBottom = boundaryRect?.bottom ?? window.innerHeight;
        const availableHeight = Math.max(80, boundaryBottom - popupRect.top - 12);
        setSettingsPopupMaxHeight(Math.min(620, availableHeight));
      };

      calculateHeight();
      // Also calculate on next tick in case layout shifts
      const nextFrame = window.requestAnimationFrame(calculateHeight);

      const widgetRoot = isWidgetMode ? settingsPopupRef.current.closest('[data-session-widget-root]') : null;
      const resizeObserver =
        widgetRoot && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calculateHeight) : null;
      if (widgetRoot && resizeObserver) resizeObserver.observe(widgetRoot);

      window.addEventListener('resize', calculateHeight);
      return () => {
        window.cancelAnimationFrame(nextFrame);
        resizeObserver?.disconnect();
        window.removeEventListener('resize', calculateHeight);
      };
    } else {
      setSettingsPopupMaxHeight(undefined);
      return undefined;
    }
  }, [isSettingsPopupOpen, isWidgetMode]);

  const hasPrefilledEditModeRef = useRef(false);

  useEffect(() => {
    if (!isInitialized) {
      setSessionError(null);
      return;
    }
    const trimmedName = title.trim();
    if (!trimmedName) {
      setSessionError(null);
      return;
    }
    const currentSessionId = (initialSession as any)?.id || (initialSession as any)?.snippet_id || liveSessionId;

    // 1. Check duplicate session names in local snippet records
    const exists = sessions.some(
      (s: any) =>
        (s.title || '').trim().toLowerCase() === trimmedName.toLowerCase() &&
        String(s.id || s.snippet_id || '') !== String(currentSessionId || ''),
    );

    if (exists) {
      setSessionError('A Tab Session with this name already exists.');
      return;
    }

    // 2. Check duplicate session names in active sessions stored in local storage
    const checkActiveSessions = async () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('active_sessions', (res: any) => {
          const activeSessions = res.active_sessions || [];
          const duplicateActive = activeSessions.some(
            (s: any) =>
              s.sessionName?.toLowerCase() === trimmedName.toLowerCase() &&
              String(s.sessionId || '') !== String(currentSessionId || ''),
          );
          if (duplicateActive) {
            setSessionError('A Tab Session with this name is currently active.');
          } else {
            setSessionError(null);
          }
        });
      } else {
        setSessionError(null);
      }
    };

    checkActiveSessions();
  }, [title, snippets, initialSession, liveSessionId, isInitialized]);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  // Hotkey assignment state (user: hotkey key-pair format)
  const propertiesRef = useRef<any>({});

  const updateDraftSession = useCallback(
    (patch: {
      title?: string;
      urls?: SelectedLink[];
      sessionOpenSettings?: SessionOpenSettings;
      workspaceId?: string | null;
      folderId?: string | null;
      tagIds?: string[];
    }) => {
      if (!draftMode || !onDraftSessionChange) return;
      onDraftSessionChange({
        title: patch.title ?? title,
        urls: patch.urls ?? selectedLinks,
        sessionOpenSettings: normalizeSessionOpenSettings(patch.sessionOpenSettings ?? sessionOpenSettings),
        workspaceId: patch.workspaceId ?? propertiesRef.current?.workspaceId ?? workspaceId ?? null,
        folderId: patch.folderId ?? propertiesRef.current?.folderId ?? folderId ?? null,
        tagIds: patch.tagIds ?? propertiesRef.current?.tagIds ?? tagIds ?? [],
      });
    },
    [draftMode, folderId, onDraftSessionChange, selectedLinks, sessionOpenSettings, tagIds, title, workspaceId],
  );

  useEffect(() => {
    if (initialSession && initialSession.updatedAt) {
      lastSyncTimeRef.current = initialSession.updatedAt;
    }
  }, [initialSession]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      hasUserModifiedRef.current = true;
      setSelectedLinks(currentLinks => {
        const oldIndex = currentLinks.findIndex((l, i) => getSessionReorderKey(l, i) === active.id);
        const newIndex = currentLinks.findIndex((l, i) => getSessionReorderKey(l, i) === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const nextLinks = arrayMove(currentLinks, oldIndex, newIndex);
          if (draftMode) {
            updateDraftSession({ urls: nextLinks });
          }
          return nextLinks;
        }
        return currentLinks;
      });
    }
  }, [draftMode, updateDraftSession]);

  const [isTitleManuallyModified, setIsTitleManuallyModified] = useState(false);

  // Load already-captured links from storage on session start/refresh
  useEffect(() => {
    const targetSessionId = currentSessionId || activeSessionId;

    if (!targetSessionId) return;

    chrome.storage.local.get('active_sessions', result => {
      const data = result.active_sessions || [];

      const session = data.find(
        (s: any) =>
          s.sessionId === targetSessionId &&
          (currentWindowId === null || currentWindowId === undefined || s.windowId === currentWindowId),
      );
      if (isWidgetMode && SESSION_WIDGET_DEBUG) {
        console.log(
          '[SessionWidgetDebug][active-session-preload]',
          JSON.stringify(
            {
              widgetId: _widgetId,
              targetSessionId,
              currentSessionId,
              globalActiveSessionId: activeSessionId,
              matchedWindowId: session?.windowId || null,
              matchedCapturedCount: Array.isArray(session?.capturedUrls) ? session.capturedUrls.length : 0,
              allActiveSessions: data.map((s: any) => ({
                sessionId: s.sessionId,
                windowId: s.windowId,
                capturedCount: Array.isArray(s.capturedUrls) ? s.capturedUrls.length : 0,
                launchSource: s.launchSource || null,
              })),
            },
            null,
            2,
          ),
        );
      }

      if (session) {
        if (Array.isArray(session.capturedUrls) && Array.isArray(session.capturedNames)) {
          const preloaded: SelectedLink[] = session.capturedUrls.map((url: string, index: number) => ({
            id: generateEntityId('linkItem'),
            name: session.capturedNames[index]?.trim() || getHostname(url) || url,
            url: url,
            source: 'tab',
            favIconUrl: getFaviconUrl(getHostname(url)),
          }));
          setSelectedLinks(prev => {
            const shouldApplyPreloadedTabs = prev.length === 0 || !hasUserModifiedRef.current;
            if (isWidgetMode && SESSION_WIDGET_DEBUG) {
              console.log(
                '[SessionWidgetDebug][active-session-preload-apply]',
                JSON.stringify(
                  {
                    widgetId: _widgetId,
                    targetSessionId,
                    previousCount: prev.length,
                    preloadedCount: preloaded.length,
                    willApply: shouldApplyPreloadedTabs,
                  },
                  null,
                  2,
                ),
              );
            }
            if (shouldApplyPreloadedTabs) return preloaded;
            return prev;
          });
        }

        // Legacy cloud team mapping removed - no longer needed with local Dexie storage
      }
    });
  }, [activeSessionId, currentSessionId, currentWindowId, isWidgetMode, _widgetId, setSelectedLinks]);

  // Handle prefill data (e.g. from history/bookmarks/session)

  useEffect(() => {
    if (isOpen && !isEditMode && prefill && !hasInitializedPrefill.current) {
      setTitle(prefill.key || '');
      const prefillId = prefill.id || (prefill as any).snippet_id;
      if (prefillId && !prefill.searchtags) {
        chrome.storage.local.get('alts_searchtags_backup', result => {
          const backup = result.alts_searchtags_backup || {};
          if (backup[prefillId]) {
            // Note: Since we are in the outer parent state for 'prefill', we can't directly
            // set (propertiesRef.current?.selectedTag) here. The real mapping happens in the internal useEffect around line 1150.
            // But we must remove setSearchtags since the state is gone.
          }
        });
      }

      if (prefill.category === 'TabGroup') {
        if (prefillId) {
          setActiveSessionId(prefillId);
        }
      } else {
        setSelectedLinks([
          {
            id: prefillId || generateEntityId('linkItem'),
            url: typeof prefill.value === 'string' ? prefill.value : '',
            name: prefill.key || '',
            source: 'link',
          },
        ]);
      }
      hasInitializedPrefill.current = true;
    } else if (!isOpen) {
      hasInitializedPrefill.current = false;
    }
  }, [isOpen, isEditMode, prefill]);

  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [userId, setUserId] = useState('');
  const footerStatusTimeoutRef = useRef<number | null>(null);

  const showFooterStatus = useCallback((type: 'idle' | 'saving' | 'success' | 'error', message: string) => {
    if (footerStatusTimeoutRef.current) {
      window.clearTimeout(footerStatusTimeoutRef.current);
    }
    setFooterStatus({ type, message });

    if (type === 'success' || type === 'error') {
      footerStatusTimeoutRef.current = window.setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  }, []);

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAltEnterPickerOpen, setIsAltEnterPickerOpen] = useState(false);
  const [isAddLinksModalOpen, setIsAddLinksModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);

  const initialFavRef = useRef<boolean>(false);

  // Reminder & Schedule states
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
  const [linkTodoStatus, setLinkTodoStatus] = useState<'idle' | 'creating' | 'success'>('idle');
  const [pendingTodoData, setPendingTodoData] = useState<{
    deadlineVal: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    isAnytime: boolean;
    taskTitle: string;
    tempId: string;
  } | null>(null);
  const cyclePopupRef = useRef<HTMLDivElement | null>(null);
  const timePopupRef = useRef<HTMLDivElement | null>(null);
  const sessionPopupRef = useRef<HTMLDivElement | null>(null);
  const todoPopupRef = useRef<HTMLDivElement | null>(null);
  const todoHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cyclePopupRef.current && !cyclePopupRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (timePopupRef.current && !timePopupRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
      if (todoPopupRef.current && !todoPopupRef.current.contains(event.target as Node)) {
        setIsTodoPopupOpen(false);
      }
      if (
        sessionPopupRef.current &&
        !sessionPopupRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.session-btn')
      ) {
        setSessionDialogOpen(false);
      }
      if (
        settingsPopupRef.current &&
        !settingsPopupRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.settings-btn')
      ) {
        setIsSettingsPopupOpen(false);
      }
      if (event.target instanceof Element && !event.target.closest('.three-dots-container')) {
        setActiveMenuLinkId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (locationHoverTimerRef.current) clearTimeout(locationHoverTimerRef.current);
      if (tagHoverTimerRef.current) clearTimeout(tagHoverTimerRef.current);
      if (todoHoverTimerRef.current) clearTimeout(todoHoverTimerRef.current);
    };
  }, []);

  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');
  const editingUrlInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuLinkId, setActiveMenuLinkId] = useState<string | null>(null);

  const tabItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Link edit popup state
  const [editingPopupLinkId, setEditingPopupLinkId] = useState<string | null>(null);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    search: string;
  } | null>(null);

  // Local state for the URL input to allow editing
  const [localUrlValue, setLocalUrlValue] = useState('');
  // Local state for the link name (display name) editing
  const [editingLinkName, setEditingLinkName] = useState('');
  const urlNameInputRef = useRef<HTMLInputElement>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);

  const parseUrlParts = useCallback((url: string) => {
    try {
      let normalized = url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
      }
      const u = new URL(normalized);
      const paths = u.pathname.split('/').filter(Boolean);
      const cleanDomain = u.host.replace(/^www\./i, '');
      return { protocol: u.protocol.replace(':', ''), domain: cleanDomain, paths, search: u.search };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: { protocol: string; domain: string; paths: string[]; search: string }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    const protocol = parts.protocol || 'https';
    return `${protocol}://${parts.domain}${pathStr}${parts.search}`;
  }, []);

  const duplicateLink = useCallback((link: SelectedLink) => {
    setSelectedLinks(prev => {
      const newId = generateEntityId('linkItem');
      const nextLinks = [
        ...prev,
        {
          ...link,
          id: newId,
          name: `${link.name} (Copy)`,
        },
      ];
      if (draftMode) {
        updateDraftSession({ urls: nextLinks });
      }
      return nextLinks;
    });
  }, [draftMode, updateDraftSession]);

  const openLinkEditPopup = useCallback(
    (link: SelectedLink) => {
      const parts = parseUrlParts(link.url);
      setEditingPopupLinkId(link.id);
      setEditingUrlParts(parts);
      setLocalUrlValue(link.url.replace(/^https?:\/\/(www\.)?/i, ''));
      setEditingLinkName(link.name || '');
    },
    [parseUrlParts],
  );

  const closeLinkEditPopup = useCallback(() => {
    setEditingPopupLinkId(null);
    setEditingUrlParts(null);
    setLocalUrlValue('');
    setEditingLinkName('');
  }, []);

  const saveLinkEditPopup = useCallback(() => {
    if (!editingPopupLinkId) return;
    hasUserModifiedRef.current = true;
    let newUrl = editingUrlParts ? assembleUrl(editingUrlParts) : localUrlValue;

    newUrl = newUrl.trim();
    if (newUrl && !/^https?:\/\//i.test(newUrl)) {
      newUrl = `https://${newUrl}`;
    }

    setSelectedLinks(prev => {
      const nextLinks = prev.map(link =>
        link.id === editingPopupLinkId ? { ...link, url: newUrl, name: editingLinkName || link.name } : link,
      );
      if (draftMode) {
        updateDraftSession({ urls: nextLinks });
      }
      return nextLinks;
    });
    closeLinkEditPopup();
  }, [
    assembleUrl,
    closeLinkEditPopup,
    draftMode,
    editingLinkName,
    editingPopupLinkId,
    editingUrlParts,
    localUrlValue,
    updateDraftSession,
  ]);

  // Track which path input is focused for inserting variables
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | null>(null);
  const [showPathQueryDropdown, setShowPathQueryDropdown] = useState(false);

  // Sync editingUrlParts to localUrlValue when parts change (if not editing manualy)
  useEffect(() => {
    if (!editingUrlParts) return;
    if (document.activeElement === urlNameInputRef.current) return;

    const assembled = assembleUrl(editingUrlParts);
    setLocalUrlValue(assembled.replace(/^https?:\/\/(www\.)?/i, ''));
  }, [editingUrlParts, assembleUrl]);

  const [availableItems, setAvailableItems] = useState<SelectedLink[]>([]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  const seenAutoSelectedTabsRef = useRef<Set<string>>(new Set());

  // Auto-select ALL browser tabs when autosave is enabled so the visible
  // Current Tabs list and the persisted session URLs share one source of truth.
  useEffect(() => {
    if (isOpen && sessionOpenSettings.autoSaveMode === 'auto_save' && !prefill && availableItems.length > 0) {
      const allTabsItems = availableItems.filter(item => item.source === 'tab');
      // Use functional state update to avoid dependency cycle
      setSelectedLinks(prevLinks => {
        let addedAny = false;
        const newLinks = [...prevLinks];
        for (const tab of allTabsItems) {
          const tabId = tab.originalData?.id || tab.url;
          if (tabId && !seenAutoSelectedTabsRef.current.has(String(tabId))) {
            seenAutoSelectedTabsRef.current.add(String(tabId));
            if (!newLinks.some(link => areSameSessionItems(link, tab))) {
              newLinks.push(tab);
              addedAny = true;
            }
          }
        }
        if (addedAny) {
          hasUserModifiedRef.current = true;
          if (draftMode) {
            updateDraftSession({ urls: newLinks });
          }
          if (isWidgetMode && SESSION_WIDGET_DEBUG) {
            console.log(
              '[SessionWidgetDebug][auto-save-select-tabs]',
              JSON.stringify(
                {
                  widgetId: _widgetId,
                  currentSessionId,
                  globalActiveSessionId: activeSessionId,
                  runningSessionId,
                  previousCount: prevLinks.length,
                  nextCount: newLinks.length,
                  availableTabCount: allTabsItems.length,
                  addedUrls: newLinks
                    .filter(link => !prevLinks.some(prev => areSameSessionItems(prev, link)))
                    .map(link => link.url),
                },
                null,
                2,
              ),
            );
          }
        }
        return addedAny ? newLinks : prevLinks;
      });
    }
  }, [
    isOpen,
    prefill,
    availableItems,
    sessionOpenSettings.autoSaveMode,
    isWidgetMode,
    _widgetId,
    currentSessionId,
    draftMode,
    activeSessionId,
    runningSessionId,
    updateDraftSession,
  ]);

  // Live-tracking: sync selectedLinks with currently open tabs (add opened, remove closed)
  const previousOpenTabsRef = useRef<Map<string, string> | null>(null);
  const liveTrackingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const currentSessionId =
      initialSession?.id || (initialSession as any)?.snippet_id || sessionIdProp || activeSessionId || null;
    const isLiveSyncingSession =
      currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);
    const isCreateMode = !initialSession && !activeSessionId;
    if (isWidgetMode && SESSION_WIDGET_DEBUG && sessionOpenSettings.autoSaveMode !== 'dont_save') {
      console.log(
        '[SessionWidgetDebug][live-tracking-check]',
        JSON.stringify(
          {
            widgetId: _widgetId,
            currentSessionId,
            globalActiveSessionId: activeSessionId,
            runningSessionId,
            isLiveSyncingSession: Boolean(isLiveSyncingSession),
            isCreateMode,
            isOpen,
            hasFetchedTabs,
            availableTabCount: availableItems.filter(item => item.source === 'tab').length,
          },
          null,
          2,
        ),
      );
    }

    if (!isOpen || !hasFetchedTabs) {
      previousOpenTabsRef.current = null;
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
        liveTrackingTimeoutRef.current = null;
      }
      return;
    }

    if (sessionOpenSettings.autoSaveMode === 'dont_save') {
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
        liveTrackingTimeoutRef.current = null;
      }
      return;
    }

    const allTabsItems = availableItems.filter(item => item.source === 'tab');
    const currentOpenTabState = new Map(
      allTabsItems
        .map(item => {
          const key = getTabInstanceKey(item);
          if (!key) return null;
          const signature = JSON.stringify({
            url: item.url,
            name: item.name,
            favIconUrl: item.favIconUrl || '',
          });
          return [key, signature] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry)),
    );
    const currentOpenItemsByKey = new Map(
      allTabsItems
        .map(item => {
          const key = getTabInstanceKey(item);
          return key ? ([key, item] as const) : null;
        })
        .filter((entry): entry is readonly [string, SelectedLink] => Boolean(entry)),
    );

    if (previousOpenTabsRef.current === null) {
      previousOpenTabsRef.current = currentOpenTabState;
      return;
    }

    const previousOpenTabState = previousOpenTabsRef.current;
    const addedTabKeys = Array.from(currentOpenTabState.keys()).filter(tabKey => !previousOpenTabState.has(tabKey));
    const removedTabKeys = Array.from(previousOpenTabState.keys()).filter(tabKey => !currentOpenTabState.has(tabKey));
    const changedTabKeys = Array.from(currentOpenTabState.entries())
      .filter(
        ([tabKey, signature]) =>
          previousOpenTabState.get(tabKey) !== undefined && previousOpenTabState.get(tabKey) !== signature,
      )
      .map(([tabKey]) => tabKey);

    if (addedTabKeys.length > 0 || removedTabKeys.length > 0 || changedTabKeys.length > 0) {
      if (isWidgetMode && SESSION_WIDGET_DEBUG) {
        console.log(
          '[SessionWidgetDebug][live-tracking-delta]',
          JSON.stringify(
            {
              widgetId: _widgetId,
              currentSessionId,
              runningSessionId,
              addedTabKeys,
              removedTabKeys,
              changedTabKeys,
            },
            null,
            2,
          ),
        );
      }
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
      }
      liveTrackingTimeoutRef.current = window.setTimeout(() => {
        setSelectedLinks(prevLinks => {
          let newLinks = [...prevLinks];
          let changed = false;

          if (removedTabKeys.length > 0) {
            const beforeCount = newLinks.length;
            newLinks = newLinks.filter(link => {
              if (link.source !== 'tab') return true;
              const tabKey = getTabInstanceKey(link);
              if (!tabKey) return true;
              return !removedTabKeys.includes(tabKey);
            });
            if (newLinks.length !== beforeCount) changed = true;
          }

          if (changedTabKeys.length > 0) {
            newLinks = newLinks.map(link => {
              if (link.source !== 'tab') return link;
              const tabKey = getTabInstanceKey(link);
              if (!tabKey || !changedTabKeys.includes(tabKey)) return link;

              const updatedItem = currentOpenItemsByKey.get(tabKey);
              if (!updatedItem) return link;
              changed = true;
              return {
                ...link,
                url: updatedItem.url,
                name: updatedItem.name,
                favIconUrl: updatedItem.favIconUrl,
                originalData: updatedItem.originalData,
              };
            });
          }

          for (const tabKey of addedTabKeys) {
            const tabItem = currentOpenItemsByKey.get(tabKey);
            if (tabItem && !newLinks.some(link => areSameSessionItems(link, tabItem))) {
              newLinks.push(tabItem);
              changed = true;
            }
          }

          if (changed) {
            hasUserModifiedRef.current = true;
            if (isWidgetMode && SESSION_WIDGET_DEBUG) {
              console.log(
                '[SessionWidgetDebug][live-tracking-apply]',
                JSON.stringify(
                  {
                    widgetId: _widgetId,
                    currentSessionId,
                    runningSessionId,
                    previousCount: prevLinks.length,
                    nextCount: newLinks.length,
                  },
                  null,
                  2,
                ),
              );
            }
          }
          return changed ? newLinks : prevLinks;
        });
        previousOpenTabsRef.current = currentOpenTabState;
        liveTrackingTimeoutRef.current = null;
      }, 800);
    } else {
      previousOpenTabsRef.current = currentOpenTabState;
    }
    return () => {
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
        liveTrackingTimeoutRef.current = null;
      }
    };
  }, [
    isOpen,
    availableItems,
    sessionOpenSettings.autoSaveMode,
    setSelectedLinks,
    hasFetchedTabs,
    activeSessionId,
    runningSessionId,
    initialSession,
    isWidgetMode,
    _widgetId,
    sessionIdProp,
  ]);

  useEffect(() => {
    const currentSessionId =
      initialSession?.id || (initialSession as any)?.snippet_id || sessionIdProp || activeSessionId || null;
    const isLiveSyncingSession =
      currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);
    const isCreateMode = !initialSession && !activeSessionId;

    if (!isOpen || sessionOpenSettings.autoSaveMode === 'dont_save' || !hasFetchedTabs) return;

    const currentTabItems = availableItems.filter(item => item.source === 'tab');
    if (currentTabItems.length === 0) return;

    setSelectedLinks(prevLinks => {
      const currentTabQueuesByUrl = new Map<string, SelectedLink[]>();
      currentTabItems.forEach(item => {
        const normalizedUrl = normalizeSessionTabUrl(item.url);
        const queueKey = `url:${normalizedUrl}`;
        const existingQueue = currentTabQueuesByUrl.get(queueKey) || [];
        existingQueue.push(item);
        currentTabQueuesByUrl.set(queueKey, existingQueue);
      });

      let changed = false;
      const nextLinks = prevLinks.map(link => {
        if (link.source !== 'tab' || getTabInstanceKey(link)) {
          return link;
        }

        const normalizedUrl = normalizeSessionTabUrl(link.url);
        const fallbackKey = `url:${normalizedUrl}`;
        const queue = currentTabQueuesByUrl.get(fallbackKey);
        const matchedLiveTab = queue?.shift();

        if (!matchedLiveTab) {
          return link;
        }

        changed = true;
        return {
          ...link,
          url: matchedLiveTab.url,
          name: link.name || matchedLiveTab.name,
          favIconUrl: link.favIconUrl || matchedLiveTab.favIconUrl,
          originalData: matchedLiveTab.originalData,
        };
      });

      if (changed) {
        hasUserModifiedRef.current = true;
      }
      return changed ? nextLinks : prevLinks;
    });
  }, [
    availableItems,
    isOpen,
    sessionOpenSettings.autoSaveMode,
    setSelectedLinks,
    hasFetchedTabs,
    activeSessionId,
    runningSessionId,
    initialSession,
    sessionIdProp,
  ]);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  // Manual location overrides (for changing folder via picker)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);
  const lastAutoSaveSignatureRef = useRef<string | null>(null);

  // If manualWorkspaceId is set, it means the user explicitly used the picker.
  // We should trust the manual state fully (even if folder is null) to allow moving to root.
  const isManualOverride = manualWorkspaceId !== null;

  const hasDestination = true;
  const needsDestinationSelection = false;

  const isDuplicateName = useCallback(
    (newName: string) => {
      // Duplicate checks in Redux are disabled as Dexie handles it natively
      return false;
    },
    [initialSession],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        urls: selectedLinks.map(link => link.url),
        openSettings: sessionOpenSettings,
        tagIds: tagIds || [],
        workspaceId: workspaceId || null,
        folderId: folderId || null,
      }),
    [title, selectedLinks, sessionOpenSettings, tagIds, workspaceId, folderId],
  );
  const hasPersistedCurrentSignature =
    saveStatus !== 'saving' && lastAutoSaveSignatureRef.current === autoSaveSignature;
  const shouldShowUnsavedIndicator =
    hasPendingSessionChanges &&
    !hasPersistedCurrentSignature &&
    (sessionOpenSettings.autoSaveMode !== 'dont_save' || hasUserModifiedRef.current || saveStatus === 'saving');

  // Load user ID on mount
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    fetchUserId();
  }, []);

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (!initialSession) {
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialSession, isOpen, userId]);

  const toggleFavoriteLocal = async (item: any) => {
    if (!userId) return;
    try {
      const targetId = item.id || (item as any).snippet_id;
      const type = 'session';
      await toggleFavorite(targetId, type, item.key);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const handleToggleFavorite = () => {
    if (initialSession) {
      toggleFavoriteLocal(initialSession);
    } else {
    }
  };

  const handleCreateTodoFromLink = async () => {
    // Cloud snippet-to-todo logic has been removed as it's dead code.
    setLinkTodoStatus('idle');
  };

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      // Append /{query} to the selected path component
      newPaths[focusedPathIndex] = (newPaths[focusedPathIndex] || '') + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else if (editingUrlParts.paths.length > 0) {
      // Default: append to last path
      const newPaths = [...editingUrlParts.paths];
      newPaths[newPaths.length - 1] = newPaths[newPaths.length - 1] + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      // No paths, add to domain
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex]);

  const teamId = '';

  const getHostname = useCallback((url: string) => {
    try {
      if (!url) return '';
      // Ensure protocol
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(safeUrl).hostname;
    } catch (error) {
      return url;
    }
  }, []);

  const getResolvedLinkFavicon = useCallback(
    (link?: { url?: string; favIconUrl?: string }) => {
      if (link?.favIconUrl) return link.favIconUrl;
      if (!link?.url || !/^https?:\/\//i.test(link.url)) return '';
      return getFaviconUrl(getHostname(link.url));
    },
    [getHostname],
  );

  const getStackedUrlsForSessionLink = useCallback(
    (link: SelectedLink) => {
      const inlineUrls = getUrlsFromLinkItems(link.originalData?.urls);
      if (inlineUrls.length > 0) return inlineUrls;

      const triggerInfo = parseSessionReferenceUrl(link.url);
      if (triggerInfo?.type !== 'link' || !triggerInfo.id) return [];

      const linkRecord = links.find(linkRecord => String(linkRecord.id) === String(triggerInfo.id));
      return getUrlsFromLinkItems(linkRecord?.urls);
    },
    [links],
  );

  const getAgentModelsForSessionLink = useCallback(
    (link: SelectedLink): AiModelTarget[] => {
      const triggerInfo = parseSessionReferenceUrl(link.url);
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
        .filter((model: any): model is AiModelTarget => Boolean(model));
    },
    [aiPrompts, chatAgents, excludedModelIds],
  );

  const renderSessionLinkIcon = useCallback(
    (link: SelectedLink, size = 20) => {
      const iconClass = 'text-[var(--color-iconDefault)]';
      const linkSource = resolveSessionReferenceSource(link);
      if (linkSource === 'note') {
        return <NotesIcon size={size} className={iconClass} />;
      }
      if (linkSource === 'snippet') {
        return <FaCode size={Math.max(size - 2, 12)} className={iconClass} />;
      }
      if (linkSource === 'agent') {
        return (
          <CircularModelStackIcon
            models={getAgentModelsForSessionLink(link)}
            isLoading={isAgentModelsLoading}
            variant="compact"
          />
        );
      }
      if (linkSource === 'link') {
        const stackedUrls = getStackedUrlsForSessionLink(link);
        if (stackedUrls.length > 0) {
          return <StackedLinkIcon urls={stackedUrls} size={size} fallback="link" />;
        }
        return <FaLink size={Math.max(size - 3, 12)} className={iconClass} />;
      }

      const resolvedIcon = getResolvedLinkFavicon(link);
      if (resolvedIcon) {
        return <img src={resolvedIcon} className="h-5 w-5 shrink-0 object-contain" alt="" />;
      }

      return <FaLink size={Math.max(size - 3, 12)} className="text-[var(--color-textMuted)]" />;
    },
    [getAgentModelsForSessionLink, getResolvedLinkFavicon, getStackedUrlsForSessionLink, isAgentModelsLoading],
  );

  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
  };

  const rawSearchTagsRef = useRef<Record<string, string[]> | string>({});
  const lastPrefilledSnippetIdRef = useRef<string | null>(null);

  // Prefill fields when editing an existing session is now natively handled by useSessionEditor's liveSession sync.

  useEffect(() => {
    if (!isOpen) return;
    fetchTabs();
    const interval = window.setInterval(fetchTabs, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, fetchTabs]);

  useEffect(() => {
    if (!editingUrlId) return;
    const t = window.setTimeout(() => editingUrlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [editingUrlId]);

  // Load items for content bar (from BuildView)
  useEffect(() => {
    if (!isOpen) return;

    const loadItems = async () => {
      const items: SelectedLink[] = [];

      // 1. Current Tabs from the active window only.
      // The session editor should not mix tabs from other browser windows into the
      // current session view, because that makes unrelated windows appear captured.
      const activeWindowTabs =
        tabsByWindow && currentWindowId !== null && currentWindowId !== undefined
          ? tabsByWindow[currentWindowId] || []
          : [];

      activeWindowTabs.forEach(t => {
        if (t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) {
          items.push({
            id: `tab-${t.id}`,
            url: t.url,
            name: t.title || 'Untitled Tab',
            favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),

            source: 'tab',
            originalData: t,
          });
        }
      });

      // 2. Links & Notes from Redux (allData)
      // Helper to process snippets into list items
      const processSnippet = (s: any) => {
        const category = String(s.category || '').toLowerCase();

        const isLink = category === 'link';
        if (!isLink) return;

        let subtitle = '';
        try {
          if (typeof s.value === 'string') {
            if (s.value.trim().startsWith('{')) {
              const parsed = JSON.parse(s.value);
              if (parsed.urls && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                subtitle = parsed.urls[0];
              } else if (parsed.url) {
                subtitle = parsed.url;
              } else {
                subtitle = s.value;
              }
            } else {
              subtitle = s.value;
            }
          }
        } catch {
          subtitle = '';
        }

        items.push({
          id: s.id || s.snippet_id || generateEntityId('linkItem'),
          url: subtitle,
          name: s.key || 'Untitled',
          source: 'link',
          favIconUrl: subtitle ? getFaviconUrl(getHostname(subtitle)) : undefined,
          originalData: s,
        });
      };

      // Load all local DB items so Recent and cross-workspace items stay visible.
      snippets.forEach(processSnippet);

      // Sort items by updated_at or created_at (descending) to show recent items first
      // Note: originalData might not always have updated_at depending on source, fallback to created_at or 0
      items.sort((a, b) => {
        const tA = a.originalData?.updated_at || a.originalData?.created_at || 0;
        const tB = b.originalData?.updated_at || b.originalData?.created_at || 0;
        // Handle ISO strings or timestamps
        const timeA = new Date(tA).getTime();
        const timeB = new Date(tB).getTime();
        return timeB - timeA;
      });

      setAvailableItems(items);
    };

    loadItems();
  }, [isOpen, snippets, tabsByWindow, activeSessionId, currentWindowId]);

  const checkIsAdded = useCallback(
    (item: SelectedLink) => {
      return selectedLinks.some(selected => areSameSessionItems(selected, item));
    },
    [selectedLinks],
  );

  const liveTabTitleByUrl = useMemo(() => {
    const titles = new Map<string, string>();

    availableItems.forEach(item => {
      if (item.source !== 'tab') return;
      const normalizedUrl = normalizeSessionTabUrl(item.url);
      const title = String(item.title || item.name || '').trim();
      if (normalizedUrl && title) {
        titles.set(normalizedUrl, title);
      }
    });

    return titles;
  }, [availableItems]);

  const availableSessionTabs = useMemo(
    () => availableItems.filter(item => item.source === 'tab' && !checkIsAdded(item)),
    [availableItems, checkIsAdded],
  );

  const handleWorkspaceDestination = useCallback((workspace: any, isPersonal?: boolean) => {
    // Switch team if personal workspace selected
    hasUserModifiedRef.current = true;

    // Update local override
    setManualWorkspaceId(workspace.workspace_id || null);
    setManualFolderId(null);
    setIsLocationPickerOpen(false);
  }, []);

  const handleFolderDestination = useCallback((workspace: any, folder: any, isPersonal?: boolean) => {
    // Switch team if personal workspace selected
    hasUserModifiedRef.current = true;

    // Update local override
    setManualWorkspaceId(workspace.workspace_id || null);
    setManualFolderId(folder.folder_id || null);
    setIsLocationPickerOpen(false);
  }, []);

  const removeLink = useCallback(
    (linkId: string) => {
      hasUserModifiedRef.current = true;
      setSelectedLinks(prev => {
        const nextLinks = prev.filter(link => link.id !== linkId);
        if (draftMode) {
          updateDraftSession({ urls: nextLinks });
        } else {
          setTimeout(() => executeSave(false, { urls: nextLinks }), 0);
        }
        return nextLinks;
      });
    },
    [draftMode, executeSave, updateDraftSession],
  );

  // Add item from content bar (handles tabs, links, notes)
  const addItemFromContentBar = useCallback(
    (item: SelectedLink) => {
      hasUserModifiedRef.current = true;

      setSelectedLinks(prev => {
        const newId = generateEntityId('linkItem');
        const nextLinks = [
          ...prev,
          {
            ...item,
            id: newId,
          },
        ];
        if (draftMode) {
          updateDraftSession({ urls: nextLinks });
        } else {
          setTimeout(() => executeSave(false, { urls: nextLinks }), 0);
        }
        return nextLinks;
      });

      if (!draftMode && activeSessionId && item.url && item.source !== 'tab') {
        chrome.runtime
          .sendMessage({
            action: 'open_tab_in_session',
            sessionId: activeSessionId,
            url: item.url,
          })
          .catch(() => {});
      }
    },
    [isTitleManuallyModified, activeSessionId, draftMode, executeSave, updateDraftSession],
  );

  const handleAddSessionLinks = useCallback(
    async (items: SelectedLink[]): Promise<boolean> => {
      const validItems = items.filter(item => Boolean(item.url));
      if (validItems.length === 0) return false;

      hasUserModifiedRef.current = true;
      const timestamp = Date.now();
      const nextItems = validItems.map((item, index) => {
        const title = item.title || item.name || getHostname(item.url);
        return {
          ...item,
          id: item.id || `${item.source || 'session-link'}-${timestamp}-${index}`,
          title,
          name: item.name || title,
        };
      });
      const nextSelectedLinks = [...selectedLinks, ...nextItems];

      setSelectedLinks(nextSelectedLinks);

      if (draftMode) {
        updateDraftSession({
          sessionOpenSettings,
          workspaceId: propertiesRef.current?.workspaceId,
          folderId: propertiesRef.current?.folderId,
          tagIds: propertiesRef.current?.tagIds,
          urls: nextSelectedLinks,
        });
        return true;
      }

      const savedSessionId = await executeSave(true, {
        openSettings: sessionOpenSettings,
        workspaceId: propertiesRef.current?.workspaceId,
        folderId: propertiesRef.current?.folderId,
        tagIds: propertiesRef.current?.tagIds,
        urls: nextSelectedLinks,
      });

      if (!savedSessionId) {
        showFooterStatus('error', 'Could not save the session item.');
        return false;
      }

      const targetSessionId = activeSessionId || savedSessionId;
      const launchUrls = buildSessionLaunchUrls(nextItems, links);
      launchUrls.openUrls.forEach(url => {
        if (url) {
          chrome.runtime
            .sendMessage({
              action: 'open_tab_in_session',
              sessionId: targetSessionId,
              url,
            })
            .catch(() => {});
        }
      });
      void handleSessionReferenceLaunchActions(nextItems, {
        aiPrompts,
        chatAgents,
      });

      return true;
    },
    [
      activeSessionId,
      aiPrompts,
      chatAgents,
      draftMode,
      executeSave,
      getHostname,
      links,
      propertiesRef,
      selectedLinks,
      sessionOpenSettings,
      setSelectedLinks,
      showFooterStatus,
      updateDraftSession,
    ],
  );

  const updateLinkName = useCallback(
    (linkId: string, name: string) => {
      hasUserModifiedRef.current = true;
      setSelectedLinks(prev => {
        const nextLinks = prev.map(link => (link.id === linkId ? { ...link, name: name || link.url } : link));
        if (draftMode) {
          updateDraftSession({ urls: nextLinks });
        }
        return nextLinks;
      });
    },
    [draftMode, updateDraftSession],
  );

  const handleAddCustomLink = useCallback(
    async (url: string, customName?: string): Promise<boolean> => {
      const rawUrl = url.trim();
      if (!rawUrl) {
        showFooterStatus('error', 'Enter a URL to add.');
        return false;
      }

      let normalizedUrl = rawUrl;
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      try {
        // Validate URL

        new URL(normalizedUrl);
      } catch (error) {
        showFooterStatus('error', 'Enter a valid URL.');
        return false;
      }

      hasUserModifiedRef.current = true;
      const name = customName?.trim() || getHostname(normalizedUrl);
      const id = generateEntityId('linkItem');
      const customLink: SelectedLink = {
        id,
        url: normalizedUrl,
        name,
        source: 'custom',
        favIconUrl: getFaviconUrl(getHostname(normalizedUrl)),
      };
      const nextSelectedLinks = [...selectedLinks, customLink];

      setSelectedLinks(nextSelectedLinks);

      if (draftMode) {
        updateDraftSession({
          sessionOpenSettings,
          workspaceId: propertiesRef.current?.workspaceId,
          folderId: propertiesRef.current?.folderId,
          tagIds: propertiesRef.current?.tagIds,
          urls: nextSelectedLinks,
        });
        return true;
      }

      const savedSessionId = await executeSave(true, {
        openSettings: sessionOpenSettings,
        workspaceId: propertiesRef.current?.workspaceId,
        folderId: propertiesRef.current?.folderId,
        tagIds: propertiesRef.current?.tagIds,
        urls: nextSelectedLinks,
      });
      if (!savedSessionId) {
        showFooterStatus('error', 'Could not save the session link.');
        return false;
      }

      chrome.runtime
        .sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId || savedSessionId,
          url: normalizedUrl,
        })
        .catch(() => {});

      return true;
    },
    [draftMode, getHostname, selectedLinks, executeSave, sessionOpenSettings, propertiesRef, activeSessionId, showFooterStatus, updateDraftSession],
  );

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);

  const handleCreateSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsStartingSession(true);
    setSessionError(null);

    try {
      // 1. Check duplicate session names in local snippet records
      let exists = false;
      const currentSessionIdLocal = (initialSession as any)?.id || (initialSession as any)?.snippet_id;
      exists = sessions.some(
        (s: any) =>
          s.title?.trim().toLowerCase() === trimmedName.toLowerCase() &&
          String(s.id) !== String(currentSessionIdLocal) &&
          String((s as any).snippet_id) !== String(currentSessionIdLocal),
      );

      if (exists) {
        showFooterStatus('error', 'A Tab Session with this name already exists.');
        setIsStartingSession(false);
        return;
      }

      // 2. Check duplicate session names in active sessions stored in local storage
      const activeSessionsResult = await new Promise<any[]>(resolve => {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get('active_sessions', (res: any) => resolve(res.active_sessions || []));
        } else {
          resolve([]);
        }
      });
      const currentSessionId = (initialSession as any)?.id || (initialSession as any)?.snippet_id || liveSessionId;
      const duplicateActive = activeSessionsResult.some(
        (s: any) =>
          s.sessionName?.toLowerCase() === trimmedName.toLowerCase() &&
          String(s.sessionId || '') !== String(currentSessionId || ''),
      );
      if (duplicateActive) {
        showFooterStatus('error', 'A Tab Session with this name is currently active.');
        setIsStartingSession(false);
        return;
      }

      const sessionId =
        isEditMode && initialSession
          ? initialSession.id || (initialSession as any).snippet_id
          : generateEntityId('session');

      // Pin the extension tab immediately when a session is started
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to pin extension tab:', e);
      }

      const launchUrls = buildSessionLaunchUrls(selectedLinks, links);

      const response = await launchSessionSmart({
        sessionId,
        sessionName: name.trim(),
        workspaceId: propertiesRef.current?.workspaceId || null,
        folderId: propertiesRef.current?.folderId || null,
        teamId,
        storageMode: 'local',
        initialUrls: launchUrls.initialUrls,
        initialNames: launchUrls.initialNames,
        openUrls: launchUrls.openUrls,
        openNames: launchUrls.openNames,
        openSettings: sessionOpenSettings,
        source: 'session_editor',
        requireAutoSave: false,
      });
      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to start session');
      }
      void handleSessionReferenceLaunchActions(selectedLinks, {
        aiPrompts,
        chatAgents,
      });
      setSessionDialogOpen(false);
      setSessionName('');
      showFooterStatus('success', 'Tab Session started!');
      onClose?.(); // Return to home view since session is running in a separate window
    } catch (e: any) {
      showFooterStatus('error', e.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleSave = useCallback(
    async (
      isAutoSave: boolean = false,
      overrideLinks?: SelectedLink[],
      overrideTitle?: string,
      overrideSettings?: SessionOpenSettings,
      overrideProps?: { workspaceId?: string | null; folderId?: string | null; tagIds?: string[] },
    ) => {
      if (!hasUnsavedChanges && !overrideProps && !overrideLinks && !overrideTitle && !overrideSettings) {
        return true;
      }
      if (overrideTitle !== undefined) setTitle(overrideTitle);
      if (overrideLinks !== undefined) setSelectedLinks(overrideLinks);

      if (draftMode) {
        updateDraftSession({
          title: overrideTitle,
          urls: overrideLinks,
          sessionOpenSettings: overrideSettings || sessionOpenSettings,
          workspaceId: overrideProps?.workspaceId,
          folderId: overrideProps?.folderId,
          tagIds: overrideProps?.tagIds,
        });
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        setIsForceCreateNew(false);
        setHasUserEditedTitle(false);
        return true;
      }

      const saved = await executeSave(isAutoSave, {
        openSettings: overrideSettings || sessionOpenSettings,
        workspaceId: overrideProps?.workspaceId,
        folderId: overrideProps?.folderId,
        tagIds: overrideProps?.tagIds,
        title: overrideTitle,
        urls: overrideLinks,
      });

      if (saved) {
        setIsForceCreateNew(false);
        setHasUserEditedTitle(false);
      }

      if (saved && !isAutoSave) {
        setTimeout(() => onClose?.(), 1500);
      }
      return saved;
    },
    [
      draftMode,
      executeSave,
      hasUnsavedChanges,
      onClose,
      sessionOpenSettings,
      setLastSavedAt,
      setSaveStatus,
      setSelectedLinks,
      setTitle,
      updateDraftSession,
    ],
  );

  const handlePropertiesChange = useCallback(
    (properties: any) => {
      let newTagIds: string[] | undefined = undefined;

      // Extract tagIds from selectedTags (array of {id, name}) if provided
      if (properties.selectedTags !== undefined) {
        newTagIds = properties.selectedTags.map((tag: any) => tag.id) as string[];
        setTagIds(newTagIds);
      } else if (properties.tagIds !== undefined) {
        newTagIds = properties.tagIds as string[];
        setTagIds(newTagIds);
      }

      const prevWorkspaceId = propertiesRef.current?.workspaceId;
      const prevFolderId = propertiesRef.current?.folderId;
      const prevTagIds = propertiesRef.current?.tagIds;
      const nextWorkspaceId = properties.workspaceId !== undefined ? properties.workspaceId : prevWorkspaceId;
      const nextFolderId = properties.folderId !== undefined ? properties.folderId : prevFolderId;
      const nextTagIds = newTagIds !== undefined ? newTagIds : prevTagIds;

      propertiesRef.current = {
        ...propertiesRef.current,
        ...properties,
        workspaceId: nextWorkspaceId,
        folderId: nextFolderId,
        tagIds: nextTagIds,
      };

      if (properties.workspaceId !== undefined) {
        setWorkspaceId(nextWorkspaceId);
      }
      if (properties.folderId !== undefined) {
        setFolderId(nextFolderId);
      }

      const didWorkspaceChange = nextWorkspaceId !== prevWorkspaceId;
      const didFolderChange = nextFolderId !== prevFolderId;
      const didTagsChange = JSON.stringify(nextTagIds || []) !== JSON.stringify(prevTagIds || []);

      // Only trigger autosave if this was an actual change in values
      if (didWorkspaceChange || didFolderChange || didTagsChange) {
        hasUserModifiedRef.current = true;
        void handleSave(true, undefined, undefined, undefined, {
          workspaceId: nextWorkspaceId,
          folderId: nextFolderId,
          tagIds: nextTagIds,
        });
      }
    },
    [setWorkspaceId, setFolderId, setTagIds, tagIds, workspaceId, folderId, handleSave],
  );

  const ensureAutoSaveTrackingActive = useCallback(
    async (sessionId: string, nextSettings: SessionOpenSettings) => {
      const chromeAny = (window as any).chrome;
      if (!sessionId || !chromeAny?.runtime?.sendMessage) return;

      const launchContext = await getCurrentSessionLaunchContext();
      const targetWindowId = typeof currentWindowId === 'number' ? currentWindowId : launchContext.currentWindowId;

      if (chromeAny?.storage?.local && typeof targetWindowId === 'number') {
        const activeSessionsResult = await new Promise<any[]>(resolve => {
          chromeAny.storage.local.get('active_sessions', (result: any) => {
            resolve(Array.isArray(result?.active_sessions) ? result.active_sessions : []);
          });
        });

        const isAlreadyRunningHere = activeSessionsResult.some(
          session => String(session?.sessionId || '') === String(sessionId) && session?.windowId === targetWindowId,
        );
        if (isAlreadyRunningHere) {
          const currentWindowTabs = typeof targetWindowId === 'number' ? tabsByWindow[targetWindowId] || [] : [];
          const launchLinks =
            selectedLinks.length > 0
              ? selectedLinks
              : currentWindowTabs.map(tab => ({
                  url: tab.url,
                  name: tab.title || tab.url,
                }));
          const launchUrls = buildSessionLaunchUrls(launchLinks, links);

          const response = await chromeAny.runtime.sendMessage({
            action: 'activate_session_autosave_tracking',
            sessionId,
            sessionName: title.trim() || persistedSessionRecord?.title || sessionName || 'Untitled Tab Session',
            workspaceId:
              propertiesRef.current?.workspaceId || workspaceId || persistedSessionRecord?.workspaceId || null,
            folderId: propertiesRef.current?.folderId ?? folderId ?? persistedSessionRecord?.folderId ?? null,
            teamId,
            storageMode: 'local',
            initialUrls: launchUrls.initialUrls,
            initialNames: launchUrls.initialNames,
            openUrls: launchUrls.openUrls,
            openNames: launchUrls.openNames,
            openSettings: nextSettings,
            ...launchContext,
            currentWindowId: targetWindowId ?? launchContext.currentWindowId,
          });

          if (!response?.ok) {
            throw new Error(response?.error || 'Failed to activate auto-save tracking');
          }

          void handleSessionReferenceLaunchActions(launchLinks, {
            aiPrompts,
            chatAgents,
          });
          setRunningSessionId(String(sessionId));
          return;
        }
      } else if (runningSessionId && String(runningSessionId) === String(sessionId)) {
        return;
      }

      const launchLinks =
        selectedLinks.length > 0
          ? selectedLinks
          : Array.isArray(persistedSessionRecord?.urls)
            ? persistedSessionRecord.urls.map((link: any) => ({
                url: link.url,
                name: link.name || link.title || link.url,
              }))
            : [];
      const launchUrls = buildSessionLaunchUrls(launchLinks, links);

      const response = await launchSessionSmart({
        sessionId,
        sessionName: title.trim() || persistedSessionRecord?.title || sessionName || 'Untitled Tab Session',
        workspaceId: propertiesRef.current?.workspaceId || workspaceId || persistedSessionRecord?.workspaceId || null,
        folderId: propertiesRef.current?.folderId ?? folderId ?? persistedSessionRecord?.folderId ?? null,
        teamId,
        storageMode: 'local',
        initialUrls: launchUrls.initialUrls,
        initialNames: launchUrls.initialNames,
        openUrls: launchUrls.openUrls,
        openNames: launchUrls.openNames,
        openSettings: nextSettings,
        context: {
          ...launchContext,
          currentWindowId: targetWindowId ?? launchContext.currentWindowId,
        },
        source: 'autosave_tracking',
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to start auto-save session');
      }

      void handleSessionReferenceLaunchActions(launchLinks, {
        aiPrompts,
        chatAgents,
      });
      setRunningSessionId(String(sessionId));
    },
    [
      aiPrompts,
      chatAgents,
      currentWindowId,
      folderId,
      links,
      persistedSessionRecord,
      runningSessionId,
      selectedLinks,
      sessionName,
      tabsByWindow,
      teamId,
      title,
      workspaceId,
    ],
  );

  const deactivateAutoSaveTracking = useCallback(
    async (sessionId: string) => {
      const chromeAny = (window as any).chrome;
      if (!sessionId || !chromeAny?.runtime?.sendMessage) return;

      const launchContext = await getCurrentSessionLaunchContext();
      const targetWindowId = typeof currentWindowId === 'number' ? currentWindowId : launchContext.currentWindowId;

      await chromeAny.runtime.sendMessage({
        action: 'deactivate_session_autosave_tracking',
        sessionId,
        currentWindowId: targetWindowId,
      });

      if (!runningSessionId || String(runningSessionId) === String(sessionId)) {
        setRunningSessionId(null);
      }
    },
    [currentWindowId, runningSessionId],
  );

  const updateSessionSettings = useCallback(
    (patch: Partial<SessionOpenSettings>) => {
      const hasChanges = Object.keys(patch).some(
        key => patch[key as keyof SessionOpenSettings] !== sessionOpenSettings[key as keyof SessionOpenSettings],
      );
      if (!hasChanges) return;

      const nextSettings = normalizeSessionOpenSettings({ ...sessionOpenSettings, ...patch });
      setSessionOpenSettings(nextSettings);

      if (draftMode) {
        updateDraftSession({ sessionOpenSettings: nextSettings });
        return;
      }

      const currentSessionId =
        initialSession?.id || (initialSession as any)?.snippet_id || sessionIdProp || activeSessionId || null;
      const isTurningAutoSaveOff = patch.autoSaveMode === 'dont_save';
      const isTurningAutoSaveOn =
        sessionOpenSettings.autoSaveMode !== 'auto_save' && nextSettings.autoSaveMode === 'auto_save';

      const shouldAutosave = Boolean(
        currentSessionId ||
          (!currentSessionId && nextSettings.autoSaveMode === 'auto_save' && selectedLinks.length > 0),
      );
      if (isTurningAutoSaveOn) {
        void (async () => {
          const currentWindowTabsForAutoSave =
            typeof currentWindowId === 'number' ? tabsByWindow[currentWindowId] || [] : [];
          const autoSaveInitialLinks: SelectedLink[] | undefined =
            selectedLinks.length === 0 && currentWindowTabsForAutoSave.length > 0
              ? currentWindowTabsForAutoSave.map(tab => ({
                  id: `tab-${tab.id}-${tab.index ?? 0}`,
                  url: tab.url,
                  name: tab.title || tab.url,
                  source: 'tab' as const,
                  favIconUrl: tab.favIconUrl || '',
                  originalData: tab.id ? { id: tab.id } : undefined,
                }))
              : undefined;

          const savedSessionId = await handleSave(true, autoSaveInitialLinks, undefined, nextSettings);
          if (!savedSessionId) return;

          const resolvedSessionId = typeof savedSessionId === 'string' ? savedSessionId : currentSessionId;
          if (!resolvedSessionId) return;

          try {
            await ensureAutoSaveTrackingActive(resolvedSessionId, nextSettings);
          } catch (error: any) {
            console.error('[SessionFlow][auto-save-start] failed:', error);
            showFooterStatus('error', error?.message || 'Failed to activate auto-save tracking');
          }
        })();
      } else if (shouldAutosave) {
        const shouldPreservePersistedContentOnly =
          nextSettings.autoSaveMode === 'dont_save' && !!persistedSessionRecord;

        void (async () => {
          await handleSave(
            true,
            shouldPreservePersistedContentOnly ? persistedSessionRecord.urls : undefined,
            shouldPreservePersistedContentOnly ? persistedSessionRecord.title : undefined,
            nextSettings,
          );

          if (isTurningAutoSaveOff && currentSessionId) {
            try {
              await deactivateAutoSaveTracking(currentSessionId);
            } catch (error) {
              console.error('[SessionFlow][auto-save-stop] failed:', error);
            }
          }
        })();
      }

      if (!currentSessionId && isTurningAutoSaveOff) {
        seenAutoSelectedTabsRef.current.clear();
        setSelectedLinks([]);
      }
    },
    [
      activeSessionId,
      currentWindowId,
      deactivateAutoSaveTracking,
      draftMode,
      ensureAutoSaveTrackingActive,
      handleSave,
      persistedSessionRecord,
      selectedLinks.length,
      sessionOpenSettings,
      sessionIdProp,
      initialSession,
      setSelectedLinks,
      showFooterStatus,
      tabsByWindow,
      updateDraftSession,
    ],
  );

  const deepFocusManualDomains = useMemo(
    () =>
      Array.from(
        new Set(
          (sessionOpenSettings.deepFocusAllowedDomains || [])
            .map(domain => normalizeDeepFocusDomain(domain))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [sessionOpenSettings.deepFocusAllowedDomains],
  );

  const deepFocusBlockedDomains = useMemo(
    () =>
      Array.from(
        new Set(
          (sessionOpenSettings.deepFocusBlockedDomains || [])
            .map(domain => normalizeDeepFocusDomain(domain))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [sessionOpenSettings.deepFocusBlockedDomains],
  );

  const deepFocusAutoDomains = useMemo(() => {
    const savedSessionLinks = [
      ...((persistedSessionRecord?.urls || []) as Array<{ url?: string }>),
      ...((initialSession?.urls || []) as Array<{ url?: string }>),
      ...((initialSessionProp?.urls || []) as Array<{ url?: string }>),
      ...selectedLinks,
    ];
    return getDeepFocusDomainsFromLinks(savedSessionLinks).filter(domain => !deepFocusBlockedDomains.includes(domain));
  }, [
    deepFocusBlockedDomains,
    initialSession?.urls,
    initialSessionProp?.urls,
    persistedSessionRecord?.urls,
    selectedLinks,
  ]);

  const deepFocusEffectiveDomains = useMemo(
    () => Array.from(new Set([...deepFocusAutoDomains, ...deepFocusManualDomains])).sort((a, b) => a.localeCompare(b)),
    [deepFocusAutoDomains, deepFocusManualDomains],
  );

  const currentDeepFocusTab = useMemo(() => {
    const currentWindowTabs =
      currentWindowId !== null && currentWindowId !== undefined ? tabsByWindow[currentWindowId] || [] : [];
    return currentWindowTabs.find(tab => tab.active) || allTabs.find(tab => tab.active) || null;
  }, [allTabs, currentWindowId, tabsByWindow]);

  const currentDeepFocusDomain = useMemo(
    () => normalizeDeepFocusDomain(currentDeepFocusTab?.url),
    [currentDeepFocusTab?.url],
  );

  const addDeepFocusDomain = useCallback(
    (value: string): boolean => {
      const normalizedDomain = normalizeDeepFocusDomain(value);
      if (!normalizedDomain) return false;

      const nextDomains = Array.from(new Set([...deepFocusManualDomains, normalizedDomain])).sort((a, b) =>
        a.localeCompare(b),
      );
      const nextBlockedDomains = deepFocusBlockedDomains.filter(domain => domain !== normalizedDomain);
      hasUserModifiedRef.current = true;
      updateSessionSettings({ deepFocusAllowedDomains: nextDomains, deepFocusBlockedDomains: nextBlockedDomains });
      return true;
    },
    [deepFocusBlockedDomains, deepFocusManualDomains, updateSessionSettings],
  );

  const handleAddDeepFocusDomain = useCallback(() => {
    if (!addDeepFocusDomain(deepFocusDomainInput)) return;
    setDeepFocusDomainInput('');
  }, [addDeepFocusDomain, deepFocusDomainInput]);

  const handleRemoveDeepFocusDomain = useCallback(
    (domainToRemove: string) => {
      const nextDomains = deepFocusManualDomains.filter(domain => domain !== domainToRemove);
      hasUserModifiedRef.current = true;
      updateSessionSettings({ deepFocusAllowedDomains: nextDomains });
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
      hasUserModifiedRef.current = true;
      updateSessionSettings({
        deepFocusAllowedDomains: nextManualDomains,
        deepFocusBlockedDomains: nextBlockedDomains,
      });
    },
    [deepFocusBlockedDomains, deepFocusManualDomains, updateSessionSettings],
  );

  const handleAddCurrentDeepFocusDomain = useCallback(() => {
    if (!currentDeepFocusDomain) return;
    addDeepFocusDomain(currentDeepFocusDomain);
  }, [addDeepFocusDomain, currentDeepFocusDomain]);

  const handleAddHeaderDeepFocusDomain = useCallback(() => {
    if (!addDeepFocusDomain(deepFocusHeaderDomainInput)) return;
    setDeepFocusHeaderDomainInput('');
    setIsDeepFocusHeaderPopupOpen(false);
  }, [addDeepFocusDomain, deepFocusHeaderDomainInput]);

  useEffect(() => {
    if (!isOpen) return;

    if (draftMode) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    if (sessionOpenSettings.autoSaveMode === 'dont_save') {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    // With title/shortcut hidden for sessions, selected tabs are enough to
    // create or update an untitled session through autosave.
    const shouldBlockAutoSave = !hasUserModifiedRef.current && !hasUserEditedTitle && selectedLinks.length === 0;
    if (shouldBlockAutoSave) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }
    if (!hasPendingSessionChanges) {
      lastAutoSaveSignatureRef.current = autoSaveSignature;
      return;
    }
    if (lastAutoSaveSignatureRef.current === autoSaveSignature) {
      return;
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSave(true).then(saved => {
        if (saved) {
          lastAutoSaveSignatureRef.current = autoSaveSignature;
          hasUserModifiedRef.current = false;
        }
      });
    }, 400);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    autoSaveSignature,
    draftMode,
    handleSave,
    hasPendingSessionChanges,
    hasUserEditedTitle,
    isOpen,
    selectedLinks.length,
    sessionOpenSettings.autoSaveMode,
    activeSessionId,
    runningSessionId,
    initialSession,
  ]);

  const parseSnippetValue = useCallback(
    (value: string): SelectedLink[] => {
      if (!value) return [];
      try {
        if (value.startsWith('{') || value.startsWith('[')) {
          const parsed = JSON.parse(value);
          if (parsed && Array.isArray(parsed.urls)) {
            return parsed.urls.map((url: string, index: number) => ({
              id: generateEntityId('linkItem'),
              url,
              name: parsed.names?.[index] || getHostname(url),
              source: 'link' as const,
            }));
          }
        }
      } catch (e) {
        console.warn('[LinkEditModal] Failed to parse snippet value:', e);
      }
      return [
        {
          id: generateEntityId('linkItem'),
          url: value,
          name: '',
          source: 'link' as const,
        },
      ];
    },
    [getHostname],
  );

  const handleResolveConflictOverwrite = useCallback(async () => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;

    // Set sync baseline to cloud timestamp so retry bypasses comparison check
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);

    // Retry saving
    await handleSave(false, localData.selectedLinks, localData.title);
  }, [conflictModalData, handleSave]);

  const handleResolveConflictMerge = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    const cloudLinks = parseSnippetValue(cloudSnippet.value);

    const merged = [...localData.selectedLinks];
    cloudLinks.forEach(cl => {
      if (!merged.some(l => l.url === cl.url)) {
        merged.push(cl);
      }
    });

    setTitle(cloudSnippet.key || localData.title);
    setSelectedLinks(merged);

    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Merged local and cloud edits');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const handleResolveConflictDiscard = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet } = conflictModalData;

    setTitle(cloudSnippet.key || '');
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    setSelectedLinks(cloudLinks);

    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Loaded cloud version');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const hasSyncedInitialDataRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasSyncedInitialDataRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditMode && isOpen && !hasSyncedInitialDataRef.current) {
      if (selectedLinks.length > 0) {
        hasSyncedInitialDataRef.current = true;
      }
    }
  }, [isEditMode, isOpen, selectedLinks]);

  const isCreatingNewRef = useRef(false);

  const handleCreateNew = useCallback(async () => {
    if (isCreatingNewRef.current) return;
    isCreatingNewRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    hasUserModifiedRef.current = false;
    setHasUserEditedTitle(false);
    try {
      // Save current session silently (autosave=true) — we just want to persist,
      // NOT trigger onClose or open a new Chrome window
      await executeSave(true);

      const currentProps = useUIStore.getState().activeEditor?.props || {};
      const cleanProps = { ...currentProps, session: null, snippet: null, prefill: null, item: null };
      useUIStore.getState().openEditor({ type: 'session', id: 'new', props: cleanProps });
      setActiveSessionId(null);
      setIsForceCreateNew(true);
      resetEditor();
      setTitle('');
      setSelectedLinks([]);
      setSessionShortcut('');
      setSessionError(null);
      setLocalSessionOverride(null);
      hasInitializedPrefill.current = false;
      hasSyncedInitialDataRef.current = false;
      hasUserModifiedRef.current = false;
      setHasUserEditedTitle(false);
      lastAutoSaveSignatureRef.current = '';
      seenAutoSelectedTabsRef.current.clear();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Keep last workspace/folder for convenience, but clear session-specific tags
      propertiesRef.current = {
        workspaceId: propertiesRef.current?.workspaceId ?? null,
        folderId: propertiesRef.current?.folderId ?? null,
        tagIds: [],
      };

      // Reset all UI state
      setIsAddLinksModalOpen(false);
      setIsSettingsPopupOpen(false);
      setIsLocationPickerOpen(false);
      setIsTitleManuallyModified(false);
      setHasAutoPinned(false);
      setFooterStatus({ type: 'idle', message: '' });
      setEditingUrlId(null);
      setEditingUrlValue('');
      isSessionShortcutManuallyEditedRef.current = false;
      setSessionShortcut('');
    } finally {
      isCreatingNewRef.current = false;
    }
  }, [executeSave, resetEditor]);

  const handleCloseAttempt = useCallback(async () => {
    const endSessionIfActive = () => {
      if (activeSessionId) {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.windows?.getCurrent) {
          chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
            if (currentWindow?.id) {
              chromeAny.runtime
                .sendMessage({
                  action: 'end_session',
                  windowId: currentWindow.id,
                })
                .catch((e: any) => console.error('[LinkEditModal] Failed to send end_session to background:', e));
            }
          });
        }
        setActiveSessionId(null);
      }
    };

    // Explicitly force a final save before closing.
    const saved = await handleSave(false);

    onClose?.();
    endSessionIfActive();
  }, [activeSessionId, handleSave, onClose, hasPendingSessionChanges]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => {
      if (isAddLinksModalOpen || document.getElementById('hotkey-assignment-popup')) {
        return true; // we just let those handle it or block it
      }
      handleCloseAttempt();
      return true; // We intercepted the escape, don't let uiStateManager forcefully close
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isOpen, isAddLinksModalOpen, handleCloseAttempt]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isOpen) return;
      // Create New Shortcut strictly on Ctrl+Shift+Enter
      else if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        handleCreateNew();
      }
      // Location Picker Shortcut: Alt+Enter (Win) -> Option+Enter (Mac)
      else if (
        event.altKey && // Option is also altKey on Mac
        event.key === 'Enter'
      ) {
        event.preventDefault();
        if (saveStatus === 'saving') return;
        if (false) {
          showFooterStatus('error', 'Create a workspace first');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        setIsAddLinksModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    handleSave,
    saveStatus,
    needsDestinationSelection,
    onClose,

    isOpen,
    hasUnsavedChanges,
    title,
    selectedLinks,

    handleCloseAttempt,
    isMac,
    isEditMode,
    isAddLinksModalOpen,
    handleCreateNew,
  ]);

  // Browser-level warning for unsaved changes commented out per request
  /*
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isOpen) return undefined;
      const hasUnsavedChanges = !isEditMode && (selectedLinks.length > 0 || title.trim().length > 0);

      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, isEditMode, selectedLinks.length, title]);
  */

  const [focusedTabIndex, setFocusedTabIndex] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Skip global "Enter to add link" if certain interactive elements are focused
      const focused = document.activeElement;
      const isHeaderElementFocused =
        focused === favButtonRef.current ||
        (hotkeyButtonRef.current &&
          (focused === hotkeyButtonRef.current || hotkeyButtonRef.current.contains(focused as Node)));

      const isContentEditable = focused && (focused.getAttribute('contenteditable') === 'true' || focused.closest('[contenteditable="true"]'));
      const isOutsideSession = focused && focused !== document.body && !focused.closest('[data-session-widget-root]') && !focused.closest('.session-editor-container') && !focused.closest('.session-widget-hover-scrollbar');

      if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || isContentEditable || isOutsideSession)) {
        return;
      }

      if (isAddLinksModalOpen || isLocationPickerOpen || isAltEnterPickerOpen || editingUrlId) return;

      const totalNavigable = visibleSelectedLinkEntries.length + 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev >= totalNavigable - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev <= 0 ? totalNavigable - 1 : prev - 1));
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (focusedTabIndex === visibleSelectedLinkEntries.length) {
          setIsAddLinksModalOpen(true);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (focusedTabIndex !== visibleSelectedLinkEntries.length && visibleSelectedLinkEntries[focusedTabIndex]?.item) {
          e.preventDefault();
          e.stopPropagation();
          removeLink(visibleSelectedLinkEntries[focusedTabIndex].item.id);
        }
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [
    visibleSelectedLinkEntries,
    focusedTabIndex,
    removeLink,
    editingUrlId,
    isAltEnterPickerOpen,
    isAddLinksModalOpen,
    isLocationPickerOpen,
    isOpen,
  ]);

  useEffect(() => {
    const el = tabItemRefs.current[focusedTabIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedTabIndex]);

  if (!isOpen) return null;

  const handleUpdateItemField = useCallback(
    async (id: string, field: string, value: string) => {
      try {
        const existing = sortedSessions.find((s: any) => s.id === id);
        if (!existing) return;

        const currentActiveId = liveSessionId || currentSessionId || activeSessionId;
        const isEditingActiveItem = String(id) === String(currentActiveId);

        if (field === 'title') {
          const updatedTitle = value.trim() || 'Untitled Session';
          await updateSession(id, { title: updatedTitle });
          if (isEditingActiveItem) {
            setTitle(updatedTitle);
            if (lastSavedTitleRef) lastSavedTitleRef.current = updatedTitle;
            if (setSaveError) setSaveError(null);
            if (setSessionError) setSessionError(null);
          }
        } else if (field === 'tags') {
          const tagNames = value
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
          const resolvedTags: any[] = [];
          const allTags = useDbStore.getState().tags;
          for (const name of tagNames) {
            const matchedTag = allTags.find(
              (t: any) => t.name.toLowerCase() === name.toLowerCase() && t.workspaceId === existing.workspaceId,
            );
            if (matchedTag) {
              resolvedTags.push(matchedTag);
            } else if (existing.workspaceId) {
              const newTag = await createTag(name, existing.workspaceId);
              resolvedTags.push(newTag);
            }
          }
          await updateSession(id, { tagIds: resolvedTags.map((t: any) => t.id) });
        }

        if (isEditingActiveItem) {
          if (setSaveStatus) setSaveStatus('saved');
          if (setLastSavedAt) setLastSavedAt(new Date());
        }
      } catch (error) {
        console.error('[SessionEditorView] Failed to update item field:', error);
      }
    },
    [
      sortedSessions,
      activeSessionId,
      liveSessionId,
      currentSessionId,
      setTitle,
      setSaveStatus,
      setSaveError,
      setLastSavedAt,
      lastSavedTitleRef,
    ],
  );
  return (
    <>
      <EditorContainer
        className={
          isWidgetMode
            ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent p-0 overflow-hidden'
            : 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-6 md:px-12 lg:px-24 py-4'
        }
        innerClassName={
          isWidgetMode
            ? useViewPopoverLayout
              ? 'flex flex-col relative bg-transparent w-full h-full min-h-0 overflow-hidden border-none'
              : 'flex flex-col relative bg-transparent w-full h-full min-h-0 overflow-y-auto overflow-x-auto border-none'
            : 'flex flex-row items-stretch gap-2 relative bg-transparent mx-auto min-h-[450px] h-auto max-h-[860px] max-h-[90vh] overflow-visible w-[calc(100%-20px)] max-w-[1800px]'
        }>
        <div
          className={
            isWidgetMode
              ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-transparent border-none'
              : 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] relative'
          }>
          {!useViewPopoverLayout && (
            <EditorHeader
              title={isWidgetMode ? widgetTitleProp || 'Session' : isEditMode ? 'Edit Tab Session' : 'Create a Tab Session'}
              isWidgetMode={isWidgetMode}
              viewId={viewIdProp}
              widgetId={_widgetId}
              isEditMode={isEditModeProp}
              typeLabel={isWidgetMode ? 'Session' : null}
              isDirty={hasUnsavedChanges && hasUserModifiedRef.current && (isEditMode || selectedLinks.length > 0)}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              activeId={currentSessionId}
              onCloseClick={onClose || (() => {})}
              showCloseButton={false}
              titleRightActions={null}
              headerActions={
                <div className="flex items-center gap-3">
                  {!isWidgetMode && (
                    <SharedPropertiesToolbar
                      key={currentSessionId || 'new-session'}
                      initialSnippet={{
                        ...initialSession,
                        ...initialSessionProp,
                        workspaceId,
                        folderId,
                        tagIds: tagIds,
                        category: 'session',
                      }}
                      currentSnapshot={{
                        title,
                        description: sessionDescription,
                        urls: (selectedLinks || []).map((t: any) => ({ ...t, title: getSessionTabTitle(t) })),
                        workspaceId,
                        folderId,
                        tagIds: [...(tagIds || [])],
                        sessionOpenSettings: { ...sessionOpenSettings },
                        windowId: initialSession?.windowId,
                      }}
                      compoundId={sessionCompoundId}
                      defaultName={title || 'New Session'}
                      onChange={handlePropertiesChange}
                      versionHistoryItems={versionHistoryItems}
                      versionHistory={versionHistory || initialSession?.versionHistory}
                      selectedVersionId={selectedVersionId}
                      onSelectVersion={setSelectedVersionId}
                      entityType="session"
                      showShortcut={false}
                      showTodo={true}
                      onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                        console.log('[SessionEditorView:onCreateTodo] Called with:', {
                          deadlineVal,
                          isRecurring,
                          recurringCycle,
                          activeSessionId,
                          title,
                        });
                        const sId = activeSessionId || generateEntityId('session');
                        const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                        const todoTitle = title || 'New Session';
                        try {
                          const tabRefs = selectedLinks.map(link => ({
                            type: (link as any).category || 'tab',
                            id: link.id || link.url,
                            name: link.title || link.url,
                          }));
                          const references = [{ type: 'session', id: sId, name: todoTitle }, ...tabRefs];

                          const newTodo = await createTodo(
                            todoTitle,
                            references,
                            isRecurring ? 'recurring' : 'one-time',
                            scheduleTime,
                            isRecurring ? (recurringCycle as any) : undefined,
                          );
                          console.log('[SessionEditorView:onCreateTodo] Successfully created To-Do in Dexie:', newTodo);

                          const chromeAny = (window as any).chrome;
                          if (chromeAny?.runtime?.sendMessage) {
                            chromeAny.runtime.sendMessage({
                              action: 'schedule_newtodo_alarm',
                              todoId: newTodo.id,
                              scheduleTime: scheduleTime,
                            });
                            console.log(
                              '[SessionEditorView:onCreateTodo] Dispatched schedule_newtodo_alarm for todoId:',
                              newTodo.id,
                            );
                          }
                        } catch (err) {
                          console.error(
                            '[SessionEditorView:onCreateTodo] Failed to create and schedule session todo',
                            err,
                          );
                        }
                      }}
                      saveStatus={saveStatus}
                      openPopupsToBottom={true}
                      layout="horizontal"
                    />
                  )}
                  <div className="relative inline-block z-[9999] flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setIsSettingsPopupOpen(prev => !prev);
                      }}
                      className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 settings-btn"
                      title="Tab Session settings">
                      <FiSettings size={14} />
                    </button>
                    {isSettingsPopupOpen && (
                      <div
                        ref={settingsPopupRef}
                        className={`absolute right-0 top-full mt-1.5 w-[285px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] text-[var(--color-textSecondary)] shadow-2xl shadow-black/40 opacity-100 z-[99999]`}
                        style={{
                          maxHeight: settingsPopupMaxHeight
                            ? `${settingsPopupMaxHeight}px`
                            : isWidgetMode
                              ? '220px'
                              : 'min(620px,calc(100vh-2rem))',
                        }}
                        onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setIsSettingsPopupOpen(false)}
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
                              enabled={
                                sessionOpenSettings.focusWindow === true || sessionOpenSettings.deepFocusMode === true
                              }
                              onClick={() => {
                                const nextFocusMode = !(
                                  sessionOpenSettings.focusWindow === true || sessionOpenSettings.deepFocusMode === true
                                );
                                hasUserModifiedRef.current = true;
                                updateSessionSettings({
                                  focusWindow: nextFocusMode,
                                  deepFocusMode: nextFocusMode,
                                });
                              }}
                              isLast
                            />
                          </div>
                          <SessionSettingsRow
                            title="Auto-save session"
                            icon={<FiSave size={14} />}
                            description="Automatically save changes to this session as tabs are added or removed."
                            enabled={sessionOpenSettings.autoSaveMode === 'auto_save'}
                            onClick={() => {
                              hasUserModifiedRef.current = true;
                              updateSessionSettings({
                                autoSaveMode:
                                  sessionOpenSettings.autoSaveMode === 'auto_save' ? 'dont_save' : 'auto_save',
                              });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {sessionOpenSettings.deepFocusMode === true && (
                    <div className="relative flex items-center rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] h-8">
                      <button
                        type="button"
                        className="px-2.5 h-full text-[11px] font-bold text-[var(--color-error)] whitespace-nowrap transition-colors hover:bg-[var(--color-selectedBg)] rounded-l-md"
                        title="Turn off Focus Mode"
                        onClick={e => {
                          e.stopPropagation();
                          hasUserModifiedRef.current = true;
                          updateSessionSettings({ deepFocusMode: false, focusWindow: false });
                        }}>
                        Focus Mode: On
                      </button>
                      <div className="w-px h-4 bg-[var(--color-borderDefault)] mx-0.5" />
                      <button
                        type="button"
                        onClick={() => setIsDeepFocusHeaderPopupOpen(prev => !prev)}
                        className="inline-flex h-full px-2 items-center justify-center text-[var(--color-textPrimary)] transition hover:bg-[var(--color-selectedBg)] rounded-r-md"
                        title="Add Focus Mode allowed domain">
                        <FaPlus size={10} />
                      </button>
                      {isDeepFocusHeaderPopupOpen && (
                        <div
                          className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-3 text-[var(--color-textSecondary)] shadow-2xl shadow-black/40 z-[99999]"
                          onClick={event => event.stopPropagation()}>
                          <div className="text-[12px] font-bold text-[var(--color-textPrimary)]">
                            Add allowed domain
                          </div>
                          <div className="mt-1 text-[10px] leading-snug text-[var(--color-textSecondary)]">
                            Paste a URL or type a domain. Only the exact hostname will be added.
                          </div>
                          {deepFocusEffectiveDomains.length > 0 && (
                            <div className="mt-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-textMuted)]">
                                Currently allowed
                              </div>
                              <div className="mt-1 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-1">
                                {deepFocusEffectiveDomains.map(domain => {
                                  const isCustom = deepFocusManualDomains.includes(domain);
                                  return (
                                    <span
                                      key={`header-allowed-${domain}`}
                                      className={clsx(
                                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                                        isCustom
                                          ? 'border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                                          : 'border border-[var(--color-borderDefault)] bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]',
                                      )}
                                      title={isCustom ? 'Custom allowed domain' : 'Allowed from session links'}>
                                      {domain}
                                      {isCustom ? (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDeepFocusDomain(domain)}
                                          className="rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]"
                                          aria-label={`Remove ${domain}`}>
                                          <FaTimes size={8} />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDeepFocusAutoDomain(domain)}
                                          className="rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]"
                                          aria-label={`Remove session domain ${domain}`}
                                          title="Remove domain allowance; exact saved session links remain allowed">
                                          <FaTimes size={8} />
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <div className="mt-2 flex gap-1.5">
                            <input
                              autoFocus
                              value={deepFocusHeaderDomainInput}
                              onChange={event => setDeepFocusHeaderDomainInput(event.target.value)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  handleAddHeaderDeepFocusDomain();
                                }
                                if (event.key === 'Escape') {
                                  setIsDeepFocusHeaderPopupOpen(false);
                                }
                              }}
                              placeholder={currentDeepFocusDomain || 'chatgpt.com'}
                              className="min-w-0 flex-1 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none transition focus:border-[var(--color-borderActive)]"
                            />
                            <button
                              type="button"
                              onClick={handleAddHeaderDeepFocusDomain}
                              className="rounded-lg bg-[var(--color-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-textPrimary)] transition hover:bg-[var(--color-accentHover)]">
                              Add
                            </button>
                          </div>
                          {currentDeepFocusDomain && !deepFocusManualDomains.includes(currentDeepFocusDomain) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleAddCurrentDeepFocusDomain();
                                setIsDeepFocusHeaderPopupOpen(false);
                              }}
                              className="mt-2 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--color-textPrimary)] transition hover:bg-[var(--color-selectedBg)]">
                              Add current tab: {currentDeepFocusDomain}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />
          )}

          <div
            className={clsx(
              'flex-1 flex flex-row items-stretch min-h-0 relative overflow-hidden',
              useViewPopoverLayout ? 'gap-2 px-1 pt-0 pb-1' : 'gap-4 px-6 pt-1 pb-4',
            )}>
            <div className="flex-1 min-w-0 flex flex-col h-auto overflow-hidden">
              {sessionNotice && (
                <span className="flex items-center gap-1.5 whitespace-nowrap text-amber-600 dark:text-amber-400 mt-1 text-[12px] font-medium bg-amber-500/10 px-4 py-1 rounded-lg border border-amber-500/25 mx-4">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {sessionNotice}
                </span>
              )}

              {/* Added session links stay visible; all add flows live in SessionAddLinksModal. */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div
                  ref={listContainerRef}
                  className={clsx(
                    'session-widget-hover-scrollbar h-full w-full overflow-y-auto custom-scrollbar',
                    isWidgetMode ? 'min-h-0 max-h-none' : 'min-h-[220px] max-h-[calc(90vh-220px)]',
                  )}>
                  <div className="flex w-full flex-col pb-2">
                    {visibleSelectedLinkEntries.length > 0 ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext
                          items={visibleSelectedLinkEntries.map(({ item, index }) => getSessionReorderKey(item, index))}
                          strategy={verticalListSortingStrategy}>
                          <div className="flex flex-col">
                            {visibleSelectedLinkEntries.map(({ item, index: idx }) => {
                              const itemLabel = (item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
                              const liveTabTitle =
                                item.source === 'tab' ? liveTabTitleByUrl.get(normalizeSessionTabUrl(item.url)) : '';
                              const itemTitle =
                                liveTabTitle ||
                                String(item.title || item.name || '').trim() ||
                                getHostname(item.url) ||
                                itemLabel;

                              return (
                                <SortableSessionItem
                                  key={getSessionReorderKey(item, idx)}
                                  id={getSessionReorderKey(item, idx)}>
                                  {dragProps => (
                                    <div
                                      ref={element => {
                                        tabItemRefs.current[idx] = element;
                                      }}
                                      {...(dragProps?.listeners || {})}
                                      {...(dragProps?.attributes || {})}
                                      onDoubleClick={event => {
                                        event.stopPropagation();
                                        event.preventDefault();
                                        openLinkEditPopup(item);
                                      }}
                                      className={clsx(
                                        'group flex cursor-grab items-center gap-3 px-3 py-2 transition-colors active:cursor-grabbing',
                                        focusedTabIndex === idx
                                          ? 'bg-[var(--color-selectedBg)]'
                                          : 'hover:bg-[var(--color-hoverBg)]',
                                      )}
                                      style={{ willChange: 'transform' }}>
                                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-hoverBg)]">
                                        {renderSessionLinkIcon(item, 18)}
                                      </div>

                                      <span className="min-w-[80px] flex-1 truncate text-[11px] text-[var(--color-textSecondary)]">
                                        {itemLabel}
                                      </span>
                                      <span className="min-w-[120px] flex-1 truncate pr-2 text-left text-[13px] font-medium text-[var(--color-textPrimary)]">
                                        {itemTitle}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={event => {
                                          event.stopPropagation();
                                          event.preventDefault();
                                          removeLink(item.id);
                                        }}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-error)]"
                                        title="Remove link">
                                        <FaTrash size={11} />
                                      </button>
                                    </div>
                                  )}
                                </SortableSessionItem>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      !isWidgetMode && (
                        <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
                          <p className="text-xs font-medium text-[var(--color-textSecondary)]">
                            No tabs or links in this collection yet.
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--color-textMuted)]">
                            Add tabs to launch them all at once when activating this collection.
                          </p>
                        </div>
                      )
                    )}

                    <button
                      ref={element => {
                        tabItemRefs.current[visibleSelectedLinkEntries.length] = element as unknown as HTMLDivElement;
                      }}
                      type="button"
                      onClick={() => setIsAddLinksModalOpen(true)}
                      className={clsx(
                        'group mt-2 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)]',
                        isWidgetMode ? 'min-h-0 w-fit self-center px-2.5 py-1' : 'min-h-10 px-3',
                        focusedTabIndex === visibleSelectedLinkEntries.length && 'bg-[var(--color-selectedBg)]',
                      )}>
                      <FaPlus size={12} className="text-[var(--color-success)]" />
                      <span>{isWidgetMode ? 'Add tabs' : 'Add tabs and links'}</span>
                    </button>
                  </div>
                </div>
                {!isWidgetMode && isEditMode && (
                  <button
                    id="create-another-btn"
                    type="button"
                    onClick={handleCreateNew}
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({
                        top: rect.top + window.scrollY - 46,
                        left: rect.left + window.scrollX - 40,
                      });
                      setShowTooltip(true);
                    }}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none">
                    <span>Create another</span>
                  </button>
                )}
              </div>
            </div>
            {useViewPopoverLayout && visibleSelectedLinkEntries.length > 0 && (
              <div className="relative flex w-[260px] shrink-0 flex-col border-l border-[var(--color-borderDefault)] pl-2">
                <div className="max-h-full overflow-y-auto text-[var(--color-textSecondary)] custom-scrollbar">
                  <SessionSettingsRow
                    title="Focus Mode"
                    badge="New window only"
                    icon={<FiTarget size={14} />}
                    description="Close existing tabs and only allow the session's approved domains."
                    enabled={sessionOpenSettings.focusWindow === true || sessionOpenSettings.deepFocusMode === true}
                    onClick={() => {
                      const nextFocusMode = !(
                        sessionOpenSettings.focusWindow === true || sessionOpenSettings.deepFocusMode === true
                      );
                      hasUserModifiedRef.current = true;
                      updateSessionSettings({
                        focusWindow: nextFocusMode,
                        deepFocusMode: nextFocusMode,
                      });
                    }}
                  />
                  <SessionSettingsRow
                    title="Auto-save session"
                    icon={<FiSave size={14} />}
                    description="Save tab changes automatically."
                    enabled={sessionOpenSettings.autoSaveMode === 'auto_save'}
                    onClick={() => {
                      hasUserModifiedRef.current = true;
                      updateSessionSettings({
                        autoSaveMode: sessionOpenSettings.autoSaveMode === 'auto_save' ? 'dont_save' : 'auto_save',
                      });
                    }}
                    isLast
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Full-Height Sibling Column (Top Edge to Bottom Edge) */}
          {!isWidgetMode && (
            <RightSideItemsPanel<any>
              items={sortedSessions}
              activeItemId={activeSessionId}
              searchQuery={tableSearchQuery}
              onSearchChange={setTableSearchQuery}
              onCloseClick={onClose}
              searchPlaceholder="Search sessions..."
              getItemTitle={s => s.title || (s as any).name || 'Untitled Session'}
              getItemPreview={s => {
                const tabs = s.urls || (s as any).tabs || [];
                return tabs
                  .map((t: any) => t.name || t.title || t.url || '')
                  .filter(Boolean)
                  .join(', ');
              }}
              getItemCompoundId={s =>
                getItemCompoundId({
                  id: s.id,
                  workspace_id: s.workspaceId || null,
                  folder_id: s.folderId || null,
                  snippet: { id: s.id, category: 'session' },
                })
              }
              getItemType={() => 'session'}
              getItemWorkspaceId={s => s.workspaceId || null}
              getItemFolderId={s => s.folderId || null}
              getItemTagIds={s => s.tagIds || []}
              shortcutsMap={{}}
              hotkeysMap={{}}
              workspaceNamesMap={workspaceNamesMap}
              folderNamesMap={folderNamesMap}
              tagNamesMap={tagNamesMap}
              onLoadItem={async id => {
                if (hasUnsavedChanges && (activeSessionId || selectedLinks.length > 0)) {
                  setSessionNotice('Saving current session...');
                  const saved = await executeSave(true);
                  if (!saved && activeSessionId) {
                    setSessionError('Please save your current session before switching.');
                    setSessionNotice(null);
                    return;
                  }
                  setSessionNotice(null);
                }
                setActiveSessionId(id);
                setIsForceCreateNew(false);
              }}
              onDeleteItem={async id => {
                try {
                  await deleteSession(id);
                  const isCurrentItem =
                    id === activeSessionId ||
                    id === (initialSession as any)?.id ||
                    String(id) === String(activeSessionId || '') ||
                    String(id) === String((initialSession as any)?.id || '');

                  if (isCurrentItem) {
                    setActiveSessionId(null);
                    setIsForceCreateNew(true);
                    resetEditor();
                    setTitle('');
                    setSelectedLinks([]);
                    setSessionShortcut('');
                  }
                } catch (err) {
                  console.error('Delete session failed:', err);
                }
              }}
              onOpenerClick={item => {
                const tabItems = item.urls || (item as any).tabs || [];
                const launchLinks = Array.isArray(tabItems)
                  ? tabItems
                      .map((u: any) => (typeof u === 'string' ? { url: u, name: u } : u))
                      .filter((u: any) => Boolean(u?.url))
                  : [];
                const launchUrls = buildSessionLaunchUrls(launchLinks, links);
                void launchSessionSmart({
                  sessionId: item.id,
                  sessionName: item.title || 'Untitled Session',
                  workspaceId: item.workspaceId,
                  folderId: item.folderId,
                  initialUrls: launchUrls.initialUrls,
                  initialNames: launchUrls.initialNames,
                  openUrls: launchUrls.openUrls,
                  openNames: launchUrls.openNames,
                  openSettings: item.sessionOpenSettings,
                  source: 'session_editor',
                  requireAutoSave: false,
                }).then(response => {
                  if (response?.ok === false) return;
                  void handleSessionReferenceLaunchActions(launchLinks, {
                    aiPrompts,
                    chatAgents,
                  });
                });
              }}
              onUpdateShortcut={async (id, val) => {
                await handleUpdateItemField(id, 'shortcut', val);
              }}
              onUpdateTitle={async (id, val) => {
                await handleUpdateItemField(id, 'title', val);
              }}
              onUpdateTags={async (id, tagText) => {
                await handleUpdateItemField(id, 'tags', tagText);
              }}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              addFavorite={addFavorite}
              isExpanded={isRightPanelExpanded}
              onExpandChange={setIsRightPanelExpanded}
              searchInputRef={rightSideSearchInputRef}
              emptyStateMessage="No sessions found"
            />
          )}
        </div>
      </EditorContainer>

      {/* Link Edit Popup */}
      {editingPopupLinkId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-[8px]"
          onClick={closeLinkEditPopup}>
          <div
            style={{
              backgroundColor: 'rgba(23, 24, 33, 0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
            className="rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-5 min-w-[600px] max-w-[90%] text-white"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Edit Link</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Link Name</td>
                  <td className="py-2">
                    <input
                      ref={linkNameInputRef}
                      value={editingLinkName}
                      onChange={e => setEditingLinkName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          urlNameInputRef.current?.focus();
                        }
                      }}
                      placeholder="Enter display name for the link"
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      ref={urlNameInputRef}
                      value={localUrlValue}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/^https?:\/\/(www\.)?/i, '');
                        setLocalUrlValue(cleaned);
                        const parts = parseUrlParts(e.target.value);
                        if (parts) {
                          setEditingUrlParts(parts);
                        }
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          domainInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs truncate"
                    />
                  </td>
                </tr>
                {/* Only show Domain and Path fields if URL is parseable */}
                {editingUrlParts &&
                  (() => {
                    const parts = editingUrlParts;
                    return (
                      <>
                        <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                          <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Domain</td>
                          <td className="py-2 relative">
                            <HighlightedInput
                              ref={domainInputRef}
                              value={parts.domain}
                              onChange={(e: any) =>
                                setEditingUrlParts(prev => (prev ? { ...prev, domain: e.target.value } : prev))
                              }
                              onFocus={() => {
                                setFocusedField('domain');
                                setFocusedPathIndex(null);
                              }}
                              onBlur={(e: any) => {
                                if (e.relatedTarget === dropdownButtonRef.current) return;
                                setTimeout(() => setShowPathQueryDropdown(false), 150);
                              }}
                              onKeyDown={(e: any) => {
                                e.stopPropagation();
                                if (e.key === '@') {
                                  e.preventDefault();
                                  lastFocusedInputRef.current = e.currentTarget;
                                  setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '@' } : prev));
                                  setShowPathQueryDropdown(true);
                                } else if (showPathQueryDropdown) {
                                  setShowPathQueryDropdown(false);
                                }
                              }}
                              className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                            />
                            {showPathQueryDropdown && focusedField === 'domain' && (
                              <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                                <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                                  Add Variable (Click to select)
                                </div>
                                <button
                                  ref={dropdownButtonRef}
                                  type="button"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const newDomain = parts.domain.replace(
                                        /@$/,
                                        parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                      );
                                      setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                      setShowPathQueryDropdown(false);
                                      lastFocusedInputRef.current?.focus();
                                    } else if (e.key === 'Escape') {
                                      setShowPathQueryDropdown(false);
                                      lastFocusedInputRef.current?.focus();
                                    }
                                  }}
                                  onClick={e => {
                                    e.preventDefault();
                                    const newDomain = parts.domain.replace(
                                      /@$/,
                                      parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                    );
                                    setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                                  Insert {'{query}'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {parts.paths.map((path, idx) => (
                          <tr key={idx} className="border-b border-[#eee8d5] dark:border-neutral-700">
                            <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">
                              Path {idx + 1}
                            </td>
                            <td className="py-2 relative">
                              <HighlightedInput
                                value={path}
                                onChange={(e: any) => {
                                  const newPaths = [...parts.paths];
                                  newPaths[idx] = e.target.value;
                                  setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  if (showPathQueryDropdown) {
                                    setShowPathQueryDropdown(false);
                                  }
                                }}
                                onFocus={() => {
                                  setFocusedField('path');
                                  setFocusedPathIndex(idx);
                                }}
                                onBlur={(e: any) => {
                                  if (e.relatedTarget === dropdownButtonRef.current) return;
                                  setTimeout(() => setShowPathQueryDropdown(false), 150);
                                }}
                                onKeyDown={(e: any) => {
                                  e.stopPropagation();
                                  if (e.key === '@') {
                                    e.preventDefault();
                                    lastFocusedInputRef.current = e.currentTarget;
                                    const newPaths = [...parts.paths];
                                    newPaths[idx] = path + '@';
                                    setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                    setShowPathQueryDropdown(true);
                                  } else if (showPathQueryDropdown) {
                                    setShowPathQueryDropdown(false);
                                  } else if (e.key === 'Enter' && !/{query}|\[query\]/i.test(path)) {
                                    e.preventDefault();
                                    const newPaths = [...parts.paths];
                                    newPaths[idx] = path + '{query}';
                                    setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  }
                                }}
                                className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                              />
                              {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                                <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                                  <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                                    Add Variable (Click to select)
                                  </div>
                                  <button
                                    ref={dropdownButtonRef}
                                    type="button"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const newPaths = [...parts.paths];
                                        const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                        newPaths[idx] = path.replace(/@$/, suffix);
                                        setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                        setShowPathQueryDropdown(false);
                                        lastFocusedInputRef.current?.focus();
                                      } else if (e.key === 'Escape') {
                                        setShowPathQueryDropdown(false);
                                        lastFocusedInputRef.current?.focus();
                                      }
                                    }}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      const newPaths = [...parts.paths];
                                      const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                      newPaths[idx] = path.replace(/@$/, suffix);
                                      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                      setShowPathQueryDropdown(false);
                                      lastFocusedInputRef.current?.focus();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                                    Insert {'{query}'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}
              </tbody>
            </table>
            <div className="flex justify-between items-center gap-2 mt-4">
              {editingUrlParts && (
                <button
                  type="button"
                  onClick={insertCustomVariable}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  {'{ }'} Insert Param{' '}
                  <span className="ml-1.5 px-1 rounded border border-[#eee8d5] dark:border-neutral-600 bg-[#fdf6e3] dark:bg-white/5 text-[9px] font-bold text-[#93a1a1] dark:text-neutral-400">
                    @
                  </span>
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-white bg-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteDialogOpen && (
        <DeleteConfirmation
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setSessionToDeleteId(null);
          }}
          onConfirm={async () => {
            if (sessionToDeleteId) {
              try {
                await deleteSession(sessionToDeleteId);
                const isCurrentItem =
                  sessionToDeleteId === activeSessionId ||
                  sessionToDeleteId === (initialSession as any)?.id ||
                  String(sessionToDeleteId) === String(activeSessionId || '') ||
                  String(sessionToDeleteId) === String((initialSession as any)?.id || '');

                if (isCurrentItem) {
                  setActiveSessionId(null);
                  setIsForceCreateNew(true);
                  resetEditor();
                  setTitle('');
                  setSelectedLinks([]);
                  setSessionShortcut('');
                }
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
            setIsDeleteDialogOpen(false);
            setSessionToDeleteId(null);
          }}
          title={
            sessionToDeleteId && sessions.find(s => s.id === sessionToDeleteId)?.title
              ? `Delete "${sessions.find(s => s.id === sessionToDeleteId)?.title}"?`
              : 'Delete this session?'
          }
          description="Are you sure you want to delete this session? This action cannot be undone."
          zIndex={50}
        />
      )}
      <SessionAddLinksModal
        isOpen={isAddLinksModalOpen}
        availableTabs={availableSessionTabs}
        notes={notes}
        links={links}
        snippets={snippets}
        chatAgents={sessionAgents}
        onAddAvailableTab={addItemFromContentBar}
        onAddCustomLink={handleAddCustomLink}
        onAddSessionLinks={handleAddSessionLinks}
        onClose={() => setIsAddLinksModalOpen(false)}
        portalContainer={
          (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
          (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
          (window as any).__ALTS_PORTAL_HOST__ ||
          (window as any).__ALTQ_PORTAL_HOST__ ||
          null
        }
      />
      {conflictModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              Sync Conflict Detected
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
              This Tab Session was modified on another device/window since you opened it. How would you like to resolve
              the conflict?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResolveConflictMerge}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all transform active:scale-95 flex items-center justify-center gap-2">
                Merge Changes (Keep Both)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictOverwrite}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-red-500/35 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-95">
                Overwrite Cloud (Keep Local)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictDiscard}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--color-borderDefault)] bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all transform active:scale-95">
                Reload Cloud Version (Discard Local)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Session Links Portal */}
      {portalTarget &&
        createPortal(
          <div className="flex flex-col gap-1.5 p-3 h-full overflow-y-auto custom-scrollbar">
            {selectedLinks.length > 0 ? (
              selectedLinks.map(link => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 group relative">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md overflow-hidden bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                    {getResolvedLinkFavicon(link) ? (
                      <img src={getResolvedLinkFavicon(link)} className="w-3.5 h-3.5 object-contain" alt="" />
                    ) : (
                      <FaLink size={10} className="text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium tracking-wide truncate flex-1 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                    {link.name || link.url}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <SessionGridIcon size={24} className="text-neutral-400" />
                <span className="text-[11px] font-medium text-neutral-500">No links captured yet</span>
              </div>
            )}
          </div>,
          portalTarget!,
        )}
    </>
  );
};

export default SessionEditorView;

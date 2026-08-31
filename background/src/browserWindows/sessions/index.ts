/**
 * @file sessions.ts
 * @description Manages isolated browsing sessions within the extension.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { nowUtc } from '../../../../src/shared-components/utils';
import { generateEntityId } from '../../../../src/shared-components/utils/idGenerator';
import { db } from '../../../../src/storage/indexDB/dbConfig';
import type { LinkItem } from '../../../../src/allObjectFolder/src/createObject/links/linkTypes';
import {
  DEFAULT_SESSION_SETTINGS,
  normalizeSessionOpenSettings,
} from '../../../../src/allObjectFolder/src/createObject/session/sessionSettings';
import { tabPromptQueues } from '@chatAgents/runtimeExecutionEngine';

export interface SessionOpenSettings {
  openMode: 'same_window' | 'new_window';
  openInNewTab?: boolean;
  autoSaveMode: 'auto_save' | 'dont_save';
  focusWindow?: boolean;
  pinSessionTab?: boolean;
  deepFocusMode?: boolean;
  deepFocusAllowedDomains?: string[];
  deepFocusBlockedDomains?: string[];
}

export interface ActiveSessionEntry {
  sessionId: string;
  sessionName: string;
  windowId: number;
  pinnedTabId: number;
  workspaceId: string;
  folderId: string | null;
  teamId?: string;
  storageMode?: 'local' | 'cloud';
  capturedUrls: string[];
  capturedNames: string[];
  capturedTabIds?: number[];
  snapshotItemsByTabId?: Record<number, LinkItem>;
  createdAt: string;
  initialTabUrls?: Record<number, string>;
  openSettings?: SessionOpenSettings;
  launchSource?:
    | 'session_editor'
    | 'dashboard_view'
    | 'autosave_tracking'
    | 'hotkey'
    | 'shortcut'
    | 'omnibox'
    | 'url_trigger'
    | 'favorite'
    | 'board'
    | 'search'
    | 'todo'
    | 'website';
}

export const activeSessions = new Map<number, ActiveSessionEntry>();
const deepFocusOverlayOperationByTab = new Map<number, Promise<boolean>>();
const ENABLE_SESSION_FLOW_LOGS = false;
const sessionLaunchTrace = (...args: any[]) => console.log('[SessionLaunchTrace]', ...args);
const SESSION_REFERENCE_TYPES = new Set(['note', 'link', 'snippet', 'agent']);
const pendingSessionReferenceHandoffs = new Map<number, any>();
const sessionControlPorts = new Map<number, chrome.runtime.Port>();

export function registerSessionControlPort(tabId: number, port: chrome.runtime.Port): void {
  sessionLaunchTrace('control port connected', { tabId, portName: port.name });
  sessionControlPorts.set(tabId, port);
  const pendingMessage = pendingSessionReferenceHandoffs.get(tabId);
  if (pendingMessage) {
    sessionLaunchTrace('sending queued references through control port', {
      tabId,
      sessionId: pendingMessage.sessionId,
      itemCount: pendingMessage.items?.length || 0,
    });
    pendingSessionReferenceHandoffs.delete(tabId);
    port.postMessage(pendingMessage);
  }
  port.onDisconnect.addListener(() => {
    sessionLaunchTrace('control port disconnected', { tabId });
    if (sessionControlPorts.get(tabId) === port) sessionControlPorts.delete(tabId);
  });
}

const getSessionReferenceType = (url?: string): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'chrome-extension://session-reference/');
    const type = parsed.searchParams.get('type');
    const id =
      parsed.searchParams.get('id') ||
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('noteid') ||
      parsed.searchParams.get('linkid') ||
      parsed.searchParams.get('snippetid') ||
      parsed.searchParams.get('agentid');
    return type && id && SESSION_REFERENCE_TYPES.has(type) ? type : null;
  } catch {
    return null;
  }
};

const isSessionReferenceUrl = (url?: string): boolean => Boolean(getSessionReferenceType(url));

const isOpenableSessionTabUrl = (url?: string): boolean => {
  if (!url) return false;
  const referenceType = getSessionReferenceType(url);
  if (referenceType) return referenceType === 'note' || referenceType === 'snippet';
  return url.startsWith('http') || url.startsWith('chrome-extension');
};

type ActiveDashboardViewSessionEntry = {
  viewId: string | null;
  sessionId: string | null;
};
const activeDashboardViewSessionsByWindow = new Map<number, ActiveDashboardViewSessionEntry>();

const sessionFlowDebug = (...args: any[]) => {
  if (!ENABLE_SESSION_FLOW_LOGS) return;
  console.log(...args);
};

const sessionFlowWarn = (...args: any[]) => {
  if (!ENABLE_SESSION_FLOW_LOGS) return;
  console.warn(...args);
};

function createTabsInOrder(
  urls: string[],
  baseCreateProperties: Omit<chrome.tabs.CreateProperties, 'url'>,
  onCreated: (tab: chrome.tabs.Tab, url: string, index: number) => void,
  onComplete: () => void,
  shouldContinue: () => boolean = () => true,
) {
  let index = 0;
  let completed = false;

  const completeOnce = () => {
    if (completed) return;
    completed = true;
    onComplete();
  };

  const createNext = () => {
    if (!shouldContinue() || index >= urls.length) {
      completeOnce();
      return;
    }

    const url = urls[index];
    sessionLaunchTrace('creating session tab', { index, url, windowId: baseCreateProperties.windowId });
    chrome.tabs.create({ ...baseCreateProperties, url }, createdTab => {
      if (!shouldContinue()) {
        if (typeof createdTab?.id === 'number') {
          chrome.tabs.remove(createdTab.id).catch(() => {});
        }
        completeOnce();
        return;
      }
      if (createdTab) {
        sessionLaunchTrace('session tab created', {
          index,
          tabId: createdTab.id,
          windowId: createdTab.windowId,
          url,
          pinned: createdTab.pinned,
        });
        onCreated(createdTab, url, index);
      }
      index += 1;
      createNext();
    });
  };

  createNext();
}

type DeepFocusBlockPayload = {
  sessionId: string;
  sessionName: string;
  blockedUrl: string;
  blockedDomain: string;
  restrictedWindowBlock?: boolean;
};

function normalizeDeepFocusDomain(value?: string): string {
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
}

function getUrlHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase().trim();
  } catch {
    return '';
  }
}

function normalizeDeepFocusUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function isDeepFocusIgnoredUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url === 'chrome://newtab/'
  );
}

function getDeepFocusAutoAllowedDomains(session: ActiveSessionEntry): string[] {
  const blockedDomains = new Set(
    (session.openSettings?.deepFocusBlockedDomains || []).map(domain => normalizeDeepFocusDomain(domain)).filter(Boolean),
  );
  const domains = (session.capturedUrls || [])
    .map(url => getUrlHostname(url))
    .filter(domain => domain && !blockedDomains.has(domain));
  return Array.from(new Set(domains));
}

function getDeepFocusManualAllowedDomains(session: ActiveSessionEntry): string[] {
  return Array.from(
    new Set((session.openSettings?.deepFocusAllowedDomains || []).map(domain => normalizeDeepFocusDomain(domain)).filter(Boolean)),
  );
}

function isDeepFocusExactSessionUrlAllowed(session: ActiveSessionEntry, url: string): boolean {
  const normalizedUrl = normalizeDeepFocusUrl(url);
  if (!normalizedUrl) return false;
  return (session.capturedUrls || []).some(capturedUrl => normalizeDeepFocusUrl(capturedUrl) === normalizedUrl);
}

function isDeepFocusCapturedUrlAllowed(session: ActiveSessionEntry, url: string, hostname: string): boolean {
  const isBlocked = (session.openSettings?.deepFocusBlockedDomains || []).some(
    domain => normalizeDeepFocusDomain(domain) === hostname,
  );
  if (isBlocked) return false;
  return isDeepFocusExactSessionUrlAllowed(session, url) || getDeepFocusAutoAllowedDomains(session).includes(hostname);
}

export function isTabAllowedByActiveDeepFocus(windowId: number, url?: string): boolean {
  if (!url) return false;
  const windowSession = activeSessions.get(windowId);
  if (windowSession?.openSettings?.deepFocusMode !== true) return true;

  const hostname = getUrlHostname(url);
  return Boolean(hostname) && isDeepFocusCapturedUrlAllowed(windowSession, url, hostname);
}

function isSessionRealTabUrl(url?: string): url is string {
  return Boolean(url) && !isDeepFocusIgnoredUrl(url);
}

function isLegacyInternalNoteEditorUrl(url?: string): boolean {
  if (!url?.startsWith(chrome.runtime.getURL(''))) return false;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('open_note') === 'true' && Boolean(parsed.searchParams.get('noteid'));
  } catch {
    return false;
  }
}

export function isTrackableSessionAutosaveUrl(windowId: number, url?: string): url is string {
  const referenceType = getSessionReferenceType(url);
  if (referenceType === 'note' || referenceType === 'snippet') return true;
  if (isLegacyInternalNoteEditorUrl(url)) return true;
  return isSessionRealTabUrl(url) && isTabAllowedByActiveDeepFocus(windowId, url);
}

export function getTrackableSessionAutosaveTabUrl(
  windowId: number,
  tab: Pick<chrome.tabs.Tab, 'url' | 'pendingUrl'>,
): string {
  const pendingUrl = tab.pendingUrl;
  if (isTrackableSessionAutosaveUrl(windowId, pendingUrl)) return pendingUrl;
  const currentUrl = tab.url;
  return isTrackableSessionAutosaveUrl(windowId, currentUrl) ? currentUrl : '';
}

async function syncCurrentWindowTabsIntoActiveSession(windowId: number): Promise<boolean> {
  const session = await getValidatedActiveSessionForWindow(windowId);
  if (!session) return false;

  const tabs = await chrome.tabs.query({ windowId }).catch(() => []);
  const currentSession = await getValidatedActiveSessionForWindow(windowId);
  if (!currentSession || currentSession.sessionId !== session.sessionId) return false;
  const trackableTabs = tabs
    .filter(tab => tab.id !== currentSession.pinnedTabId)
    .map(tab => ({ tab, url: getTrackableSessionAutosaveTabUrl(windowId, tab) }))
    .filter((entry): entry is { tab: chrome.tabs.Tab; url: string } => Boolean(entry.url));

  if (trackableTabs.length === 0) {
    return false;
  }

  activeSessions.set(windowId, {
    ...currentSession,
    capturedUrls: trackableTabs.map(entry => entry.url),
    capturedNames: trackableTabs.map(entry => entry.tab.title || getUrlHostname(entry.url) || entry.url),
    capturedTabIds: trackableTabs.map(entry => entry.tab.id ?? -1),
  });
  return true;
}

async function restoreConfiguredUrlsIntoActiveSession(
  windowId: number,
  validationOptions: { refreshFocus?: boolean } = {},
): Promise<void> {
  const session = await getValidatedActiveSessionForWindow(windowId, validationOptions);
  if (!session) return;

  const sessionRecord = await db.sessions.get(session.sessionId).catch(() => undefined);
  if (!sessionRecord) return;
  const currentSession = await getValidatedActiveSessionForWindow(windowId, validationOptions);
  if (!currentSession || currentSession.sessionId !== session.sessionId) return;

  const configuredUrls = (sessionRecord.urls || []).filter(link => Boolean(link.url));
  activeSessions.set(windowId, {
    ...currentSession,
    capturedUrls: configuredUrls.map(link => link.url),
    capturedNames: configuredUrls.map(link => link.title || link.name || link.url),
  });
}

function normalizeSessionLaunchUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

async function openMissingConfiguredSessionTabs(windowId: number): Promise<number> {
  const session = await getValidatedActiveSessionForWindow(windowId);
  if (!session) return 0;

  const sessionRecord = await db.sessions.get(session.sessionId).catch(() => undefined);
  if (!sessionRecord) return 0;

  const tabs = await chrome.tabs.query({ windowId }).catch(() => []);
  const existingUrlCounts = new Map<string, number>();
  tabs.forEach(tab => {
    if (tab.id === session.pinnedTabId) return;
    const url = tab.pendingUrl || tab.url || '';
    if (!url) return;
    const key = normalizeSessionLaunchUrl(url);
    existingUrlCounts.set(key, (existingUrlCounts.get(key) || 0) + 1);
  });

  const missingUrls: string[] = [];
  (sessionRecord.urls || []).forEach(item => {
    if (!isOpenableSessionTabUrl(item.url)) return;
    const key = normalizeSessionLaunchUrl(item.url);
    const existingCount = existingUrlCounts.get(key) || 0;
    if (existingCount > 0) {
      existingUrlCounts.set(key, existingCount - 1);
      return;
    }
    missingUrls.push(item.url);
  });

  if (missingUrls.length === 0) return 0;

  const currentSession = await getValidatedActiveSessionForWindow(windowId);
  if (!currentSession || currentSession.sessionId !== session.sessionId) return 0;

  await new Promise<void>(resolve => {
    createTabsInOrder(
      missingUrls,
      { windowId, active: false },
      (createdTab, url) => {
        if (!createdTab.id) return;
        const currentSession = activeSessions.get(windowId);
        if (!currentSession) return;
        currentSession.initialTabUrls[createdTab.id] = url;
        activeSessions.set(windowId, currentSession);
      },
      resolve,
      () => activeSessions.get(windowId)?.sessionId === currentSession.sessionId,
    );
  });

  sessionLaunchTrace('autosave transition opened missing configured tabs', {
    sessionId: session.sessionId,
    windowId,
    openedCount: missingUrls.length,
    urls: missingUrls,
  });
  return missingUrls.length;
}

function getSessionAgentProviderMatchKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return 'provider:chatgpt';
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return 'provider:claude';
    if (host === 'gemini.google.com') return 'provider:gemini';
    if (host === 'perplexity.ai' || host.endsWith('.perplexity.ai')) return 'provider:perplexity';
    if (host === 'mistral.ai' || host.endsWith('.mistral.ai')) return 'provider:mistral';
    if (host === 'copilot.microsoft.com') return 'provider:copilot';
    return `origin:${parsed.origin}`;
  } catch {
    return `url:${normalizeSessionLaunchUrl(url)}`;
  }
}

function getDeepFocusBlockedUrl(session: ActiveSessionEntry, blockedUrl: string, restrictedWindowBlock = false): string {
  const params = new URLSearchParams({
    blocked_session: 'true',
    session_id: session.sessionId,
    session_name: session.sessionName || 'Tab Session',
    blocked_url: blockedUrl,
    blocked_domain: getUrlHostname(blockedUrl),
  });
  if (restrictedWindowBlock) {
    params.set('restricted_window_block', 'true');
  }
  return chrome.runtime.getURL(`AltS_search_newtab/index.html?${params.toString()}`);
}

function canShowDeepFocusOverlayInPage(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function injectDeepFocusBlockedOverlay(payload: DeepFocusBlockPayload) {
  const overlayId = 'tasklabs-deep-focus-blocked-overlay';
  const windowWithGuard = window as typeof window & {
    __tasklabsDeepFocusGuardObserver?: MutationObserver | null;
    __tasklabsDeepFocusStopTimer?: number | null;
    __tasklabsDeepFocusOverlayGeneration?: number;
  };
  const overlayGeneration = (windowWithGuard.__tasklabsDeepFocusOverlayGeneration ?? 0) + 1;
  windowWithGuard.__tasklabsDeepFocusOverlayGeneration = overlayGeneration;
  let blockerPrepared = false;
  const ensureBlockerBody = () => {
    if (!document.body) {
      const body = document.createElement('body');
      document.documentElement.appendChild(body);
    }
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
    document.body.style.background = 'var(--color-modalBg, var(--color-rootBg, #101014))';
    return document.body;
  };
  const pausePageMedia = () => {
    document.querySelectorAll('video,audio').forEach(media => {
      try {
        (media as HTMLMediaElement).pause();
      } catch {
        // Some sites expose media elements whose playback state cannot be changed.
      }
    });
  };

  const prepareBlockedPage = () => {
    if (blockerPrepared || windowWithGuard.__tasklabsDeepFocusOverlayGeneration !== overlayGeneration) return;
    windowWithGuard.__tasklabsDeepFocusGuardObserver?.disconnect();
    if (
      windowWithGuard.__tasklabsDeepFocusStopTimer !== null &&
      windowWithGuard.__tasklabsDeepFocusStopTimer !== undefined
    ) {
      window.clearInterval(windowWithGuard.__tasklabsDeepFocusStopTimer);
    }
    document.getElementById(overlayId)?.remove();
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.background = 'var(--color-modalBg, var(--color-rootBg, #101014))';
    pausePageMedia();
    blockerPrepared = true;
  };

  const keepOnlyOverlay = (overlayElement: HTMLDivElement) => {
    pausePageMedia();
    const body = ensureBlockerBody();

    if (!body.contains(overlayElement)) {
      body.appendChild(overlayElement);
    }
  };

  const guardBlockedPage = (overlayElement: HTMLDivElement) => {
    let guardRunning = false;
    const runGuard = () => {
      if (windowWithGuard.__tasklabsDeepFocusOverlayGeneration !== overlayGeneration) {
        observer.disconnect();
        return;
      }
      if (guardRunning) return;
      guardRunning = true;
      try {
        keepOnlyOverlay(overlayElement);
      } finally {
        guardRunning = false;
      }
    };
    const observer = new MutationObserver(runGuard);
    observer.observe(document.documentElement, { childList: true });
    if (document.body) observer.observe(document.body, { childList: true, subtree: false });
    windowWithGuard.__tasklabsDeepFocusGuardObserver = observer;
    const stopTimer = window.setInterval(() => {
      if (windowWithGuard.__tasklabsDeepFocusOverlayGeneration !== overlayGeneration) {
        window.clearInterval(stopTimer);
        return;
      }
      pausePageMedia();
    }, 300);
    windowWithGuard.__tasklabsDeepFocusStopTimer = stopTimer;
    window.setTimeout(() => {
      if (windowWithGuard.__tasklabsDeepFocusStopTimer === stopTimer) {
        window.clearInterval(stopTimer);
        windowWithGuard.__tasklabsDeepFocusStopTimer = null;
      }
    }, 8000);
  };

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    minHeight: '100vh',
    width: '100vw',
    background: 'var(--color-rootBg, #ffffff)',
    color: 'var(--color-textPrimary, #08090d)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-family, var(--font-sans, inherit))',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    margin: '0 0 16px',
    padding: '0',
    width: '100%',
    borderBottom: 'none',
    boxSizing: 'border-box',
    background: 'transparent',
  });

  const brand = document.createElement('div');
  Object.assign(brand.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '0',
    color: 'var(--color-textPrimary, #08090d)',
    fontSize: '18px',
    fontWeight: '800',
    fontFamily: 'var(--font-comfortaa, Comfortaa, Inter, ui-sans-serif, system-ui, sans-serif)',
  });
  const brandIcon = document.createElement('img');
  brandIcon.src = chrome.runtime.getURL('content/cmdOS_logo.png');
  brandIcon.alt = 'cmdOS';
  Object.assign(brandIcon.style, {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    objectFit: 'contain',
    display: 'block',
    flex: '0 0 auto',
  });
  const brandText = document.createElement('span');
  brandText.textContent = 'cmdOS';
  brand.append(brandIcon, brandText);

  const headerPill = document.createElement('div');
  Object.assign(headerPill.style, {
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    whiteSpace: 'nowrap',
    borderRadius: '10px',
    border: '0',
    background: 'color-mix(in srgb, var(--color-accent, #5b2cff) 5%, var(--color-rootBg, #ffffff))',
    color: 'var(--color-accent, #5b2cff)',
    fontSize: '13px',
    fontWeight: '700',
    boxShadow: '0 10px 24px rgba(76, 44, 201, 0.07)',
  });
  const headerFocusIcon = document.createElement('span');
  headerFocusIcon.textContent = '◎';
  Object.assign(headerFocusIcon.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    lineHeight: '1',
  });
  headerPill.append(headerFocusIcon, document.createTextNode('Deep Focus mode'), document.createTextNode('•'), document.createTextNode('ON'));
  header.append(brand, headerPill);

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '100%',
    maxWidth: '520px',
    margin: '0 auto',
    padding: '20px',
    border: '1px solid var(--color-borderDefault, #e7eaf2)',
    borderRadius: '18px',
    background: 'var(--color-cardBg, #ffffff)',
    boxShadow: '0 18px 54px rgba(20, 31, 56, 0.14)',
    boxSizing: 'border-box',
    textAlign: 'center',
  });

  const statusId = `${overlayId}-status`;
  const status = document.createElement('div');
  status.id = statusId;
  Object.assign(status.style, {
    display: 'none',
    marginTop: '12px',
    border: '1px solid var(--color-borderDefault, #e7eaf2)',
    borderRadius: '12px',
    background: 'var(--color-hoverBg, #f6f7fb)',
    padding: '8px 10px',
    color: 'var(--color-textSecondary, #46536d)',
    fontSize: '12px',
    fontWeight: '700',
  });

  const setStatus = (text: string) => {
    status.textContent = text;
    status.style.display = text ? 'block' : 'none';
  };
  const sendAction = (action: string, extra: Record<string, unknown> = {}) => {
    setStatus('');
    chrome.runtime.sendMessage({ action, sessionId: payload.sessionId, ...extra }, response => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message || 'Action failed.');
        return;
      }
      if (!response?.ok) {
        setStatus(response?.error || 'Action failed.');
        return;
      }
      if (action === 'deep_focus_turn_off') {
        overlay.remove();
        document.documentElement.style.removeProperty('overflow');
        return;
      }
      if (action === 'deep_focus_add_allowed_domain') {
        setStatus(`${response.domain || payload.blockedDomain || 'Domain'} added.`);
        setTimeout(() => {
          overlay.remove();
          document.documentElement.style.removeProperty('overflow');
        }, 450);
      }
    });
  };

  const label = document.createElement('div');
  label.textContent = '−';
  Object.assign(label.style, {
    width: '50px',
    height: '50px',
    margin: '0 auto',
    border: '2px solid var(--color-error, #ef171e)',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-error, #ef171e)',
    fontSize: '32px',
    fontWeight: '500',
    lineHeight: '1',
    boxSizing: 'border-box',
  });

  const title = document.createElement('h1');
  title.textContent = 'Site blocked';
  Object.assign(title.style, {
    margin: '18px 0 0',
    color: 'var(--color-textPrimary, #08090d)',
    fontSize: '29px',
    lineHeight: '36px',
    fontWeight: '850',
    letterSpacing: '0',
  });

  const description = document.createElement('p');
  description.textContent = payload.restrictedWindowBlock
    ? 'This window does not have a running Deep Focus session.'
    : 'Deep Focus mode is active.';
  Object.assign(description.style, {
    margin: '8px 0 0',
    color: 'var(--color-textSecondary, #46536d)',
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: '500',
  });

  const details = document.createElement('div');
  Object.assign(details.style, {
    margin: '20px auto 18px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '11px',
    border: '1px solid color-mix(in srgb, var(--color-error, #ef171e) 8%, var(--color-borderDefault, #f1d8dc))',
    background: 'color-mix(in srgb, var(--color-error, #ef171e) 5%, var(--color-rootBg, #ffffff))',
    boxShadow: '0 8px 20px rgba(239, 23, 30, 0.05)',
  });

  const domainLabel = document.createElement('div');
  domainLabel.textContent = '◎';
  Object.assign(domainLabel.style, {
    color: 'var(--color-error, #d70710)',
    fontSize: '20px',
    fontWeight: '800',
    lineHeight: '1',
  });

  const domainValue = document.createElement('div');
  domainValue.textContent = payload.blockedDomain || 'Unknown domain';
  Object.assign(domainValue.style, {
    color: 'color-mix(in srgb, var(--color-error, #d70710) 86%, var(--color-textPrimary, #08090d))',
    fontSize: '18px',
    fontWeight: '800',
    overflowWrap: 'anywhere',
  });

  const urlLabel = domainLabel.cloneNode(false) as HTMLDivElement;
  urlLabel.textContent = 'Blocked URL';
  urlLabel.style.marginTop = '14px';

  const urlValue = document.createElement('div');
  urlValue.textContent = payload.blockedUrl || 'Unknown URL';
  Object.assign(urlValue.style, {
    marginTop: '4px',
    color: 'var(--color-textSecondary, #d4d4d4)',
    fontSize: '12px',
    lineHeight: '18px',
    overflowWrap: 'anywhere',
  });
  details.append(domainLabel, domainValue);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    marginTop: '12px',
    display: 'grid',
    gap: '10px',
  });

  const createButton = (text: string, variant: 'primary' | 'outline' | 'neutral') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    Object.assign(button.style, {
      minHeight: '48px',
      borderRadius: '12px',
      padding: '11px 14px',
      fontSize: '13px',
      fontWeight: '800',
      cursor: 'pointer',
      border: '1px solid var(--color-borderDefault, #e7eaf2)',
      background: 'var(--color-cardBg, #ffffff)',
      color: variant === 'primary' ? 'var(--color-accent, #5b2cff)' : 'var(--color-textPrimary, #08090d)',
      boxShadow: '0 10px 28px rgba(20, 31, 56, 0.08)',
      textAlign: 'left',
    });
    return button;
  };

  const pinnedButton = createButton('Open PIN tab settings  ↗', 'primary');
  pinnedButton.addEventListener('click', () => sendAction('deep_focus_focus_pinned_tab'));

  actions.append(pinnedButton);

  if (!payload.restrictedWindowBlock) {
    const addDomainButton = createButton('Allow this domain  +', 'outline');
    addDomainButton.addEventListener('click', () => {
      sendAction('deep_focus_add_allowed_domain', {
        domain: payload.blockedDomain,
        url: payload.blockedUrl,
      });
    });

    const turnOffButton = createButton('Deep Focus mode  ON', 'neutral');
    turnOffButton.addEventListener('click', () => sendAction('deep_focus_turn_off'));
    actions.append(addDomainButton, turnOffButton);
  }
  const footer = document.createElement('div');
  footer.textContent = 'Life is short. Stay focused on what truly matters.';
  Object.assign(footer.style, {
    margin: '16px auto 0',
    paddingTop: '14px',
    borderTop: '1px solid var(--color-borderDefault, #e7eaf2)',
    color: 'var(--color-textSecondary, #46536d)',
    fontSize: '12px',
    lineHeight: '17px',
    fontWeight: '500',
  });

  card.append(header, label, title, description, details, actions, status, footer);
  overlay.appendChild(card);
  const mountOverlay = () => {
    if (windowWithGuard.__tasklabsDeepFocusOverlayGeneration !== overlayGeneration) return;
    prepareBlockedPage();
    const existingOverlay = document.getElementById(overlayId);
    if (existingOverlay === overlay && document.body?.contains(overlay)) return;
    if (existingOverlay && existingOverlay !== overlay) existingOverlay.remove();
    keepOnlyOverlay(overlay);
    guardBlockedPage(overlay);
  };

  if (document.body) {
    mountOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', mountOverlay, { once: true });
    setTimeout(mountOverlay, 50);
  }

  let mountAttempts = 0;
  const retryMount = window.setInterval(() => {
    mountAttempts++;
    if (windowWithGuard.__tasklabsDeepFocusOverlayGeneration !== overlayGeneration) {
      window.clearInterval(retryMount);
      return;
    }
    if (!document.body?.contains(overlay)) {
      mountOverlay();
    }
    if (document.body?.contains(overlay) || mountAttempts >= 30) {
      window.clearInterval(retryMount);
    }
  }, 100);
}

function removeDeepFocusBlockedOverlay() {
  const guardedWindow = window as typeof window & {
    __tasklabsDeepFocusGuardObserver?: MutationObserver | null;
    __tasklabsDeepFocusStopTimer?: number | null;
    __tasklabsDeepFocusOverlayGeneration?: number;
  };
  guardedWindow.__tasklabsDeepFocusOverlayGeneration = (guardedWindow.__tasklabsDeepFocusOverlayGeneration ?? 0) + 1;
  guardedWindow.__tasklabsDeepFocusGuardObserver?.disconnect();
  guardedWindow.__tasklabsDeepFocusGuardObserver = null;
  if (
    guardedWindow.__tasklabsDeepFocusStopTimer !== null &&
    guardedWindow.__tasklabsDeepFocusStopTimer !== undefined
  ) {
    window.clearInterval(guardedWindow.__tasklabsDeepFocusStopTimer);
    guardedWindow.__tasklabsDeepFocusStopTimer = null;
  }
  document.getElementById('tasklabs-deep-focus-blocked-overlay')?.remove();
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('background');
  document.body?.style.removeProperty('margin');
  document.body?.style.removeProperty('min-height');
  document.body?.style.removeProperty('background');
}

async function showDeepFocusOverlayInPage(tabId: number, payload: DeepFocusBlockPayload): Promise<boolean> {
  if (!canShowDeepFocusOverlayInPage(payload.blockedUrl)) return false;

  const previousInjection = deepFocusOverlayOperationByTab.get(tabId) ?? Promise.resolve(false);
  const currentInjection = previousInjection
    .catch(() => false)
    .then(
      () =>
        new Promise<boolean>(resolve => {
          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: injectDeepFocusBlockedOverlay,
              args: [payload],
            },
            () => {
              resolve(!chrome.runtime.lastError);
            },
          );
        }),
    );
  deepFocusOverlayOperationByTab.set(tabId, currentInjection);

  try {
    return await currentInjection;
  } finally {
    if (deepFocusOverlayOperationByTab.get(tabId) === currentInjection) {
      deepFocusOverlayOperationByTab.delete(tabId);
    }
  }
}

async function hideDeepFocusOverlayInPage(tabId: number): Promise<void> {
  const previousInjection = deepFocusOverlayOperationByTab.get(tabId) ?? Promise.resolve(false);
  const currentInjection = previousInjection
    .catch(() => false)
    .then(async () => {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: removeDeepFocusBlockedOverlay,
      }).catch(() => {});
      return false;
    });
  deepFocusOverlayOperationByTab.set(tabId, currentInjection);

  try {
    await currentInjection;
  } finally {
    if (deepFocusOverlayOperationByTab.get(tabId) === currentInjection) {
      deepFocusOverlayOperationByTab.delete(tabId);
    }
  }
}

async function getTabsForDeepFocusRefresh(previousSessionId?: string | null): Promise<chrome.tabs.Tab[]> {
  const hasActiveDeepFocus = Array.from(activeSessions.values()).some(
    session => session.openSettings?.deepFocusMode === true,
  );
  if (hasActiveDeepFocus || previousSessionId) {
    return chrome.tabs.query({}).catch(() => []);
  }

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTabs;
}

export async function refreshDeepFocusForRelevantTabs(previousSessionId?: string | null) {
  try {
    const tabs = await getTabsForDeepFocusRefresh(previousSessionId);
    for (const tab of tabs) {
      if (!tab.id) continue;
      const url = tab.url || tab.pendingUrl || '';
      if (!canShowDeepFocusOverlayInPage(url)) continue;
      await hideDeepFocusOverlayInPage(tab.id);
      await handleDeepFocusNavigation(tab.id, url);
    }
  } catch (error) {
    console.error('[DeepFocus] Failed to refresh open tabs:', error);
  }
}

async function getTabWindowId(tabId: number): Promise<number | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return typeof tab?.windowId === 'number' ? tab.windowId : null;
  } catch {
    return null;
  }
}

async function getExtensionControlTabIdForWindow(windowId: number): Promise<number | null> {
  try {
    const extensionNewTabBase = chrome.runtime.getURL('AltS_search_newtab/');
    const tabs = await chrome.tabs.query({ windowId });
    const controlTabs = tabs.filter(tab => {
      const url = tab.url || tab.pendingUrl || '';
      return (
        typeof tab.id === 'number' &&
        (url.startsWith(extensionNewTabBase) ||
          url.startsWith('chrome://newtab') ||
          url.startsWith('chrome://new-tab-page'))
      );
    });
    const controlTab = controlTabs.find(tab => tab.pinned) || controlTabs.find(tab => tab.active) || controlTabs[0];
    return typeof controlTab?.id === 'number' ? controlTab.id : null;
  } catch {
    return null;
  }
}

function moveActiveSessionToWindow(
  storedWindowId: number,
  session: ActiveSessionEntry,
  windowId: number,
  pinnedTabId: number,
): ActiveSessionEntry {
  const repairedSession: ActiveSessionEntry = {
    ...session,
    windowId,
    pinnedTabId,
  };
  activeSessions.delete(storedWindowId);
  activeSessions.set(windowId, repairedSession);

  const dashboardSession = activeDashboardViewSessionsByWindow.get(storedWindowId);
  if (dashboardSession?.sessionId === repairedSession.sessionId) {
    activeDashboardViewSessionsByWindow.delete(storedWindowId);
    activeDashboardViewSessionsByWindow.set(windowId, dashboardSession);
  }

  persistActiveSessions();
  return repairedSession;
}

async function resolveActiveSessionForWindow(windowId: number): Promise<ActiveSessionEntry | null> {
  const directSession = activeSessions.get(windowId);
  if (directSession) return directSession;

  for (const [storedWindowId, session] of activeSessions.entries()) {
    if (!session.pinnedTabId || session.pinnedTabId < 0) continue;

    try {
      const pinnedTab = await chrome.tabs.get(session.pinnedTabId);
      if (pinnedTab.windowId !== windowId) continue;

      const repairedSession = moveActiveSessionToWindow(storedWindowId, session, windowId, session.pinnedTabId);
      sessionFlowDebug('[DeepFocus] repaired active session window ownership', {
        sessionId: repairedSession.sessionId,
        storedWindowId,
        actualWindowId: windowId,
        pinnedTabId: repairedSession.pinnedTabId,
      });
      return repairedSession;
    } catch {
      // Ignore stale pinned tab ids here; normal tab-close cleanup owns deletion.
    }
  }

  return null;
}

export async function stopActiveSessionRuntimeForWindow(
  windowId: number,
  reason: string,
  options: { refreshFocus?: boolean } = {},
): Promise<ActiveSessionEntry | null> {
  const session = activeSessions.get(windowId);
  if (!session) return null;

  activeSessions.delete(windowId);
  activeDashboardViewSessionsByWindow.delete(windowId);
  pendingSessionReferenceHandoffs.delete(session.pinnedTabId);
  Object.keys(session.snapshotItemsByTabId || {}).forEach(tabId => {
    tabPromptQueues.delete(Number(tabId));
  });
  persistActiveSessions();
  await saveSessionToDb(session);
  if (options.refreshFocus !== false) {
    await refreshDeepFocusForRelevantTabs(session.sessionId);
  }
  sessionFlowDebug('[SessionFlow][background] stopped active session runtime', {
    windowId,
    sessionId: session.sessionId,
    pinnedTabId: session.pinnedTabId,
    reason,
  });
  return session;
}

export async function getValidatedActiveSessionForWindow(
  windowId: number,
  options: { refreshFocus?: boolean } = {},
): Promise<ActiveSessionEntry | null> {
  const session = await resolveActiveSessionForWindow(windowId);
  if (!session) return null;

  const controlTab = session.pinnedTabId > 0
    ? await chrome.tabs.get(session.pinnedTabId).catch(() => null)
    : null;
  if (controlTab && controlTab.windowId !== windowId) {
    if (controlTab.pinned === true) {
      const destinationSession = activeSessions.get(controlTab.windowId);
      if (destinationSession && destinationSession.sessionId !== session.sessionId) {
        await stopActiveSessionRuntimeForWindow(windowId, 'control_tab_moved_to_occupied_window', options);
      } else {
        moveActiveSessionToWindow(windowId, session, controlTab.windowId, session.pinnedTabId);
      }
    } else {
      await stopActiveSessionRuntimeForWindow(windowId, 'control_tab_moved_unpinned', options);
    }
    return null;
  }

  const hasValidControlTab = Boolean(controlTab?.pinned === true);
  if (hasValidControlTab) return session;

  await stopActiveSessionRuntimeForWindow(
    windowId,
    controlTab ? 'control_tab_unpinned' : 'control_tab_missing',
    options,
  );
  sessionFlowDebug('[SessionFlow][background] removed stale active session status', {
    windowId,
    sessionId: session.sessionId,
    pinnedTabId: session.pinnedTabId,
    controlTabExists: Boolean(controlTab),
    controlTabPinned: controlTab?.pinned ?? null,
  });
  return null;
}

async function getDeepFocusBlockPayload(tabId: number, url?: string): Promise<DeepFocusBlockPayload | null> {
  await activeSessionsRestorePromise;
  if (!url || isDeepFocusIgnoredUrl(url)) return null;

  const windowId = await getTabWindowId(tabId);
  if (typeof windowId !== 'number') return null;

  const hostname = getUrlHostname(url);
  if (!hostname) return null;

  const windowSession = await getValidatedActiveSessionForWindow(windowId);
  if (windowSession?.openSettings?.deepFocusMode !== true) return null;
  if (windowSession.pinnedTabId === tabId) return null;
  if (isDeepFocusCapturedUrlAllowed(windowSession, url, hostname)) return null;
  if (getDeepFocusManualAllowedDomains(windowSession).includes(hostname)) {
    return null;
  }

  return {
    sessionId: windowSession.sessionId,
    sessionName: windowSession.sessionName || 'Tab Session',
    blockedUrl: url,
    blockedDomain: hostname,
    restrictedWindowBlock: false,
  };
}

export async function handleDeepFocusNavigation(tabId: number, url?: string): Promise<boolean> {
  const blockPayload = await getDeepFocusBlockPayload(tabId, url);
  if (!blockPayload) return false;

  if (canShowDeepFocusOverlayInPage(blockPayload.blockedUrl)) {
    await showDeepFocusOverlayInPage(tabId, blockPayload);
    return true;
  }

  const windowId = await getTabWindowId(tabId);
  const blockingSession = typeof windowId === 'number'
    ? await getValidatedActiveSessionForWindow(windowId)
    : null;
  if (!blockingSession || blockingSession.sessionId !== blockPayload.sessionId) return false;

  const blockedUrl = getDeepFocusBlockedUrl(blockingSession, blockPayload.blockedUrl, blockPayload.restrictedWindowBlock === true);
  await chrome.tabs.update(tabId, { url: blockedUrl }).catch(error => {
    console.error('[DeepFocus] Failed to show blocked page:', error);
  });
  return true;
}

export async function handleDeepFocusTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;
  const url = tab.url || tab.pendingUrl;
  if (url) {
    await handleDeepFocusNavigation(tab.id, url);
    return;
  }

  setTimeout(() => {
    chrome.tabs.get(tab.id!, nextTab => {
      if (chrome.runtime.lastError || !nextTab?.id) return;
      void handleDeepFocusNavigation(nextTab.id, nextTab.url || nextTab.pendingUrl);
    });
  }, 250);
}

export async function handleDeepFocusWindowCreated(window: chrome.windows.Window): Promise<void> {
  const windowId = window.id;
  if (!windowId) return;
  setTimeout(() => {
    chrome.tabs.query({ windowId }, tabs => {
      tabs.forEach(tab => {
        if (!tab.id) return;
        void handleDeepFocusNavigation(tab.id, tab.url || tab.pendingUrl);
      });
    });
  }, 250);
}

export async function restoreActiveSessions() {
  try {
    const result = await chrome.storage.local.get(['active_sessions', 'active_dashboard_view_session']);
    const stored: ActiveSessionEntry[] = result.active_sessions || [];
    stored.forEach(s => activeSessions.set(s.windowId, s));
    const activeDashboardSession = result.active_dashboard_view_session;
    const rawByWindow =
      activeDashboardSession?.byWindow &&
      typeof activeDashboardSession.byWindow === 'object' &&
      !Array.isArray(activeDashboardSession.byWindow)
        ? activeDashboardSession.byWindow
        : {};

    Object.entries(rawByWindow).forEach(([windowId, entry]) => {
      const numericWindowId = Number(windowId);
      if (!Number.isFinite(numericWindowId) || !entry || typeof entry !== 'object') return;
      const candidate = entry as Partial<ActiveDashboardViewSessionEntry>;
      activeDashboardViewSessionsByWindow.set(numericWindowId, {
        viewId: typeof candidate.viewId === 'string' ? candidate.viewId : null,
        sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : null,
      });
    });

    await Promise.all(
      Array.from(activeSessions.keys()).map(windowId =>
        getValidatedActiveSessionForWindow(windowId, { refreshFocus: false }),
      ),
    );
    const activeDeepFocusWindowIds = Array.from(activeSessions.entries())
      .filter(([, session]) => session.openSettings?.deepFocusMode === true)
      .map(([windowId]) => windowId);
    await Promise.all(
      activeDeepFocusWindowIds.map(windowId =>
        restoreConfiguredUrlsIntoActiveSession(windowId, { refreshFocus: false }),
      ),
    );
    persistActiveSessions();
  } catch (e) {
    console.error('[Session] Failed to restore sessions:', e);
  }
}

const activeSessionsRestorePromise = restoreActiveSessions();
void activeSessionsRestorePromise.then(() => refreshDeepFocusForRelevantTabs());

export function persistActiveSessions() {
  const sessions = Array.from(activeSessions.values());
  for (const [windowId, entry] of activeDashboardViewSessionsByWindow.entries()) {
    const activeSession = activeSessions.get(windowId);
    if (!activeSession || activeSession.sessionId !== entry.sessionId) {
      activeDashboardViewSessionsByWindow.delete(windowId);
    }
  }
  const activeDashboardViewSessionByWindow = Object.fromEntries(
    Array.from(activeDashboardViewSessionsByWindow.entries()).map(([windowId, entry]) => [String(windowId), entry]),
  );
  chrome.storage.local.set({
    active_sessions: sessions,
    active_dashboard_view_session: {
      byWindow: activeDashboardViewSessionByWindow,
    },
  }).catch(() => {});
}

function setActiveDashboardViewSession(windowId: number, viewId?: string | null, sessionId?: string | null) {
  const previousSessionId = activeDashboardViewSessionsByWindow.get(windowId)?.sessionId ?? null;
  if (sessionId) {
    activeDashboardViewSessionsByWindow.set(windowId, {
      viewId: viewId ? String(viewId) : null,
      sessionId: String(sessionId),
    });
  } else {
    activeDashboardViewSessionsByWindow.delete(windowId);
  }
  persistActiveSessions();
  void refreshDeepFocusForRelevantTabs(previousSessionId);
  sessionFlowDebug('[SessionFlow][background] active dashboard view session updated', {
    windowId,
    viewId,
    sessionId,
  });
}

async function endDashboardViewSessionForNavigation(
  windowId: number,
  nextViewId: string,
  previousViewId?: string | null,
  previousSessionId?: string | null,
) {
  const session = await getValidatedActiveSessionForWindow(windowId);
  const dashboardEntry = activeDashboardViewSessionsByWindow.get(windowId);
  const mappedSessionMatches =
    Boolean(session?.sessionId) &&
    String(dashboardEntry?.sessionId || '') === String(session?.sessionId || '') &&
    dashboardEntry?.viewId !== nextViewId;
  const linkedSessionMatches =
    Boolean(session?.sessionId && previousSessionId) &&
    previousViewId !== nextViewId &&
    String(previousSessionId) === String(session?.sessionId);
  console.log('[DashboardViewSwitchTrace] cleanup requested', {
    windowId,
    nextViewId,
    previousViewId: previousViewId ?? dashboardEntry?.viewId ?? null,
    previousSessionId: previousSessionId ?? null,
    mappedSessionId: dashboardEntry?.sessionId ?? null,
    activeSessionId: session?.sessionId ?? null,
    pinnedTabId: session?.pinnedTabId ?? null,
    mappedSessionMatches,
    linkedSessionMatches,
  });
  if (!mappedSessionMatches && !linkedSessionMatches) {
    return { stopped: false, reason: previousViewId === nextViewId ? 'same_view' : 'session_not_linked_to_previous_view' };
  }

  if (!session) return { stopped: false, reason: 'no_active_window_session' };

  let controlTabId = session.pinnedTabId > 0 ? session.pinnedTabId : null;
  if (controlTabId) {
    const storedControlTab = await chrome.tabs.get(controlTabId).catch(() => null);
    if (!storedControlTab || storedControlTab.windowId !== windowId) {
      controlTabId = null;
    }
  }
  if (!controlTabId) {
    controlTabId = await getExtensionControlTabIdForWindow(windowId);
  }

  let didUnpinControlTab = false;
  if (controlTabId) {
    const updatedTab = await chrome.tabs.update(controlTabId, { pinned: false }).catch(error => {
      sessionFlowWarn('[SessionFlow][background] could not unpin ended dashboard session tab', {
        windowId,
        sessionId: session.sessionId,
        pinnedTabId: controlTabId,
        error,
      });
      return null;
    });
    didUnpinControlTab = updatedTab?.pinned === false;
  }

  await stopActiveSessionRuntimeForWindow(windowId, 'dashboard_view_navigated');

  sessionFlowDebug('[SessionFlow][background] ended dashboard session on view navigation', {
    windowId,
    previousViewId: previousViewId ?? dashboardEntry?.viewId ?? null,
    nextViewId,
    sessionId: session.sessionId,
    pinnedTabId: controlTabId,
    didUnpinControlTab,
  });
  console.log('[DashboardViewSwitchTrace] cleanup completed', {
    windowId,
    previousViewId: previousViewId ?? dashboardEntry?.viewId ?? null,
    nextViewId,
    sessionId: session.sessionId,
    pinnedTabId: controlTabId,
    didUnpinControlTab,
  });

  return { stopped: true, sessionId: session.sessionId, pinnedTabId: controlTabId, didUnpinControlTab };
}

async function updateActiveSessionOpenSettings(sessionId: string, openSettings: Partial<SessionOpenSettings>): Promise<number> {
  const nextSettings = normalizeSessionOpenSettings({
    ...openSettings,
    pinSessionTab: true,
  });
  let updatedCount = 0;
  let deepFocusEnabled = false;

  for (const windowId of Array.from(activeSessions.keys())) {
    const session = await getValidatedActiveSessionForWindow(windowId);
    if (!session) continue;
    if (String(session.sessionId) !== String(sessionId)) continue;
    const isTurningAutoSaveOn =
      session.openSettings?.autoSaveMode !== 'auto_save' && nextSettings.autoSaveMode === 'auto_save';
    activeSessions.set(windowId, {
      ...session,
      openSettings: nextSettings,
    });
    if (isTurningAutoSaveOn) {
      await syncCurrentWindowTabsIntoActiveSession(windowId);
      const currentSession = await getValidatedActiveSessionForWindow(windowId);
      if (currentSession) await saveSessionToDb(currentSession);
    }
    if (nextSettings.deepFocusMode === true) {
      deepFocusEnabled = true;
    }
    updatedCount++;
  }

  if (deepFocusEnabled) {
    await Promise.all(
      Array.from(activeSessions.keys()).map(windowId => restoreConfiguredUrlsIntoActiveSession(windowId)),
    );
  }

  if (updatedCount > 0) {
    persistActiveSessions();
    void refreshDeepFocusForRelevantTabs(sessionId);
  }

  return updatedCount;
}

export async function saveSessionToDb(session: ActiveSessionEntry) {
  try {
    const sessionRecord = await db.sessions.get(session.sessionId);
    if (!sessionRecord) return;

    const currentUrls = session.capturedUrls || [];
    const dbUrls = (sessionRecord.urls || []).map(u => u.url);
    const hasChanged = currentUrls.length !== dbUrls.length || currentUrls.some((url, i) => url !== dbUrls[i]);

    if (!hasChanged) {
      return; // Skip saving if nothing actually changed
    }

    const usedExistingIds = new Set<string>();
    const urlsAsLinkItems = session.capturedUrls.map((url, i) => {
      const existing = sessionRecord.urls?.find(u => u.url === url && !usedExistingIds.has(u.id));
      const tabId = session.capturedTabIds?.[i];
      const mappedSnapshot = typeof tabId === 'number' ? session.snapshotItemsByTabId?.[tabId] : undefined;
      const mappedExisting = mappedSnapshot
        ? sessionRecord.urls?.find(item => item.id === mappedSnapshot.id && !usedExistingIds.has(item.id))
        : undefined;
      const snapshotExisting = existing || mappedExisting || (!session.snapshotItemsByTabId
        ? sessionRecord.urls?.find(item => {
            if (usedExistingIds.has(item.id) || !item.originalData?.sessionAgentSnapshot) return false;
            return getSessionAgentProviderMatchKey(item.url) === getSessionAgentProviderMatchKey(url);
          })
        : undefined);
      if (snapshotExisting) usedExistingIds.add(snapshotExisting.id);
      const title = session.capturedNames[i] || snapshotExisting?.title || snapshotExisting?.name || url;
      if (snapshotExisting) {
        return {
          ...snapshotExisting,
          url,
          title,
        };
      }

      const referenceType = getSessionReferenceType(url);
      return {
        id: generateEntityId('link'),
        url,
        title,
        source: referenceType === 'note' || referenceType === 'snippet' ? referenceType : 'tab',
      };
    });

    await db.sessions.update(session.sessionId, {
      urls: urlsAsLinkItems,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[SessionFlow][background] Failed to save session to DB:', err);
  }
}

async function activateAutoSaveSessionTracking(request: any, sender: chrome.runtime.MessageSender) {
  const {
    sessionId,
    sessionName,
    workspaceId,
    folderId,
    teamId,
    storageMode,
    initialUrls = [],
    initialNames = [],
    openSettings,
    currentTabId,
    currentWindowId,
  } = request;

  if (!sessionId) {
    return { ok: false, error: 'missing_session_id' };
  }

  const targetWindowId =
    typeof currentWindowId === 'number'
      ? currentWindowId
      : typeof sender.tab?.windowId === 'number'
        ? sender.tab.windowId
        : undefined;

  if (typeof targetWindowId !== 'number') {
    return { ok: false, error: 'missing_window_id' };
  }

  const existingSession = await getValidatedActiveSessionForWindow(targetWindowId);
  if (existingSession && String(existingSession.sessionId) !== String(sessionId)) {
    return {
      ok: false,
      error: 'active_session_conflict',
      existingSessionId: existingSession.sessionId,
    };
  }

  const settings = normalizeSessionOpenSettings({
    ...DEFAULT_SESSION_SETTINGS,
    ...(openSettings || {}),
    autoSaveMode: 'auto_save',
    pinSessionTab: true,
  });

  if (existingSession) {
    activeSessions.set(targetWindowId, {
      ...existingSession,
      sessionName: sessionName || existingSession.sessionName,
      workspaceId: workspaceId || existingSession.workspaceId,
      folderId: folderId ?? existingSession.folderId,
      teamId: teamId || existingSession.teamId,
      storageMode: storageMode || existingSession.storageMode || 'local',
      openSettings: settings,
    });
    await syncCurrentWindowTabsIntoActiveSession(targetWindowId);
    const currentSession = await getValidatedActiveSessionForWindow(targetWindowId);
    if (currentSession) await saveSessionToDb(currentSession);
    persistActiveSessions();
    void refreshDeepFocusForRelevantTabs(sessionId);
    return { ok: true, sessionId, windowId: targetWindowId, activated: true, alreadyRunning: true };
  }

  const pinnedTabId =
    typeof currentTabId === 'number'
      ? currentTabId
      : typeof sender.tab?.id === 'number'
        ? sender.tab.id
      : existingSession?.pinnedTabId ?? -1;

  if (pinnedTabId < 0) {
    return { ok: false, error: 'control_tab_missing' };
  }

  const pinnedControlTab = await chrome.tabs.update(pinnedTabId, { pinned: true }).catch(() => null);
  if (!pinnedControlTab?.id || pinnedControlTab.windowId !== targetWindowId || pinnedControlTab.pinned !== true) {
    return { ok: false, error: 'control_tab_pin_failed' };
  }

  const session: ActiveSessionEntry = {
    sessionId,
    sessionName: sessionName || existingSession?.sessionName || 'Untitled Tab Session',
    windowId: targetWindowId,
    pinnedTabId,
    workspaceId: workspaceId || existingSession?.workspaceId || '',
    folderId: folderId || existingSession?.folderId || null,
    teamId,
    storageMode: storageMode || existingSession?.storageMode || 'local',
    capturedUrls: Array.isArray(initialUrls) ? [...initialUrls] : [],
    capturedNames: Array.isArray(initialNames) ? [...initialNames] : [],
    createdAt: existingSession?.createdAt || nowUtc(),
    initialTabUrls: pinnedTabId > 0 ? { [pinnedTabId]: sender.tab?.url || '' } : {},
    openSettings: settings,
    launchSource: 'autosave_tracking',
  };

  activeSessions.set(targetWindowId, session);
  await openMissingConfiguredSessionTabs(targetWindowId);
  const didCaptureWindowTabs = await syncCurrentWindowTabsIntoActiveSession(targetWindowId);
  const currentSession = await getValidatedActiveSessionForWindow(targetWindowId);
  if (!currentSession) {
    return { ok: false, error: 'control_tab_not_pinned' };
  }
  if (didCaptureWindowTabs) {
    saveSessionToDb(currentSession);
  }
  persistActiveSessions();
  void refreshDeepFocusForRelevantTabs(sessionId);

  chrome.runtime
    .sendMessage({
      action: 'session_tab_captured',
      sessionId,
      windowId: targetWindowId,
      url: '',
      title: '',
      favIconUrl: '',
      capturedUrls: currentSession.capturedUrls,
      capturedNames: currentSession.capturedNames,
    })
    .catch(() => {});

  return { ok: true, sessionId, windowId: targetWindowId, activated: true };
}

async function deactivateAutoSaveSessionTracking(request: any, sender: chrome.runtime.MessageSender) {
  const { sessionId, currentWindowId } = request;
  const targetWindowId =
    typeof currentWindowId === 'number'
      ? currentWindowId
      : typeof sender.tab?.windowId === 'number'
        ? sender.tab.windowId
        : undefined;

  if (!sessionId || typeof targetWindowId !== 'number') {
    return { ok: false, error: 'missing_session_context' };
  }

  const session = await getValidatedActiveSessionForWindow(targetWindowId);
  if (session && String(session.sessionId) === String(sessionId)) {
    session.openSettings = normalizeSessionOpenSettings({
      ...(session.openSettings || {}),
      autoSaveMode: 'dont_save',
      pinSessionTab: true,
    });
    activeSessions.set(targetWindowId, session);
    persistActiveSessions();
    void refreshDeepFocusForRelevantTabs(sessionId);
    return { ok: true, sessionId, windowId: targetWindowId, deactivated: true, sessionStillRunning: true };
  }

  return { ok: true, sessionId, windowId: targetWindowId, deactivated: false };
}

export function handleSessionMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
  if (request.action === 'activate_session_autosave_tracking') {
    activateAutoSaveSessionTracking(request, sender)
      .then(sendResponse)
      .catch(error => {
        console.error('[SessionFlow][background] Failed to activate auto-save tracking:', error);
        sendResponse({ ok: false, error: 'activate_auto_save_tracking_failed' });
      });
    return true;
  }

  if (request.action === 'deactivate_session_autosave_tracking') {
    deactivateAutoSaveSessionTracking(request, sender)
      .then(sendResponse)
      .catch(error => {
        console.error('[SessionFlow][background] Failed to deactivate auto-save tracking:', error);
        sendResponse({ ok: false, error: 'deactivate_auto_save_tracking_failed' });
      });
    return true;
  }

  if (request.action === 'start_session') {
    const {
      sessionName,
      workspaceId,
      folderId,
      teamId,
      storageMode,
      sessionId: reqSessionId,
      initialUrls = [],
      initialNames = [],
      openUrls,
      openSettings,
      currentTabId,
      currentWindowId,
      currentPageUrl,
      sessionLaunchSource,
      dashboardViewId,
      smartLaunch,
      sessionReferenceItems: requestedSessionReferenceItems = [],
    } = request;
    const sessionId = reqSessionId || generateEntityId('session');
    const urlsForOpening = Array.isArray(openUrls) ? openUrls : initialUrls;
    const suppliedSessionReferenceItems = Array.isArray(requestedSessionReferenceItems)
      ? requestedSessionReferenceItems
      : [];
    const sessionReferenceItems = suppliedSessionReferenceItems.length > 0
      ? suppliedSessionReferenceItems
      : initialUrls
          .map((url: string, index: number) => ({ url, name: initialNames[index] || url }))
          .filter((item: { url: string }) => {
            const referenceType = getSessionReferenceType(item.url);
            return Boolean(referenceType && referenceType !== 'note' && referenceType !== 'snippet');
          });
    const allowedLaunchSources = new Set([
      'session_editor',
      'dashboard_view',
      'autosave_tracking',
      'hotkey',
      'shortcut',
      'omnibox',
      'url_trigger',
      'favorite',
      'board',
      'search',
      'todo',
      'website',
    ]);
    const launchSource: ActiveSessionEntry['launchSource'] = allowedLaunchSources.has(sessionLaunchSource)
      ? sessionLaunchSource
      : 'session_editor';
    const shouldOpenSessionEditor = launchSource === 'session_editor' && smartLaunch !== true;
    const encodedName = encodeURIComponent(sessionName);
    const pinnedTabUrl = chrome.runtime.getURL(
      `AltS_search_newtab/index.html?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
    );
    const dashboardTabUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?skip_session_recovery=true');
    const controlTabUrl = shouldOpenSessionEditor ? pinnedTabUrl : dashboardTabUrl;
    sessionLaunchTrace('start_session received', {
      sessionId,
      launchSource,
      currentWindowId,
      currentTabId,
      smartLaunch,
      openMode: openSettings?.openMode,
      initialUrlCount: initialUrls.length,
      openUrlCount: urlsForOpening.length,
      referenceItems: sessionReferenceItems.map((item: any) => ({ url: item?.url, name: item?.name })),
    });
    const dispatchSessionReferences = (
      tabId: number | undefined,
      openedTabs: Array<{ tabId: number; url: string }> = [],
    ) => {
      if (!tabId || !Array.isArray(sessionReferenceItems) || sessionReferenceItems.length === 0) return;

      const availableTabsByUrl = new Map<string, number[]>();
      openedTabs.forEach(openedTab => {
        const key = normalizeSessionLaunchUrl(openedTab.url);
        const tabIds = availableTabsByUrl.get(key) || [];
        tabIds.push(openedTab.tabId);
        availableTabsByUrl.set(key, tabIds);
      });
      const actionItems = sessionReferenceItems.map((item: any) => {
        if (!item?.originalData?.sessionAgentSnapshot) return item;
        const key = normalizeSessionLaunchUrl(item.url || '');
        const tabIds = availableTabsByUrl.get(key) || [];
        const targetTabId = tabIds.shift();
        return typeof targetTabId === 'number' ? { ...item, targetTabId } : item;
      });
      const activeSession = Array.from(activeSessions.values()).find(entry => entry.sessionId === sessionId);
      if (activeSession) {
        actionItems.forEach((item: any) => {
          if (typeof item?.targetTabId !== 'number' || !item?.originalData?.sessionAgentSnapshot) return;
          activeSession.snapshotItemsByTabId = {
            ...(activeSession.snapshotItemsByTabId || {}),
            [item.targetTabId]: item,
          };
        });
        activeSessions.set(activeSession.windowId, activeSession);
        persistActiveSessions();
      }

      const message = {
        type: 'OPEN_SESSION_REFERENCES',
        sessionId,
        targetTabId: tabId,
        items: actionItems,
      };
      sessionLaunchTrace('dispatching session references', {
        sessionId,
        targetTabId: tabId,
        itemCount: sessionReferenceItems.length,
        items: sessionReferenceItems.map((item: any) => ({ url: item?.url, name: item?.name })),
      });
      const controlPort = sessionControlPorts.get(tabId);
      if (controlPort) {
        controlPort.postMessage(message);
      } else {
        pendingSessionReferenceHandoffs.set(tabId, message);
      }
    };
    sessionFlowDebug(
      '[SessionFlow][background] start_session received',
      JSON.stringify(
        {
          sessionId,
          sessionName,
          workspaceId,
          folderId,
          initialUrlCount: initialUrls.length,
          pinnedTabUrl,
          dashboardTabUrl,
          settings: openSettings,
          launchSource,
        },
        null,
        2,
      ),
    );

    chrome.storage.local
      .remove(`unsaved_session_backup_${sessionId}`)
      .catch(() => {})
      .then(async () => {
        await Promise.all(
          Array.from(activeSessions.keys()).map(windowId => getValidatedActiveSessionForWindow(windowId)),
        );
        const activeEntries = [...activeSessions.values()];
        const settings: SessionOpenSettings = { ...DEFAULT_SESSION_SETTINGS, ...(openSettings || {}) };
        settings.pinSessionTab = true;

        // Normalize incompatible settings combinations
        if (settings.openMode === 'new_window') {
          settings.openInNewTab = false;
        }
        if (settings.openInNewTab === true) {
          settings.openMode = 'same_window';
          settings.focusWindow = false;
        }

        if (smartLaunch === true) {
          settings.openMode = 'same_window';
          settings.openInNewTab = false;
        }

        const useSameWindow = settings.openMode === 'same_window';
        const forceNewSessionTab = useSameWindow && settings.openInNewTab === true;
        const shouldFocusWindow = useSameWindow && !forceNewSessionTab && settings.focusWindow === true;
        sessionFlowDebug(
          '[SessionFlow][background] resolved launch settings',
          JSON.stringify(
            {
              sessionId,
              launchSource,
              shouldOpenSessionEditor,
              useSameWindow,
              forceNewSessionTab,
              shouldFocusWindow,
              settings,
              initialUrlCount: initialUrls.length,
              initialUrls,
              openUrlCount: urlsForOpening.length,
              openUrls: urlsForOpening,
              currentTabId,
              currentWindowId,
              currentPageUrl,
              dashboardTabUrl,
              senderTabId: sender?.tab?.id,
              senderWindowId: sender?.tab?.windowId,
              activeSessionsBeforeLaunch: Array.from(activeSessions.values()).map(s => ({
                sessionId: s.sessionId,
                windowId: s.windowId,
                capturedCount: s.capturedUrls?.length || 0,
                launchSource: s.launchSource,
              })),
            },
            null,
            2,
          ),
        );

        const openInNewWindow = (overrideReason?: string) => {
          const validInitialUrls = urlsForOpening.filter(isOpenableSessionTabUrl);
          const urlsToOpen = [controlTabUrl, ...validInitialUrls];
          if (!controlTabUrl) {
            sessionFlowWarn('[SessionFlow][background] no urls to open for new-window dashboard launch', {
              sessionId,
              launchSource,
              shouldOpenSessionEditor,
              initialUrls,
              overrideReason,
            });
            sendResponse({ ok: true, sessionId, skipped: true });
            return;
          }
          sessionFlowDebug('[SessionFlow][background] creating new window', {
            sessionId,
            launchSource,
            shouldOpenSessionEditor,
            dashboardTabUrl,
            urlsToOpen,
            overrideReason,
          });
          chrome.windows.create({ url: controlTabUrl, type: 'normal', state: 'maximized', focused: true }, newWindow => {
            if (chrome.runtime.lastError || !newWindow) {
              console.error('[Session] Failed to create window:', chrome.runtime.lastError);
              sendResponse({ ok: false, error: 'window_create_failed' });
              return;
            }

            if (!newWindow.id) {
              console.error('[Session] New window is missing an id; cannot start session safely');
              sendResponse({ ok: false, error: 'window_id_missing' });
              return;
            }

            const finishNewWindowLaunch = (tabs: chrome.tabs.Tab[]) => {
              const sortedTabs = [...tabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
              const controlTab = sortedTabs[0];
              const controlTabId = controlTab?.id;

              sessionFlowDebug(
                '[SessionFlow][background] New window created. windowId:',
                newWindow.id,
                '| controlTabId:',
                controlTabId,
                '| tabCount:',
                sortedTabs.length,
              );

              if (!controlTabId || controlTabId < 0) {
                sessionFlowWarn('[SessionFlow][background] controlTabId is invalid; session will not be started');
                sendResponse({ ok: false, error: 'control_tab_missing' });
                return;
              }

              const shouldPin = settings.pinSessionTab !== false;
              sessionLaunchTrace('pinning new-window control tab', {
                sessionId,
                windowId: newWindow.id,
                tabId: controlTabId,
                shouldPin,
              });
              sessionFlowDebug(`[SessionFlow][background] updating control tab: ${controlTabId} (pin: ${shouldPin})`);
              chrome.tabs.update(controlTabId, { pinned: shouldPin, active: true }, updatedControlTab => {
                if (
                  chrome.runtime.lastError ||
                  !updatedControlTab?.id ||
                  updatedControlTab.windowId !== newWindow.id ||
                  updatedControlTab.pinned !== true
                ) {
                  console.error('[Session] Failed to prepare control tab:', chrome.runtime.lastError);
                  sendResponse({ ok: false, error: 'control_tab_update_failed' });
                  return;
                }

                const pinnedTabId = updatedControlTab.id;
                sessionLaunchTrace('new-window control tab update completed', {
                  sessionId,
                  windowId: newWindow.id,
                  tabId: pinnedTabId,
                  pinned: updatedControlTab.pinned,
                });
                const initialTabUrls: Record<number, string> = {
                  [pinnedTabId]: controlTabUrl,
                };

                const session: ActiveSessionEntry = {
                  sessionId,
                  sessionName,
                  windowId: newWindow.id!,
                  pinnedTabId,
                  workspaceId,
                  folderId: folderId || null,
                  teamId,
                  storageMode: storageMode || 'cloud',
                  capturedUrls: [...initialUrls],
                  capturedNames: [...initialNames],
                  createdAt: nowUtc(),
                  initialTabUrls,
                  openSettings: settings,
                  launchSource,
                };

                activeSessions.set(newWindow.id!, session);
                if (launchSource === 'dashboard_view') {
                  setActiveDashboardViewSession(newWindow.id!, dashboardViewId || null, sessionId);
                } else {
                  persistActiveSessions();
                }
                void refreshDeepFocusForRelevantTabs();

                const openedSessionTabs: Array<{ tabId: number; url: string }> = [];
                const finishResponse = () => {
                  chrome.tabs.get(pinnedTabId, controlTab => {
                    const currentSession = activeSessions.get(newWindow.id!);
                    if (
                      chrome.runtime.lastError ||
                      !controlTab?.id ||
                      controlTab.windowId !== newWindow.id ||
                      controlTab.pinned !== true ||
                      currentSession?.sessionId !== sessionId
                    ) {
                      void stopActiveSessionRuntimeForWindow(newWindow.id!, 'control_tab_lost_during_launch');
                      sendResponse({ ok: false, error: 'control_tab_not_pinned' });
                      return;
                    }

                    dispatchSessionReferences(pinnedTabId, openedSessionTabs);
                    sessionFlowDebug(
                      '[SessionFlow][background] new-window session active',
                      JSON.stringify(
                        {
                          sessionId,
                          windowId: newWindow.id,
                          pinnedTabId,
                          capturedCount: session.capturedUrls.length,
                          capturedUrls: session.capturedUrls,
                          launchSource,
                          initialTabUrls,
                          overrideReason,
                          activeSessionsAfterLaunch: Array.from(activeSessions.values()).map(s => ({
                            sessionId: s.sessionId,
                            windowId: s.windowId,
                            capturedCount: s.capturedUrls?.length || 0,
                            launchSource: s.launchSource,
                          })),
                        },
                        null,
                        2,
                      ),
                    );
                    sendResponse({
                      ok: true,
                      sessionId,
                      windowId: newWindow.id,
                      openedInNewWindow: true,
                      ...(overrideReason ? { temporaryNewWindowOverride: true } : {}),
                    });
                  });
                };

                if (validInitialUrls.length === 0) {
                  finishResponse();
                  return;
                }

                createTabsInOrder(
                  validInitialUrls,
                  { windowId: newWindow.id!, active: false },
                  (createdTab, url) => {
                    if (createdTab?.id) {
                      initialTabUrls[createdTab.id] = url;
                      openedSessionTabs.push({ tabId: createdTab.id, url });
                      const currentSession = activeSessions.get(newWindow.id!);
                      if (currentSession?.sessionId === session.sessionId) {
                        activeSessions.set(newWindow.id!, session);
                      }
                    }
                  },
                  () => {
                    persistActiveSessions();
                    finishResponse();
                  },
                  () => activeSessions.get(newWindow.id!)?.sessionId === session.sessionId,
                );
              });
            };

            if (newWindow.tabs?.length) {
              finishNewWindowLaunch(newWindow.tabs);
              return;
            }

            chrome.tabs.query({ windowId: newWindow.id }, tabs => {
              if (chrome.runtime.lastError) {
                console.error('[Session] Failed to query new window tabs:', chrome.runtime.lastError);
                sendResponse({ ok: false, error: 'new_window_tabs_query_failed' });
                return;
              }
              finishNewWindowLaunch(tabs);
            });
          });
        };

        if (useSameWindow) {
          const senderWindowId = typeof currentWindowId === 'number' ? currentWindowId : sender?.tab?.windowId;
          const senderTabId = typeof currentTabId === 'number' ? currentTabId : sender?.tab?.id;
          const senderTabUrl = sender?.tab?.url || currentPageUrl || '';
          const senderPageUrl = sender?.url || currentPageUrl || '';
          const extensionNewTabBase = chrome.runtime.getURL('AltS_search_newtab/');
          const isExtensionNewTabUrl = (url?: string) => {
            if (!url) return false;
            if (url.startsWith(extensionNewTabBase)) return true;
            try {
              const parsed = new URL(url);
              const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;
              if (parsed.origin !== extensionOrigin) return false;
              const normalizedPath = parsed.pathname.replace(/^\/+/, '');
              return normalizedPath === 'newtab.html' || normalizedPath === 'AltS_search_newtab/index.html';
            } catch {
              return false;
            }
          };
          const isSenderExtensionTab =
            isExtensionNewTabUrl(senderTabUrl) ||
            isExtensionNewTabUrl(senderPageUrl) ||
            senderTabUrl.startsWith('chrome://newtab') ||
            senderTabUrl.startsWith('chrome://new-tab-page') ||
            senderTabUrl.startsWith('about:blank');
          sessionFlowDebug('[SessionFlow][background] same-window context', {
            sessionId,
            senderWindowId,
            senderTabId,
            senderTabUrl,
            senderPageUrl,
            extensionNewTabBase,
            isSenderExtensionTab,
          });

          const alreadyActiveInTargetWindow =
            typeof senderWindowId === 'number'
              ? activeEntries.find(s => s.sessionId === sessionId && s.windowId === senderWindowId)
              : undefined;

          if (alreadyActiveInTargetWindow && !shouldFocusWindow && !forceNewSessionTab && launchSource !== 'dashboard_view') {
            sessionFlowDebug(
              `[SessionFlow][background] Session ${sessionId} is already active in window ${alreadyActiveInTargetWindow.windowId}. Reusing same-window session tab.`,
            );
            chrome.windows.update(alreadyActiveInTargetWindow.windowId, { focused: true });
            if (alreadyActiveInTargetWindow.pinnedTabId && alreadyActiveInTargetWindow.pinnedTabId > 0) {
              chrome.tabs.update(alreadyActiveInTargetWindow.pinnedTabId, {
                active: true,
                pinned: settings.pinSessionTab !== false,
              });
            }
            sendResponse({ ok: true, sessionId, windowId: alreadyActiveInTargetWindow.windowId, reused: true });
            return;
          }

          const openInWindow = (windowId: number) => {
            const existingSession = activeSessions.get(windowId);
            const isDifferentSessionAlreadyRunning =
              Boolean(existingSession?.sessionId) &&
              String(existingSession?.sessionId) !== String(sessionId);

            const finishSetup = (pinnedTabId: number, responseExtras: Record<string, any> = {}) => {
              const initialTabUrls: Record<number, string> = {};
              const openedSessionTabs: Array<{ tabId: number; url: string }> = [];
              if (pinnedTabId > 0) {
                initialTabUrls[pinnedTabId] = controlTabUrl;
              }

              const validInitialUrls = urlsForOpening.filter(isOpenableSessionTabUrl);
              const totalToOpen = validInitialUrls.length;
              const session: ActiveSessionEntry = {
                sessionId,
                sessionName,
                windowId,
                pinnedTabId,
                workspaceId,
                folderId: folderId || null,
                teamId,
                storageMode: storageMode || 'local',
                capturedUrls: [...initialUrls],
                capturedNames: [...initialNames],
                createdAt: nowUtc(),
                initialTabUrls,
                openSettings: settings,
                launchSource,
              };

              activeSessions.set(windowId, session);
              if (launchSource === 'dashboard_view') {
                setActiveDashboardViewSession(windowId, dashboardViewId || null, sessionId);
              } else {
                persistActiveSessions();
              }
              sessionFlowDebug('[SessionFlow][background] finish same-window setup', {
                sessionId,
                windowId,
                pinnedTabId,
                validInitialUrls,
                totalToOpen,
                launchSource,
              });

              const onAllTabsOpened = () => {
                chrome.tabs.get(pinnedTabId, controlTab => {
                  if (
                    chrome.runtime.lastError ||
                    !controlTab?.id ||
                    controlTab.windowId !== windowId ||
                    controlTab.pinned !== true ||
                    activeSessions.get(windowId)?.sessionId !== sessionId
                  ) {
                    sessionLaunchTrace('same-window control tab validation failed before activation', {
                      sessionId,
                      windowId,
                      tabId: pinnedTabId,
                      pinned: controlTab?.pinned,
                      actualWindowId: controlTab?.windowId,
                      error: chrome.runtime.lastError?.message,
                    });
                    sendResponse({ ok: false, error: 'control_tab_not_pinned' });
                    return;
                  }

                  activeSessions.set(windowId, session);
                  if (launchSource === 'dashboard_view') {
                    setActiveDashboardViewSession(windowId, dashboardViewId || null, sessionId);
                  } else {
                    persistActiveSessions();
                  }
                  void refreshDeepFocusForRelevantTabs();
                  dispatchSessionReferences(pinnedTabId, openedSessionTabs);
                  sessionFlowDebug(
                    '[SessionFlow][background] same-window session active',
                    JSON.stringify(
                      {
                        sessionId,
                        windowId,
                        pinnedTabId,
                        capturedCount: session.capturedUrls.length,
                        capturedUrls: session.capturedUrls,
                        launchSource,
                        activeSessionsAfterLaunch: Array.from(activeSessions.values()).map(s => ({
                          sessionId: s.sessionId,
                          windowId: s.windowId,
                          capturedCount: s.capturedUrls?.length || 0,
                          launchSource: s.launchSource,
                        })),
                      },
                      null,
                      2,
                    ),
                  );
                  const responseExtrasPayload: Record<string, any> = { ...responseExtras };
                  if (forceNewSessionTab) {
                    responseExtrasPayload.openedInNewTab = true;
                  }
                  sendResponse({ ok: true, sessionId, windowId, ...responseExtrasPayload });
                });
              };

              if (totalToOpen === 0) {
                onAllTabsOpened();
                return;
              }

              createTabsInOrder(
                validInitialUrls,
                { windowId, active: false },
                (newTab, url) => {
                  if (newTab?.id) {
                    initialTabUrls[newTab.id] = url;
                    openedSessionTabs.push({ tabId: newTab.id, url });
                  }
                },
                onAllTabsOpened,
                () => activeSessions.get(windowId)?.sessionId === sessionId,
              );
            };

            const openPinnedTab = (responseExtras: Record<string, any> = {}) => {
              const shouldPin = settings.pinSessionTab !== false;
              const reuseCurrentExtensionTab =
                !forceNewSessionTab && !!senderTabId && senderWindowId === windowId && isSenderExtensionTab;
              sessionLaunchTrace('preparing same-window control tab', {
                sessionId,
                windowId,
                senderTabId,
                reuseCurrentExtensionTab,
                shouldPin,
                senderTabUrl,
                senderPageUrl,
                controlTabUrl,
              });

              const openAfterPinnedTabReady = (pinnedTabId: number) => {
                const continueAfterPin = () => {
                  sessionLaunchTrace('control tab pin confirmed', {
                    sessionId,
                    windowId,
                    tabId: pinnedTabId,
                  });
                  if (!shouldFocusWindow) {
                    finishSetup(pinnedTabId, responseExtras);
                    return;
                  }

                  chrome.tabs.query({ windowId }, tabs => {
                    const tabsToClose = tabs.filter(t => t.id && t.id !== pinnedTabId);
                    const tabIds = tabsToClose.map(t => t.id as number);

                    if (tabIds.length > 0) {
                      chrome.tabs.remove(tabIds, () => {
                        finishSetup(pinnedTabId, responseExtras);
                      });
                    } else {
                      finishSetup(pinnedTabId, responseExtras);
                    }
                  });
                };

                chrome.tabs.get(pinnedTabId, tab => {
                  if (chrome.runtime.lastError || !tab) {
                    console.error('[SessionLaunchTrace] control tab lookup failed', {
                      sessionId,
                      windowId,
                      tabId: pinnedTabId,
                      error: chrome.runtime.lastError?.message,
                    });
                    sendResponse({ ok: false, error: 'control_tab_lookup_failed' });
                    return;
                  }
                  sessionLaunchTrace('control tab state before pin confirmation', {
                    sessionId,
                    windowId,
                    tabId: pinnedTabId,
                    pinned: tab.pinned,
                    url: tab.url,
                  });
                  if (tab.pinned) {
                    continueAfterPin();
                    return;
                  }
                  chrome.tabs.update(pinnedTabId, { pinned: true }, updatedTab => {
                    if (chrome.runtime.lastError || !updatedTab?.pinned) {
                      console.error('[SessionLaunchTrace] control tab pin failed', {
                        sessionId,
                        windowId,
                        tabId: pinnedTabId,
                        pinned: updatedTab?.pinned,
                        error: chrome.runtime.lastError?.message,
                      });
                      sendResponse({ ok: false, error: 'control_tab_pin_failed' });
                      return;
                    }
                    continueAfterPin();
                  });
                });
              };

              if (reuseCurrentExtensionTab) {
                const reusableTabId = senderTabId as number;
                chrome.tabs.update(reusableTabId, { url: controlTabUrl, pinned: shouldPin, active: true }, pinnedTab => {
                  if (chrome.runtime.lastError || !pinnedTab) {
                    console.error('[Session] Failed to reuse current extension tab:', chrome.runtime.lastError);
                    sendResponse({ ok: false, error: 'pinned_tab_reuse_failed' });
                    return;
                  }
                  openAfterPinnedTabReady(pinnedTab.id ?? -1);
                });
                return;
              }

              chrome.tabs.create(
                { url: controlTabUrl, windowId, pinned: shouldPin, active: forceNewSessionTab ? true : false },
                pinnedTab => {
                  if (chrome.runtime.lastError || !pinnedTab) {
                    console.error('[Session] Failed to create pinned tab:', chrome.runtime.lastError);
                    sendResponse({ ok: false, error: 'pinned_tab_create_failed' });
                    return;
                  }
                  openAfterPinnedTabReady(pinnedTab.id ?? -1);
                },
              );
            };

            const launchSession = () => {
              openPinnedTab();
            };

            if (isDifferentSessionAlreadyRunning) {
              chrome.tabs.query({ windowId }, tabs => {
                if (chrome.runtime.lastError) {
                  sessionFlowWarn('[SessionFlow][background] failed to inspect active-session window; preserving it in a new window', {
                    windowId,
                    existingSessionId: existingSession?.sessionId,
                    nextSessionId: sessionId,
                    error: chrome.runtime.lastError.message,
                  });
                  openInNewWindow('active-session-in-sender-window');
                  return;
                }

                const realTabs = tabs.filter(tab => {
                  const url = tab.url || tab.pendingUrl || '';
                  return tab.id !== existingSession?.pinnedTabId && isSessionRealTabUrl(url);
                });

                if (realTabs.length > 0) {
                  sessionFlowDebug('[SessionFlow][background] preserving existing session and opening requested session in a new window', {
                    windowId,
                    existingSessionId: existingSession?.sessionId,
                    nextSessionId: sessionId,
                    launchSource,
                    requestedOpenMode: settings.openMode,
                    realTabCount: realTabs.length,
                  });
                  openInNewWindow('active-session-in-sender-window');
                  return;
                }

                sessionFlowDebug('[SessionFlow][background] replacing active session in extension-only sender window', {
                  windowId,
                  existingSessionId: existingSession?.sessionId,
                  nextSessionId: sessionId,
                  launchSource,
                });
                if (existingSession) {
                  saveSessionToDb(existingSession);
                  activeSessions.delete(windowId);
                  persistActiveSessions();
                }
                launchSession();
              });
              return;
            }

            if (existingSession) {
              sessionFlowDebug(
                '[SessionFlow][background] replacing existing session in window',
                JSON.stringify(
                  {
                    windowId,
                    existingSessionId: existingSession.sessionId,
                    existingCapturedCount: existingSession.capturedUrls?.length || 0,
                    nextSessionId: sessionId,
                    nextInitialUrlCount: initialUrls.length,
                    shouldFocusWindow,
                    launchSource,
                  },
                  null,
                  2,
                ),
              );
              saveSessionToDb(existingSession);
              activeSessions.delete(windowId);
              persistActiveSessions();

              if (!shouldFocusWindow) {
                chrome.tabs.query({ windowId }, tabs => {
                  const keeperTabId = senderTabId || existingSession.pinnedTabId;
                  const tabsToClose = tabs.filter(t => t.id && t.id !== keeperTabId && (forceNewSessionTab ? t.id !== senderTabId : true));
                  const tabIds = tabsToClose.map(t => t.id as number);

                  if (tabIds.length > 0) {
                    chrome.tabs.remove(tabIds, () => {
                      launchSession();
                    });
                  } else {
                    launchSession();
                  }
                });
                return;
              }
            }

            launchSession();
          };

          const activeSameSessionInAnyWindow =
            smartLaunch === true
              ? activeEntries.find(session => String(session.sessionId) === String(sessionId))
              : undefined;

          if (activeSameSessionInAnyWindow) {
            const existingWindowId = activeSameSessionInAnyWindow.windowId;
            const existingPinnedTabId = activeSameSessionInAnyWindow.pinnedTabId;
            sessionFlowDebug('[SessionFlow][background] smart launch reusing session already active in another window', {
              sessionId,
              existingWindowId,
              existingPinnedTabId,
              launchSource,
            });

            const focusExistingWindow = () => {
              chrome.windows.update(existingWindowId, { focused: true }, () => {
                if (chrome.runtime.lastError) {
                  sessionFlowWarn('[SessionFlow][background] failed to focus existing session window', {
                    sessionId,
                    existingWindowId,
                    error: chrome.runtime.lastError.message,
                  });
                }
                sendResponse({
                  ok: true,
                  sessionId,
                  windowId: existingWindowId,
                  reused: true,
                  focusedExisting: true,
                });
              });
            };

            if (existingPinnedTabId && existingPinnedTabId > 0) {
              chrome.tabs.get(existingPinnedTabId, tab => {
                if (
                  chrome.runtime.lastError ||
                  !tab?.id ||
                  tab.windowId !== existingWindowId ||
                  tab.pinned !== true
                ) {
                  sessionFlowWarn('[SessionFlow][background] existing session control tab missing; removing stale active entry', {
                    sessionId,
                    existingWindowId,
                    existingPinnedTabId,
                    error: chrome.runtime.lastError?.message,
                  });
                  activeSessions.delete(existingWindowId);
                  persistActiveSessions();
                  if (typeof senderWindowId !== 'number') {
                    openInNewWindow('stale-existing-session-control-tab-no-sender-window');
                    return;
                  }
                  chrome.tabs.query({ windowId: senderWindowId }, senderTabs => {
                    if (chrome.runtime.lastError) {
                      openInNewWindow('stale-existing-session-control-tab-query-failed');
                      return;
                    }
                    const senderRealTabs = senderTabs.filter(senderTab => {
                      const url = senderTab.url || senderTab.pendingUrl || '';
                      return isSessionRealTabUrl(url);
                    });
                    sessionLaunchTrace('stale-session smart fallback', {
                      sessionId,
                      senderWindowId,
                      realTabCount: senderRealTabs.length,
                      decision: senderRealTabs.length === 0 ? 'same_window' : 'new_window',
                    });
                    if (senderRealTabs.length === 0) {
                      openInWindow(senderWindowId);
                    } else {
                      openInNewWindow('stale-existing-session-control-tab-busy-sender-window');
                    }
                  });
                  return;
                }

                chrome.tabs.update(tab.id, {
                  active: true,
                  pinned: true,
                }, updatedTab => {
                  if (chrome.runtime.lastError || updatedTab?.pinned !== true) {
                    void stopActiveSessionRuntimeForWindow(existingWindowId, 'control_tab_pin_failed_during_reuse');
                    sendResponse({ ok: false, error: 'control_tab_pin_failed' });
                    return;
                  }
                  focusExistingWindow();
                });
              });
              return;
            }

            focusExistingWindow();
            return;
          }

          const openSmartOrSameWindow = (windowId: number) => {
            if (smartLaunch !== true || shouldFocusWindow || forceNewSessionTab) {
              openInWindow(windowId);
              return;
            }

            const existingSession = activeSessions.get(windowId);
            if (existingSession) {
              openInWindow(windowId);
              return;
            }

            chrome.tabs.query({ windowId }, tabs => {
              if (chrome.runtime.lastError) {
                sessionFlowWarn('[SessionFlow][background] smart launch tab query failed; falling back to same window', {
                  sessionId,
                  windowId,
                  error: chrome.runtime.lastError.message,
                });
                openInWindow(windowId);
                return;
              }

              const realTabs = tabs.filter(tab => {
                const url = tab.url || tab.pendingUrl || '';
                return isSessionRealTabUrl(url);
              });

              sessionLaunchTrace('smart-window decision', {
                sessionId,
                windowId,
                tabCount: tabs.length,
                realTabCount: realTabs.length,
                tabs: tabs.map(tab => ({ id: tab.id, windowId: tab.windowId, url: tab.url || tab.pendingUrl, pinned: tab.pinned })),
                decision: realTabs.length > 0 ? 'new_window' : 'same_window',
              });

              if (realTabs.length > 0) {
                sessionFlowDebug('[SessionFlow][background] smart launch found busy current window; opening new window', {
                  sessionId,
                  windowId,
                  realTabCount: realTabs.length,
                  launchSource,
                });
                openInNewWindow('smart-current-window-has-real-tabs');
                return;
              }

              openInWindow(windowId);
            });
          };

          if (senderWindowId) {
            openSmartOrSameWindow(senderWindowId);
          } else {
            chrome.windows.getCurrent({ populate: false }, currentWindow => {
              if (currentWindow?.id) {
                openSmartOrSameWindow(currentWindow.id);
              } else {
                sendResponse({ ok: false, error: 'no_window_found' });
              }
            });
          }
        } else {
          openInNewWindow();
        }
      });
    return true;
  }

  if (request.action === 'update_session_id') {
    const { oldSessionId, newSessionId } = request;
    void (async () => {
      for (const windowId of Array.from(activeSessions.keys())) {
        const session = await getValidatedActiveSessionForWindow(windowId);
        if (session?.sessionId === oldSessionId) {
          session.sessionId = newSessionId;
          activeSessions.set(windowId, session);
          const dashboardSession = activeDashboardViewSessionsByWindow.get(windowId);
          if (dashboardSession?.sessionId === oldSessionId) {
            activeDashboardViewSessionsByWindow.set(windowId, {
              viewId: dashboardSession.viewId ?? null,
              sessionId: newSessionId,
            });
          }
        }
      }
      persistActiveSessions();
      sendResponse({ ok: true });
    })().catch(error => {
      console.error('[SessionFlow][background] Failed to update active session id:', error);
      sendResponse({ ok: false, error: 'update_session_id_failed' });
    });
    return true;
  }

  if (request.action === 'update_session_settings') {
    const { sessionId, openSettings } = request;
    if (!sessionId || !openSettings || typeof openSettings !== 'object') {
      sendResponse({ ok: false, error: 'missing_session_settings' });
      return false;
    }

    const nextSettings = normalizeSessionOpenSettings({
      ...openSettings,
      pinSessionTab: true,
    });

    void (async () => {
      const activeEntries: Array<[number, ActiveSessionEntry]> = [];
      for (const windowId of Array.from(activeSessions.keys())) {
        const session = await getValidatedActiveSessionForWindow(windowId);
        if (session && String(session.sessionId) === String(sessionId)) {
          activeEntries.push([windowId, session]);
        }
      }

      await Promise.all(activeEntries.map(async ([windowId, session]) => {
        const oldMode = session.openSettings?.autoSaveMode;
        const oldFocus = session.openSettings?.focusWindow;
        const isSameWindow = nextSettings.openMode === 'same_window';
        const focusTurnedOn = !oldFocus && nextSettings.focusWindow === true;

        activeSessions.set(windowId, {
          ...session,
          openSettings: nextSettings,
        });

        if (nextSettings.deepFocusMode === true) {
          await restoreConfiguredUrlsIntoActiveSession(windowId);
        }

        if (
          oldMode === 'dont_save' &&
          nextSettings.autoSaveMode === 'auto_save' &&
          nextSettings.deepFocusMode !== true
        ) {
          await syncCurrentWindowTabsIntoActiveSession(windowId);
        }

        if (isSameWindow && focusTurnedOn) {
          const currentSession = await getValidatedActiveSessionForWindow(windowId);
          if (!currentSession) return;
          const tabs = await chrome.tabs.query({ windowId }).catch(() => []);

          const tabsToClose = tabs.filter(
            t =>
              t.id &&
              t.id !== currentSession.pinnedTabId &&
              !t.url?.startsWith('chrome-extension://') &&
              !currentSession.capturedUrls.includes(t.url || ''),
          );
          const tabIdsToClose = tabsToClose.map(t => t.id as number);
          if (tabIdsToClose.length > 0) {
            chrome.tabs.remove(tabIdsToClose, () => {});
          }
        }

        if (oldMode === 'dont_save' && nextSettings.autoSaveMode === 'auto_save') {
          const currentSession = await getValidatedActiveSessionForWindow(windowId);
          if (!currentSession) return;
          await saveSessionToDb(currentSession);

          chrome.runtime
            .sendMessage({
              action: 'session_tab_captured',
              sessionId: currentSession.sessionId,
              url: '',
              title: '',
              favIconUrl: '',
              capturedUrls: currentSession.capturedUrls,
              capturedNames: currentSession.capturedNames,
            })
            .catch(() => {});
        }
      }));

      if (activeEntries.length > 0) {
        persistActiveSessions();
        await refreshDeepFocusForRelevantTabs(sessionId);
      }
      sendResponse({ ok: true, updatedCount: activeEntries.length });
    })().catch(error => {
      console.error('[SessionFlow][background] Failed to update session settings:', error);
      sendResponse({ ok: false, error: 'update_session_settings_failed' });
    });
    return true;
  }

  if (request.action === 'update_active_session_urls') {
    const { sessionId, urls = [], names = [], windowId } = request;
    const targetWindowId =
      typeof windowId === 'number'
        ? windowId
        : typeof sender.tab?.windowId === 'number'
          ? sender.tab.windowId
          : undefined;
    void (async () => {
      const matchingSessionEntries: Array<[number, ActiveSessionEntry]> = [];
      for (const activeWindowId of Array.from(activeSessions.keys())) {
        const session = await getValidatedActiveSessionForWindow(activeWindowId);
        if (session?.sessionId === sessionId) {
          matchingSessionEntries.push([activeWindowId, session]);
        }
      }

      const fallbackWindowId =
        typeof targetWindowId === 'number'
          ? targetWindowId
          : matchingSessionEntries.length === 1
            ? matchingSessionEntries[0][0]
            : undefined;
      if (typeof fallbackWindowId !== 'number') {
        sendResponse({ ok: false, error: 'missing_window_id' });
        return;
      }

      const matchingSession = matchingSessionEntries.find(([windowId]) => windowId === fallbackWindowId)?.[1];
      if (!matchingSession) {
        sendResponse({ ok: false, error: 'session_not_running' });
        return;
      }

      matchingSession.capturedUrls = [...urls];
      matchingSession.capturedNames = [...names];
      activeSessions.set(fallbackWindowId, matchingSession);
      persistActiveSessions();
      await refreshDeepFocusForRelevantTabs(sessionId);
      sendResponse({ ok: true });
    })().catch(error => {
      console.error('[SessionFlow][background] Failed to update active session urls:', error);
      sendResponse({ ok: false, error: 'update_active_session_urls_failed' });
    });
    return true;
  }

  if (request.action === 'update_active_session_settings') {
    const { sessionId, openSettings } = request;
    if (!sessionId || !openSettings || typeof openSettings !== 'object') {
      sendResponse({ ok: false, error: 'missing_session_settings' });
      return false;
    }

    updateActiveSessionOpenSettings(String(sessionId), openSettings)
      .then(updatedCount => {
        sendResponse({ ok: true, updatedCount });
      })
      .catch(error => {
        console.error('[SessionFlow][background] Failed to update active session settings:', error);
        sendResponse({ ok: false, error: 'update_active_session_settings_failed' });
      });
    return true;
  }

  if (request.action === 'deep_focus_focus_pinned_tab') {
    const { sessionId } = request;
    const senderWindowId = sender.tab?.windowId;
    void (async () => {
      const candidateWindowId =
        typeof senderWindowId === 'number'
          ? senderWindowId
          : Array.from(activeSessions.entries()).find(([, session]) => session.sessionId === sessionId)?.[0];
      const session = typeof candidateWindowId === 'number'
        ? await getValidatedActiveSessionForWindow(candidateWindowId)
        : null;
      if (!session || session.sessionId !== sessionId) {
        sendResponse({ ok: false, error: 'no_pinned_tab' });
        return;
      }
      await chrome.windows.update(session.windowId, { focused: true });
      const tab = await chrome.tabs.update(session.pinnedTabId, { active: true }).catch(() => null);
      sendResponse(tab?.id ? { ok: true } : { ok: false, error: 'pinned_tab_focus_failed' });
    })().catch(error => {
      console.error('[DeepFocus] Failed to focus pinned tab:', error);
      sendResponse({ ok: false, error: 'pinned_tab_focus_failed' });
    });
    return true;
  }

  if (request.action === 'deep_focus_turn_off') {
    const { sessionId } = request;
    const senderWindowId = sender.tab?.windowId;
    void (async () => {
      for (const windowId of Array.from(activeSessions.keys())) {
        if (typeof senderWindowId === 'number' && windowId !== senderWindowId) continue;
        const session = await getValidatedActiveSessionForWindow(windowId);
        if (session?.sessionId === sessionId) {
          session.openSettings = {
            ...session.openSettings,
            deepFocusMode: false,
            focusWindow: false,
            pinSessionTab: true,
          } as SessionOpenSettings;
          activeSessions.set(windowId, session);
        }
      }
      persistActiveSessions();
      await refreshDeepFocusForRelevantTabs(sessionId);
      const existing = await db.sessions.get(sessionId);
      if (existing) {
        await db.sessions.update(sessionId, {
          sessionOpenSettings: {
            ...DEFAULT_SESSION_SETTINGS,
            ...(existing.sessionOpenSettings || {}),
            deepFocusMode: false,
            focusWindow: false,
          },
          updatedAt: Date.now(),
        });
      }
      sendResponse({ ok: true });
    })().catch(error => {
      console.error('[DeepFocus] Failed to persist turn-off:', error);
      sendResponse({ ok: false, error: 'deep_focus_turn_off_failed' });
    });
    return true;
  }

  if (request.action === 'deep_focus_add_allowed_domain') {
    const { sessionId, domain, url } = request;
    const senderWindowId = sender.tab?.windowId;
    const normalizedDomain = normalizeDeepFocusDomain(domain || url);
    if (!sessionId || !normalizedDomain) {
      sendResponse({ ok: false, error: 'missing_domain' });
      return false;
    }

    void (async () => {
      for (const windowId of Array.from(activeSessions.keys())) {
        if (typeof senderWindowId === 'number' && windowId !== senderWindowId) continue;
        const session = await getValidatedActiveSessionForWindow(windowId);
        if (session?.sessionId !== sessionId) continue;
        const nextDomains = Array.from(
          new Set([...(session.openSettings?.deepFocusAllowedDomains || []), normalizedDomain]),
        ).sort((a, b) => a.localeCompare(b));
        const nextBlockedDomains = (session.openSettings?.deepFocusBlockedDomains || []).filter(
          domain => normalizeDeepFocusDomain(domain) !== normalizedDomain,
        );
        session.openSettings = {
          ...session.openSettings,
          deepFocusAllowedDomains: nextDomains,
          deepFocusBlockedDomains: nextBlockedDomains,
          pinSessionTab: true,
        } as SessionOpenSettings;
        activeSessions.set(windowId, session);
      }
      persistActiveSessions();
      await refreshDeepFocusForRelevantTabs(sessionId);
      const existing = await db.sessions.get(sessionId);
      if (!existing) {
        sendResponse({ ok: true, domain: normalizedDomain });
        return;
      }
      const nextDomains = Array.from(
        new Set([...(existing.sessionOpenSettings?.deepFocusAllowedDomains || []), normalizedDomain]),
      ).sort((a, b) => a.localeCompare(b));
      const nextBlockedDomains = (existing.sessionOpenSettings?.deepFocusBlockedDomains || []).filter(
        domain => normalizeDeepFocusDomain(domain) !== normalizedDomain,
      );
      await db.sessions.update(sessionId, {
        sessionOpenSettings: {
          ...DEFAULT_SESSION_SETTINGS,
          ...(existing.sessionOpenSettings || {}),
          deepFocusAllowedDomains: nextDomains,
          deepFocusBlockedDomains: nextBlockedDomains,
        },
        updatedAt: Date.now(),
      });
      sendResponse({ ok: true, domain: normalizedDomain });
    })().catch(error => {
      console.error('[DeepFocus] Failed to add allowed domain:', error);
      sendResponse({ ok: false, error: 'deep_focus_add_domain_failed' });
    });
    return true;
  }

  if (request.action === 'deep_focus_should_block_url') {
    const url = request.url || sender.tab?.url || '';
    const tabId = sender.tab?.id || -1;
    void getDeepFocusBlockPayload(tabId, url)
      .then(blockPayload => {
        sendResponse({
          ok: true,
          blocked: Boolean(blockPayload),
          ...(blockPayload || {}),
        });
      })
      .catch(error => {
        console.error('[DeepFocus] failed to check content-script block state:', error);
        sendResponse({ ok: false, blocked: false, error: 'deep_focus_check_failed' });
      });
    return true;
  }

  if (request.action === 'set_active_dashboard_view_session') {
    const { viewId, sessionId, windowId } = request;
    const targetWindowId =
      typeof windowId === 'number'
        ? windowId
        : typeof sender.tab?.windowId === 'number'
          ? sender.tab.windowId
          : undefined;

    if (typeof targetWindowId !== 'number') {
      sendResponse({ ok: false, error: 'missing_window_id' });
      return false;
    }

    setActiveDashboardViewSession(targetWindowId, viewId || null, sessionId || null);
    sendResponse({
      ok: true,
      windowId: targetWindowId,
      viewId: activeDashboardViewSessionsByWindow.get(targetWindowId)?.viewId ?? null,
      sessionId: activeDashboardViewSessionsByWindow.get(targetWindowId)?.sessionId ?? null,
    });
    return false;
  }

  if (request.action === 'dashboard_view_navigated') {
    const nextViewId = typeof request.nextViewId === 'string' ? request.nextViewId.trim() : '';
    const previousViewId = typeof request.previousViewId === 'string' ? request.previousViewId.trim() : null;
    const previousSessionId = typeof request.previousSessionId === 'string' ? request.previousSessionId.trim() : null;
    const targetWindowId =
      typeof sender.tab?.windowId === 'number'
        ? sender.tab.windowId
        : typeof request.windowId === 'number'
          ? request.windowId
          : undefined;

    if (typeof targetWindowId !== 'number' || !nextViewId) {
      sendResponse({ ok: false, error: 'missing_navigation_context' });
      return false;
    }

    void activeSessionsRestorePromise
      .then(() => endDashboardViewSessionForNavigation(
        targetWindowId,
        nextViewId,
        previousViewId,
        previousSessionId,
      ))
      .then(result => sendResponse({ ok: true, windowId: targetWindowId, ...result }))
      .catch(error => {
        console.error('[SessionFlow][background] failed to end session on dashboard navigation', error);
        sendResponse({ ok: false, error: 'dashboard_navigation_cleanup_failed' });
      });
    return true;
  }

  if (request.action === 'get_active_sessions') {
    void activeSessionsRestorePromise
      .then(() => Promise.all(
        Array.from(activeSessions.keys()).map(windowId => getValidatedActiveSessionForWindow(windowId)),
      ))
      .then(() => {
        sendResponse({
          ok: true,
          active_sessions: Array.from(activeSessions.values()).map(session => ({
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            windowId: session.windowId,
            pinnedTabId: session.pinnedTabId,
            launchSource: session.launchSource,
          })),
          active_dashboard_view_session: {
            byWindow: Object.fromEntries(
              Array.from(activeDashboardViewSessionsByWindow.entries()).map(([windowId, entry]) => [String(windowId), entry]),
            ),
          },
        });
      })
      .catch(error => {
        console.error('[SessionFlow][background] failed to validate active sessions query', error);
        sendResponse({ ok: false, error: 'active_sessions_query_failed' });
      });
    return true;
  }

  if (request.action === 'get_active_session_status') {
    const targetWindowId =
      typeof sender.tab?.windowId === 'number'
        ? sender.tab.windowId
        : typeof request.windowId === 'number'
          ? request.windowId
          : undefined;
    if (typeof targetWindowId !== 'number') {
      sendResponse({ ok: false, error: 'missing_window_id' });
      return false;
    }

    void activeSessionsRestorePromise
      .then(() => getValidatedActiveSessionForWindow(targetWindowId))
      .then(session => {
        sendResponse({
          ok: true,
          windowId: targetWindowId,
          active_session: session
            ? {
                sessionId: session.sessionId,
                sessionName: session.sessionName,
                windowId: session.windowId,
                pinnedTabId: session.pinnedTabId,
                launchSource: session.launchSource,
                deepFocusMode: session.openSettings?.deepFocusMode === true,
              }
            : null,
        });
      })
      .catch(error => {
        console.error('[SessionFlow][background] failed to validate active session status', error);
        sendResponse({ ok: false, error: 'active_session_status_failed' });
      });
    return true;
  }

  if (request.action === 'end_session') {
    const { windowId, sessionId } = request;
    void (async () => {
      if (typeof windowId === 'number') {
        await stopActiveSessionRuntimeForWindow(windowId, 'end_session_message');
      } else if (sessionId) {
        for (const [activeWindowId, session] of Array.from(activeSessions.entries())) {
          if (session.sessionId === sessionId) {
            await stopActiveSessionRuntimeForWindow(activeWindowId, 'end_session_message');
          }
        }
      }
      sendResponse({ ok: true });
    })().catch(error => {
      console.error('[SessionFlow][background] Failed to end session:', error);
      sendResponse({ ok: false, error: 'end_session_failed' });
    });
    return true;
  }

  return undefined;
}

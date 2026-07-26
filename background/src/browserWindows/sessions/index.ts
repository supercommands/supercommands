/**
 * @file sessions.ts
 * @description Manages isolated browsing sessions within the extension.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { nowUtc } from '../../../../src/shared-components/utils';
import { generateEntityId } from '../../../../src/shared-components/utils/idGenerator';
import { db } from '../../../../src/storage/indexDB/dbConfig';
import { DEFAULT_SESSION_SETTINGS } from '../../../../src/allObjectFolder/src/createObject/session/sessionSettings';

export interface SessionOpenSettings {
  openMode: 'same_window' | 'new_window';
  autoSaveMode: 'auto_save' | 'dont_save';
  focusWindow?: boolean;
  pinSessionTab?: boolean;
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
  createdAt: string;
  initialTabUrls?: Record<number, string>;
  openSettings?: SessionOpenSettings;
}

export const activeSessions = new Map<number, ActiveSessionEntry>();

export async function restoreActiveSessions() {
  try {
    const result = await chrome.storage.local.get('active_sessions');
    const stored: ActiveSessionEntry[] = result.active_sessions || [];
    stored.forEach(s => activeSessions.set(s.windowId, s));
  } catch (e) {
    console.error('[Session] Failed to restore sessions:', e);
  }
}

restoreActiveSessions();

export function persistActiveSessions() {
  const sessions = Array.from(activeSessions.values());
  chrome.storage.local.set({ active_sessions: sessions }).catch(() => {});
}

export async function saveSessionToDb(session: ActiveSessionEntry) {
  try {
    const sessionRecord = await db.sessions.get(session.sessionId);
    if (!sessionRecord) return;

    const urlsAsLinkItems = session.capturedUrls.map((url, i) => {
      const existing = sessionRecord.urls?.find(u => u.url === url);
      return {
        id: existing?.id || generateEntityId('link'),
        url,
        title: session.capturedNames[i] || url,
        source: 'tab' as const,
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

export function handleSessionMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
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
      openSettings,
      currentTabId,
      currentWindowId,
      currentPageUrl,
    } = request;
    const sessionId = reqSessionId || generateEntityId('session');
    const encodedName = encodeURIComponent(sessionName);
    const pinnedTabUrl = chrome.runtime.getURL(
      `AltS_search_newtab/index.html?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
    );
    console.log(
      '[SessionFlow][background] start_session received',
      JSON.stringify(
        {
          sessionId,
          sessionName,
          workspaceId,
          folderId,
          initialUrlCount: initialUrls.length,
          pinnedTabUrl,
          settings: openSettings,
        },
        null,
        2,
      ),
    );

    chrome.storage.local
      .remove(`unsaved_session_backup_${sessionId}`)
      .catch(() => {})
      .then(() => {
        const activeEntries = [...activeSessions.values()];
        const alreadyActive = activeEntries.find(s => s.sessionId === sessionId);
        const settings: SessionOpenSettings = { ...DEFAULT_SESSION_SETTINGS, ...(openSettings || {}) };
        const useSameWindow = settings.openMode === 'same_window';
        const shouldFocusWindow = useSameWindow && settings.focusWindow === true;

        if (useSameWindow) {
          const senderWindowId = sender?.tab?.windowId ?? currentWindowId;
          const senderTabId = sender?.tab?.id ?? currentTabId;
          const senderTabUrl = sender?.tab?.url || currentPageUrl || '';
          const senderPageUrl = sender?.url || currentPageUrl || '';
          const extensionNewTabBase = chrome.runtime.getURL('AltS_search_newtab/');
          const isSenderExtensionTab =
            senderTabUrl.startsWith(extensionNewTabBase) ||
            senderPageUrl.startsWith(extensionNewTabBase) ||
            senderTabUrl.startsWith('chrome://newtab') ||
            senderTabUrl.startsWith('chrome://new-tab-page') ||
            senderTabUrl.startsWith('about:blank');

          if (alreadyActive && !shouldFocusWindow) {
            console.log(
              `[SessionFlow][background] Session ${sessionId} is already active in window ${alreadyActive.windowId}. Reusing same-window session tab.`,
            );
            chrome.windows.update(alreadyActive.windowId, { focused: true });
            if (alreadyActive.pinnedTabId && alreadyActive.pinnedTabId > 0) {
              chrome.tabs.update(alreadyActive.pinnedTabId, {
                active: true,
                pinned: settings.pinSessionTab !== false,
              });
            }
            sendResponse({ ok: true, sessionId, reused: true });
            return;
          }

          const openInWindow = (windowId: number) => {
            const existingSession = activeSessions.get(windowId);

            const finishSetup = (pinnedTabId: number, responseExtras: Record<string, any> = {}) => {
              const initialTabUrls: Record<number, string> = {};
              if (pinnedTabId > 0) {
                initialTabUrls[pinnedTabId] = pinnedTabUrl;
              }

              const validInitialUrls = initialUrls.filter(
                (url: string) => url && (url.startsWith('http') || url.startsWith('chrome-extension')),
              );
              const totalToOpen = validInitialUrls.length;

              const onAllTabsOpened = () => {
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
                };

                activeSessions.set(windowId, session);
                persistActiveSessions();
                sendResponse({ ok: true, sessionId, ...responseExtras });
              };

              if (totalToOpen === 0) {
                onAllTabsOpened();
                return;
              }

              let tabsOpened = 0;
              validInitialUrls.forEach((url: string) => {
                chrome.tabs.create({ url, windowId, active: false }, newTab => {
                  if (newTab?.id) {
                    initialTabUrls[newTab.id] = url;
                  }
                  tabsOpened++;
                  if (tabsOpened === totalToOpen) {
                    onAllTabsOpened();
                  }
                });
              });
            };

            const openPinnedTab = (responseExtras: Record<string, any> = {}) => {
              const shouldPin = settings.pinSessionTab !== false;
              const reuseCurrentExtensionTab = !!senderTabId && senderWindowId === windowId && isSenderExtensionTab;

              const openAfterPinnedTabReady = (pinnedTabId: number) => {
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

              if (reuseCurrentExtensionTab) {
                const reusableTabId = senderTabId as number;
                chrome.tabs.update(reusableTabId, { url: pinnedTabUrl, pinned: shouldPin, active: true }, pinnedTab => {
                  if (chrome.runtime.lastError || !pinnedTab) {
                    console.error('[Session] Failed to reuse current extension tab:', chrome.runtime.lastError);
                    sendResponse({ ok: false, error: 'pinned_tab_reuse_failed' });
                    return;
                  }
                  openAfterPinnedTabReady(pinnedTab.id ?? -1);
                });
                return;
              }

              chrome.tabs.create({ url: pinnedTabUrl, windowId, pinned: shouldPin, active: false }, pinnedTab => {
                if (chrome.runtime.lastError || !pinnedTab) {
                  console.error('[Session] Failed to create pinned tab:', chrome.runtime.lastError);
                  sendResponse({ ok: false, error: 'pinned_tab_create_failed' });
                  return;
                }
                openAfterPinnedTabReady(pinnedTab.id ?? -1);
              });
            };

            const launchSession = () => {
              openPinnedTab();
            };

            if (existingSession) {
              saveSessionToDb(existingSession);
              activeSessions.delete(windowId);
              persistActiveSessions();

              if (!shouldFocusWindow) {
                chrome.tabs.query({ windowId }, tabs => {
                  const keeperTabId = senderTabId || existingSession.pinnedTabId;
                  const tabsToClose = tabs.filter(t => t.id && t.id !== keeperTabId);
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

          if (senderWindowId) {
            openInWindow(senderWindowId);
          } else {
            chrome.windows.getCurrent({ populate: false }, currentWindow => {
              if (currentWindow?.id) {
                openInWindow(currentWindow.id);
              } else {
                sendResponse({ ok: false, error: 'no_window_found' });
              }
            });
          }
        } else {
          const validInitialUrls = initialUrls.filter(
            (url: string) => url && (url.startsWith('http') || url.startsWith('chrome-extension')),
          );
          const urlsToOpen = [pinnedTabUrl, ...validInitialUrls];
          chrome.windows.create({ url: urlsToOpen, type: 'normal', state: 'maximized', focused: true }, newWindow => {
            if (chrome.runtime.lastError || !newWindow) {
              console.error('[Session] Failed to create window:', chrome.runtime.lastError);
              sendResponse({ ok: false, error: 'window_create_failed' });
              return;
            }

            const pinnedTabId = newWindow.tabs?.[0]?.id ?? -1;
            console.log(
              '[SessionFlow][background] New window created. windowId:',
              newWindow.id,
              '| pinnedTabId:',
              pinnedTabId,
              '| tabCount:',
              newWindow.tabs?.length,
            );
            if (pinnedTabId > 0) {
              const shouldPin = settings.pinSessionTab !== false;
              console.log(`[SessionFlow][background] pinning tab: ${pinnedTabId} (pin: ${shouldPin})`);
              chrome.tabs.update(pinnedTabId, { pinned: shouldPin, active: true });
            } else {
              console.warn('[SessionFlow][background] pinnedTabId is invalid, tab will not be pinned');
            }

            const initialTabUrls: Record<number, string> = {};
            if (newWindow.tabs) {
              newWindow.tabs.forEach((t, index) => {
                if (t.id) {
                  const url = t.url || urlsToOpen[index];
                  if (url) {
                    initialTabUrls[t.id] = url;
                  }
                }
              });
            }

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
            };

            activeSessions.set(newWindow.id!, session);
            persistActiveSessions();
            console.log('[SessionFlow][background] session saved to activeSessions. windowId:', newWindow.id, '| sessionId:', sessionId);
            sendResponse({ ok: true, sessionId });
          });
        }
      });
    return true;
  }

  if (request.action === 'update_session_id') {
    const { oldSessionId, newSessionId } = request;
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.sessionId === oldSessionId) {
        session.sessionId = newSessionId;
        activeSessions.set(windowId, session);
        persistActiveSessions();
        break;
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'update_session_settings') {
    const { sessionId, openSettings } = request;
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.sessionId === sessionId) {
        const oldMode = session.openSettings?.autoSaveMode;
        const oldFocus = session.openSettings?.focusWindow;
        session.openSettings = openSettings;
        activeSessions.set(windowId, session);
        persistActiveSessions();

        const isSameWindow = openSettings.openMode === 'same_window';
        const focusTurnedOn = !oldFocus && openSettings.focusWindow === true;

        if (isSameWindow && focusTurnedOn) {
          chrome.tabs.query({ windowId }, tabs => {
            if (!activeSessions.has(windowId)) return;
            const currentSession = activeSessions.get(windowId);
            if (!currentSession) return;

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
          });
        }

        if (oldMode === 'dont_save' && openSettings.autoSaveMode === 'auto_save') {
          chrome.tabs.query({ windowId }, tabs => {
            if (!activeSessions.has(windowId)) return;
            const nonPinnedTabs = tabs.filter(t => t.id !== session.pinnedTabId && !t.url?.startsWith('chrome'));
            session.capturedUrls = nonPinnedTabs.map(t => t.url || '');
            session.capturedNames = nonPinnedTabs.map(t => t.title || (t.url ? new URL(t.url).hostname : ''));
            activeSessions.set(windowId, session);
            persistActiveSessions();
            saveSessionToDb(session);

            chrome.runtime
              .sendMessage({
                action: 'session_tab_captured',
                sessionId: session.sessionId,
                url: '',
                title: '',
                favIconUrl: '',
                capturedUrls: session.capturedUrls,
                capturedNames: session.capturedNames,
              })
              .catch(() => {});
          });
        }
        break;
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'update_active_session_urls') {
    const { sessionId, urls = [], names = [] } = request;
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.sessionId === sessionId) {
        session.capturedUrls = [...urls];
        session.capturedNames = [...names];
        activeSessions.set(windowId, session);
      }
    }
    persistActiveSessions();
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'end_session') {
    const { windowId, sessionId } = request;
    if (windowId !== undefined) {
      const session = activeSessions.get(windowId);
      if (session) {
        saveSessionToDb(session);
        activeSessions.delete(windowId);
        persistActiveSessions();
      }
    } else if (sessionId) {
      for (const [wId, session] of activeSessions.entries()) {
        if (session.sessionId === sessionId) {
          saveSessionToDb(session);
          activeSessions.delete(wId);
          persistActiveSessions();
        }
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  return undefined;
}

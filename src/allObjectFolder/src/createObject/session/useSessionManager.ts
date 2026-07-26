/**
 * @file useSessionManager.ts
 * @description Custom React hook managing active link-gathering sessions in extension windows/tabs,
 * including window change tracking, duplicate group name checking, and session lifecycle controls.
 *
 * @usage
 * ```tsx
 * import { useLinkSessionManager } from './useSessionManager';
 * const manager = useLinkSessionManager(handleTabCaptured);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Interface representing a browser session tracked for link gathering.
 */
export interface LinkSession {
  sessionId: string;
  sessionName: string;
  windowId: number;
}

export function useLinkSessionManager(onTabCaptured?: (tab: any) => void) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState<boolean>(false);
  const capturedTabsRef = useRef<Map<string, string>>(new Map());

  // Stable ref to chrome API â€” avoids triggering useEffect deps on every render
  const chromeRef = useRef<any>((window as any)?.chrome);
  const chromeAny = chromeRef.current;

  // Load active session for current window.
  useEffect(() => {
    if (!chromeAny?.storage?.local || !chromeAny?.windows || activeSessionId) return;

    chromeAny.windows.getCurrent((currentWindow: any) => {
      chromeAny.storage.local.get('active_sessions', (result: any) => {
        const sessions: LinkSession[] = result.active_sessions || [];
        const matchedSession = sessions.find((s) => s.windowId === currentWindow.id);
        if (matchedSession) {
          setSessionName(matchedSession.sessionName);
          setActiveSessionId(matchedSession.sessionId);
        }
      });
    });
  }, [activeSessionId]);

  /**
   * Validates if a session name is duplicate
   */
  const validateSessionName = useCallback(
    (name: string, onResult: (isValid: boolean, errorMsg: string | null) => void) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        onResult(false, 'Tab Session name is required');
        return;
      }

      if (!chromeAny?.storage?.local) {
        onResult(true, null);
        return;
      }

      chromeAny.storage.local.get('active_sessions', (res: any) => {
        const activeSessions: LinkSession[] = res.active_sessions || [];
        const duplicateActive = activeSessions.some(
          (s) =>
            s.sessionName?.toLowerCase() === trimmedName.toLowerCase() &&
            String(s.sessionId || '') !== String(activeSessionId || '')
        );

        if (duplicateActive) {
          onResult(false, 'A Tab Session with this name is currently active.');
        } else {
          onResult(true, null);
        }
      });
    },
    []
  );

  // Listen for real-time session tab captures from the background script
  useEffect(() => {
    capturedTabsRef.current.clear();
  }, [activeSessionId]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'session_tab_captured') {
        if (activeSessionId && message.sessionId === activeSessionId) {
          if (!message.url) {
            return;
          }

          const captureKey = message.tabId ? `tab:${String(message.tabId)}` : String(message.url);
          const url = message.url;
          if (capturedTabsRef.current.has(captureKey)) {
            const previousUrl = capturedTabsRef.current.get(captureKey);
            if (previousUrl === url) {
              return; // Fully duplicate (same tab, same url)
            }
          }
          capturedTabsRef.current.set(captureKey, url);

          const tabData = {
            id: String(Date.now() + Math.random()),
            name: message.title || message.url,
            url: message.url,
            source: 'tab' as const,
            favIconUrl: message.favIconUrl || '',
            originalData: message.tabId ? { id: message.tabId } : undefined,
          };
          if (onTabCaptured) {
            onTabCaptured(tabData);
          }
        }
      }
    };

    if (chromeAny?.runtime?.onMessage) {
      chromeAny.runtime.onMessage.addListener(handleMessage);
      return () => chromeAny.runtime.onMessage.removeListener(handleMessage);
    }
    return () => {};
  }, [activeSessionId, onTabCaptured]);

  return {
    activeSessionId,
    setActiveSessionId,
    sessionName,
    setSessionName,
    sessionError,
    setSessionError,
    isStartingSession,
    setIsStartingSession,
    validateSessionName,
  };
}

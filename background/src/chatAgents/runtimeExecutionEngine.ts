/**
 * @file queue.ts
 * @description Manages automation for submitting prompts and data to AI platforms.
 * Handles the injection of prompts, including text and images, into
 * various AI chatbot interfaces (like ChatGPT, Claude, Gemini, etc.). Manages
 * prompt queues per tab, tracking completion status, and simulating user interactions
 * to automatically trigger submission on the target page.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeAgentSubmit } from '.';
import type { AutoSubmitRequest } from '@automation/runtime_Execution_Engine/runner';
import { executeTrustedDriveFlow } from '@automation/integrations/googleDriveSync';

export interface PendingAiSession {
  id: string;
  prompt: string;
  models: string[];
  tabIds: number[];
  urls: Record<string, string>;
  timestamp: number;
  aiPromptId?: string;
}

export const pendingAiSessions = new Map<string, PendingAiSession>();

// Track prompt queues per tab to handle sequential submission
export const tabPromptQueues = new Map<number, AutoSubmitRequest[]>();
export const processingTabs = new Set<number>();

let stateRestoredPromise: Promise<void> | null = null;
/**
 * Ensures that the queue state (pending sessions, tab queues, processing status)
 * is fully restored from chrome.storage.session before processing new items.
 *
 * @returns {Promise<void>} A promise that resolves when state is restored.
 */
export function ensureStateRestored() {
  if (!stateRestoredPromise) {
    stateRestoredPromise = (async () => {
      if (!chrome.storage?.session) return;
      const data = await chrome.storage.session.get(['pendingAiSessions', 'tabPromptQueues', 'processingTabs']);
      if (data.pendingAiSessions) {
        try {
          const parsed = JSON.parse(data.pendingAiSessions);
          for (const [k, v] of Object.entries(parsed)) pendingAiSessions.set(k, v as any);
        } catch (e) {}
      }
      if (data.tabPromptQueues) {
        try {
          const parsed = JSON.parse(data.tabPromptQueues);
          for (const [k, v] of Object.entries(parsed)) tabPromptQueues.set(Number(k), v as any);
        } catch (e) {}
      }
      if (data.processingTabs) {
        try {
          const parsed = JSON.parse(data.processingTabs);
          parsed.forEach((v: number) => processingTabs.add(v));
        } catch (e) {}
      }
    })();
  }
  return stateRestoredPromise;
}

/**
 * Persists the current queue state (pending sessions, tab queues, processing status)
 * to chrome.storage.session to survive service worker restarts.
 */
export function persistState() {
  if (!chrome.storage?.session) return;
  chrome.storage.session
    .set({
      pendingAiSessions: JSON.stringify(Object.fromEntries(pendingAiSessions)),
      tabPromptQueues: JSON.stringify(Object.fromEntries(tabPromptQueues)),
      processingTabs: JSON.stringify(Array.from(processingTabs)),
    })
    .catch(() => {});
}

// Override Map/Set methods to auto-persist
const _aiSet = pendingAiSessions.set.bind(pendingAiSessions);
pendingAiSessions.set = (k, v) => {
  const r = _aiSet(k, v);
  persistState();
  return r;
};
const _aiDel = pendingAiSessions.delete.bind(pendingAiSessions);
pendingAiSessions.delete = k => {
  const r = _aiDel(k);
  persistState();
  return r;
};

const _tpqSet = tabPromptQueues.set.bind(tabPromptQueues);
tabPromptQueues.set = (k, v) => {
  const r = _tpqSet(k, v);
  persistState();
  return r;
};
const _tpqDel = tabPromptQueues.delete.bind(tabPromptQueues);
tabPromptQueues.delete = k => {
  const r = _tpqDel(k);
  persistState();
  return r;
};

const _ptAdd = processingTabs.add.bind(processingTabs);
processingTabs.add = k => {
  const r = _ptAdd(k);
  persistState();
  return r;
};
const _ptDel = processingTabs.delete.bind(processingTabs);
processingTabs.delete = k => {
  const r = _ptDel(k);
  persistState();
  return r;
};

/**
 * Processes the next prompt in the queue for a given tab.
 * Manages processing locks to prevent overlapping submissions and applies a
 * safety timeout to unblock stuck queues.
 *
 * @param tabId The ID of the tab whose queue should be processed.
 */
export async function processTabQueue(tabId: number) {
  if (processingTabs.has(tabId)) {
    return;
  }

  const queue = tabPromptQueues.get(tabId);
  if (!queue || queue.length === 0) {
    return;
  }

  const nextRequest = queue[0]; // Peek
  processingTabs.add(tabId);

  // Safety Timeout: Unblock after 30 seconds
  setTimeout(() => {
    if (processingTabs.has(tabId)) {
      console.warn('[BG-v2] Safety timeout reached for tab', tabId, '- unblocking queue');
      processingTabs.delete(tabId);
      processTabQueue(tabId);
    }
  }, 30000);

  queue.shift();

  try {
    await executeAutoSubmit(tabId, nextRequest);
    processingTabs.delete(tabId);
    processTabQueue(tabId); // Process next in queue
  } catch (err) {
    console.error('[BG-v2] Error processing tab queue:', err);
    processingTabs.delete(tabId);
    setTimeout(() => processTabQueue(tabId), 2000);
  }
}

/**
 * Executes a single auto-submit request on a specific tab.
 * Routes requests to either the Google Drive integration or the general AI agent handler.
 *
 * @param tabId The ID of the target tab.
 * @param request The auto-submit configuration (kind, prompt, images).
 */
export async function executeAutoSubmit(tabId: number, request: AutoSubmitRequest) {
  if (request.kind === 'drive') {
    try {
      await executeTrustedDriveFlow(tabId, request.images || []);
      return;
    } catch (err) {
      console.error('[BG-v2] Drive TrustedDriveFlow failed:', err);
      return;
    }
  }
  await executeAgentSubmit(tabId, request);
}

/**
 * Handles incoming messages related to AI chat session status and prompt injection.
 * Unblocks the tab queue when a prompt is successfully injected.
 *
 * @param request The message payload.
 * @param sender The sender information.
 * @param sendResponse The callback for asynchronous responses.
 * @returns {boolean | undefined} True if the message is handled asynchronously.
 */
export function handleAiMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
  if (request.action === 'prompt_injected_success') {
    const { tabId } = request;
    processingTabs.delete(tabId);
    // Give the AI a moment to start generating before sending the next one
    setTimeout(() => processTabQueue(tabId), 2000);
    sendResponse({ ok: true });
    return true;
  }
  return undefined;
}

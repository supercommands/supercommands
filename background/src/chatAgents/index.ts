/**
 * @file index.ts
 * @description Central router for AI chat agent interactions.
 * Dispatches auto-submit requests to the appropriate platform-specific handler
 * based on the requested agent kind (ChatGPT, Claude, Gemini, Perplexity).
 */

import { executeChatGPTSubmit } from './models/chatGpt';
import { executeClaudeSubmit } from './models/claude';
import { executeGeminiSubmit } from './models/gemini';
import { executePerplexitySubmit } from './models/perplexity';
import type { AutoSubmitRequest } from './types';

/**
 * Routes an auto-submit request to the specific provider's handler function.
 * Handles platform-specific preprocessing (e.g., focusing the tab for Perplexity)
 * before dispatching the request.
 *
 * @param tabId The ID of the tab containing the AI platform.
 * @param request The auto-submit configuration detailing the prompt and target platform.
 */
export async function executeAgentSubmit(tabId: number, request: AutoSubmitRequest) {
  let kind = request.kind;

  if (kind === 'calendar') {
    kind = 'gemini';
  }

  switch (kind) {
    case 'chatgpt':
      return executeChatGPTSubmit(tabId, request);
    case 'claude':
      return executeClaudeSubmit(tabId, request);
    case 'gemini':
      return executeGeminiSubmit(tabId, request);
    case 'perplexity':
      // focus logic for perplexity
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.active) {
          await chrome.tabs.update(tabId, { active: true });
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) {
        console.warn('[auto-submit] Failed to check/focus perplexity tab:', e);
      }
      return executePerplexitySubmit(tabId, request);
    default:
      console.warn('[chatAgents] Unsupported agent kind:', kind);
      return;
  }
}

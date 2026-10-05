import {
  readWebsitePopupAgentModels,
  resolveWebsitePopupModelDestination,
} from '../../../src/shared-components/websitePopup/websitePopupModelSelection';
import {
  resolveEnabledAiPromptModels,
  getExcludedAiPromptModelIdsAsync,
} from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import type { AiPromptRecord } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';

/** Background execution authority for Website Popup. */

import { db } from '../../../src/storage/indexDB/dbConfig';

import { handleExtractorMessage } from '../all_PreBuilt_Commands/extraction';
import {
  closeDuplicateTabs,
  mergeAllWindows,
  muteAllTabs,
  unmuteAllTabs,
} from '../all_PreBuilt_Commands/system/windowManager';
import { handleBrowserWindowMessage } from '../browserWindows';

import { notifyWebsitePopup } from './websitePopupNotificationAdapter';
import { composeWebsitePopupAgentPrompt } from './websitePopupPromptComposition';

import type {
  WebsitePopupExecutionBridgeRequest,
  WebsitePopupExecutionBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
type ExecutionBridgeSendResponse = (response: WebsitePopupExecutionBridgeResponse) => void;
const notifyPageExtractionSuccess = (
  sender: chrome.runtime.MessageSender,
  actionId: string,
  response?: { count?: number },
) => {
  if (actionId === 'downloadallimages') return notifyWebsitePopup(sender, '🖼️ Downloading all images.', 'success');
  if (actionId === 'downloadalltables') return notifyWebsitePopup(sender, '📊 Downloading all tables.', 'success');
  if (actionId === 'capture_visible_screenshot')
    return notifyWebsitePopup(sender, '📸 Screenshot saved to Downloads', 'success');
  if (actionId === 'capture_clip_screenshot')
    return notifyWebsitePopup(sender, '📋 Image copied to Clipboard & saved to Downloads!', 'success');
  if (actionId.startsWith('capture_full_page_')) {
    const format = actionId.replace('capture_full_page_', '').toUpperCase();
    return notifyWebsitePopup(sender, `📄 Full page screenshot saved as ${format}`, 'success');
  }
  if (actionId === 'merge_windows') return notifyWebsitePopup(sender, '🪟 All windows merged!', 'success');
  if (actionId === 'close_duplicate_tabs') {
    const count = Number(response?.count || 0);
    return notifyWebsitePopup(
      sender,
      count > 0 ? `🗑️ Closed ${count} duplicate tab${count > 1 ? 's' : ''}!` : '👍 No duplicate tabs found!',
      'success',
    );
  }
  if (actionId === 'mute_all_tabs' || actionId === 'unmute_all_tabs') {
    const count = Number(response?.count || 0);
    const verb = actionId === 'mute_all_tabs' ? 'Muted' : 'Unmuted';
    const icon = actionId === 'mute_all_tabs' ? '🔇' : '🔊';
    return notifyWebsitePopup(
      sender,
      count > 0
        ? `${icon} ${verb} ${count} tab${count > 1 ? 's' : ''}!`
        : `👍 No tabs to ${actionId === 'mute_all_tabs' ? 'mute' : 'unmute'}!`,
      'success',
    );
  }
  return notifyWebsitePopup(sender, `❌ Unsupported page extraction action: ${actionId}`, 'error');
};

const EXTRACTION_ACTIONS: Record<string, string> = {
  capture_visible_screenshot: 'CAPTURE_VISIBLE_TAB',
  capture_clip_screenshot: 'CAPTURE_AND_CLIP_VISIBLE_TAB',
  capture_full_page_png: 'CAPTURE_FULL_PAGE_PNG',
  capture_full_page_jpg: 'CAPTURE_FULL_PAGE_JPG',
  capture_full_page_pdf: 'CAPTURE_FULL_PAGE_PDF',
  downloadallimages: 'execute_image_download',
  downloadalltables: 'execute_table_download',
};

const buildSummaryPrompt = (context: { url: string; title: string; text: string }) => {
  const question = 'Summarize the main points, key takeaways, and outline of this page.';
  return context.text
    ? [
        `User Question: ${question}`,
        `I'm looking at a webpage titled "${context.title}" (${context.url}).`,
        `Here is the page content for context:\n---\n${context.text}\n---`,
      ].join('\n\n')
    : `Summarize this page for me: ${context.url}`;
};

const inferAutoSubmitKind = (url: string): 'chatgpt' | 'claude' | 'gemini' | 'perplexity' => {
  const normalized = url.toLowerCase();
  if (normalized.includes('claude.ai')) return 'claude';
  if (normalized.includes('gemini.google.com')) return 'gemini';
  if (normalized.includes('perplexity.ai')) return 'perplexity';
  return 'chatgpt';
};

const buildAgentPrompt = (basePrompt: string, context: { url: string; title: string; text: string }) =>
  [
    basePrompt.trim() || 'Use this webpage context.',
    'Triggered from Website Popup: Send to Agent',
    `Title: ${context.title || 'Untitled Page'}`,
    `URL: ${context.url}`,
    context.text ? `Page content:\n---\n${context.text}\n---` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

export function handleWebsitePopupPageOperation(
  operation: WebsitePopupExecutionBridgeRequest['operation'],
  sender: chrome.runtime.MessageSender,
  sendResponse: ExecutionBridgeSendResponse,
): boolean {
  if (operation.kind === 'execute-page-extraction') {
    const underlyingAction = EXTRACTION_ACTIONS[operation.actionId];
    if (underlyingAction) {
      return Boolean(
        handleExtractorMessage(
          {
            action: underlyingAction,
            downloadType: 'all',
            options: {},
          },
          sender,
          response => {
            if (response?.success === false || response?.ok === false) {
              notifyWebsitePopup(sender, response?.error || 'Page extraction failed.', 'error');
              sendResponse({ success: false, error: response?.error || 'Page extraction failed.' });
              return;
            }
            notifyPageExtractionSuccess(sender, operation.actionId, response);
            sendResponse({
              success: true,
              outcome: { status: 'action-executed', actionId: operation.actionId },
            });
          },
        ),
      );
    }

    void (async () => {
      try {
        let response: { count?: number } | undefined;
        if (operation.actionId === 'merge_windows') await mergeAllWindows();
        else if (operation.actionId === 'close_duplicate_tabs') response = { count: await closeDuplicateTabs() };
        else if (operation.actionId === 'mute_all_tabs') response = { count: await muteAllTabs() };
        else if (operation.actionId === 'unmute_all_tabs') response = { count: await unmuteAllTabs() };
        else throw new Error(`Unsupported page extraction action: ${operation.actionId}`);

        notifyPageExtractionSuccess(sender, operation.actionId, response);
        sendResponse({
          success: true,
          outcome: { status: 'action-executed', actionId: operation.actionId },
        });
      } catch (error: unknown) {
        notifyWebsitePopup(sender, `❌ ${error instanceof Error ? error.message : String(error)}`, 'error');
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (operation.kind === 'summarize-page') {
    const delegated = handleBrowserWindowMessage(
      {
        action: 'open_tab_with_auto_submit',
        url: 'https://chatgpt.com/',
        autoSubmit: {
          kind: 'chatgpt',
          prompt: buildSummaryPrompt(operation.context),
        },
        active: true,
        forceNewTab: true,
      },
      sender,
      response => {
        if (response?.success === false) {
          notifyWebsitePopup(sender, response?.error || 'Unable to start page summary.', 'error');
          sendResponse({ success: false, error: response?.error || 'Unable to start page summary.' });
          return;
        }
        notifyWebsitePopup(sender, 'Page summary started.', 'success');
        sendResponse({
          success: true,
          outcome: { status: 'action-executed', actionId: 'summarize_page' },
        });
      },
    );
    return Boolean(delegated);
  }

  if (operation.kind === 'send-to-agent') {
    void (async () => {
      try {
        const record =
          operation.targetKind === 'agent'
            ? await db.chatAgents.get(operation.targetId)
            : await db.aiPrompts.get(operation.targetId);
        if (!record || ('deletedAt' in record && record.deletedAt)) throw new Error('The selected agent or prompt no longer exists.');

        const modelSelection =
          operation.targetKind === 'agent'
            ? readWebsitePopupAgentModels((record as ChatAgentRecord).urls || [])
            : {
                enabledModelIds: resolveEnabledAiPromptModels(
                  record as AiPromptRecord,
                  await getExcludedAiPromptModelIdsAsync(),
                ).map(model => model.id),
                modelUrls: (record as AiPromptRecord).modelUrls || {},
                customModels: (record as AiPromptRecord).customModels || [],
              };
        const targetUrl = resolveWebsitePopupModelDestination(modelSelection);
        const composed = operation.composition !== undefined;
        const prompt = operation.composition !== undefined
          ? await composeWebsitePopupAgentPrompt(record.prompt || '', operation.composition)
          : buildAgentPrompt(record.prompt || '', operation.context);
        const delegated = handleBrowserWindowMessage(
          {
            action: 'open_tab_with_auto_submit',
            url: targetUrl,
            autoSubmit: { kind: inferAutoSubmitKind(targetUrl), prompt },
            active: true,
            forceNewTab: true,
          },
          sender,
          response => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError || (response?.ok !== true && response?.success !== true) || typeof response?.tabId !== 'number') {
              const error = runtimeError?.message || response?.error || 'Unable to send the prompt.';
              notifyWebsitePopup(sender, error, 'error');
              sendResponse({ success: false, error });
              return;
            }
            notifyWebsitePopup(sender, composed ? 'Prompt sent to agent.' : 'Page sent to agent.', 'success');
            sendResponse({
              success: true,
              outcome: { status: 'action-executed', actionId: 'send_to_agent' },
            });
          },
        );
        if (!delegated) throw new Error('The agent execution adapter did not accept the request.');
      } catch (error: unknown) {
        notifyWebsitePopup(sender, error instanceof Error ? error.message : String(error), 'error');
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  return false;
}

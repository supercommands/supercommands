import { broadcastWebsitePopupEntityChanges } from './broadcastWebsitePopupChanges';
/** Background execution authority for Website Popup. */

import {
  isWebsitePopupExecutionBridgeRequest,
  WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION,
  type WebsitePopupExecutionBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';

import { saveWebsitePopupPageToEntity } from './websitePopupSavePageEntityAdapter';
import { saveWebsitePopupChatToTarget } from './websitePopupSaveChatAdapter';
import { notifyWebsitePopup } from './websitePopupNotificationAdapter';

type ExecutionBridgeSendResponse = (response: WebsitePopupExecutionBridgeResponse) => void;
import { handleWebsitePopupCreateOperation } from './createExecutionHandler';
import { handleWebsitePopupResultOperation } from './resultExecutionHandler';
import { handleWebsitePopupPageOperation } from './pageExecutionHandler';
export function handleWebsitePopupExecutionBridgeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  reply: ExecutionBridgeSendResponse,
): boolean {
  if (!isWebsitePopupExecutionBridgeRequest(message)) {
    if (
      message &&
      typeof message === 'object' &&
      'action' in message &&
      message.action === WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION
    ) {
      const request = message as Record<string, unknown>;
      const operation = request.operation && typeof request.operation === 'object'
        ? request.operation as Record<string, unknown> : undefined;
      console.error('[WebsitePopup execution] Invalid request', {
        action: WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION,
        requestId: request.requestId,
        kind: operation?.kind,
        entity: operation?.entity,
      });
      reply({ success: false, error: 'Invalid website popup operation.' });
      return true;
    }
    return false;
  }

  const operation = message.operation;
  const startedAt = Date.now();
  const context = {
    requestId: message.requestId,
    action: WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION,
    kind: operation.kind,
    tabId: sender.tab?.id,
    frameId: sender.frameId,
    version: chrome.runtime.getManifest().version,
  };
  console.info('[WebsitePopup execution] Background received', context);
  const pendingWarning = setTimeout(() => {
    console.warn('[WebsitePopup execution] Background operation still pending', { ...context, elapsedMs: Date.now() - startedAt });
  }, 10000);
  const sendResponse: ExecutionBridgeSendResponse = response => {
    clearTimeout(pendingWarning);
    const details = { ...context, elapsedMs: Date.now() - startedAt, success: response.success, status: response.success ? response.outcome.status : undefined, error: response.success === false ? response.error : undefined };
    if (response.success) console.info('[WebsitePopup execution] Background response', details);
    else console.error('[WebsitePopup execution] Background rejected', details);
    reply(response);
  };
  if (operation.kind === 'save-chat-to-target') {
    void (async () => {
      try {
        const saved = await saveWebsitePopupChatToTarget(operation.entity, operation.targetId, operation.page);
        await broadcastWebsitePopupEntityChanges(saved.changedTables);
        notifyWebsitePopup(sender, saved.changed ? `Added conversation to "${saved.title}" successfully` : `"${saved.title}" already contains this conversation`, 'success');
        sendResponse({ success: true, outcome: { status: 'chat-saved', entity: saved.entity, targetId: saved.targetId, title: saved.title, changed: saved.changed } });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        notifyWebsitePopup(sender, messageText, 'error');
        sendResponse({ success: false, error: messageText });
      }
    })();
    return true;
  }
  if (
    handleWebsitePopupResultOperation(operation, sender, sendResponse) ||
    handleWebsitePopupCreateOperation(operation, sender, sendResponse) ||
    handleWebsitePopupPageOperation(operation, sender, sendResponse)
  )
    return true;
  if (operation.kind === 'save-page-to-entity') {
    void (async () => {
      try {
        const saved = await saveWebsitePopupPageToEntity(operation.entity, operation.targetId, operation.page);
        await broadcastWebsitePopupEntityChanges(saved.changedTables);
        notifyWebsitePopup(
          sender,
          saved.changed ? `Added page to "${saved.title}" successfully` : `"${saved.title}" already contains this page`,
          'success',
        );
        sendResponse({
          success: true,
          outcome: {
            status: 'page-saved',
            entity: saved.entity,
            targetId: saved.targetId,
            title: saved.title,
            changed: saved.changed,
          },
        });
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        notifyWebsitePopup(sender, messageText || 'Failed to save this page.', 'error');
        sendResponse({ success: false, error: messageText || 'Failed to save this page.' });
      }
    })();
    return true;
  }

  notifyWebsitePopup(sender, 'Unsupported website popup execution operation.', 'error');
  sendResponse({ success: false, error: 'Unsupported website popup execution operation.' });
  return false;
}

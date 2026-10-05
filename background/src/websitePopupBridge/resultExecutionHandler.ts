import { broadcastWebsitePopupEntityChanges } from './broadcastWebsitePopupChanges';
/** Background execution authority for Website Popup. */
import { buildCommandTerminalNewtabPath } from '../../../src/shared-components/commandTerminal/runtime/launch';
import { getWebsitePopupEntityLaunchType } from '../../../src/shared-components/websitePopup/websitePopupEntityRecords';
import { openWebCollection } from '../collections/openWebCollection';

import { notifyWebsitePopup } from './websitePopupNotificationAdapter';

import { updateWebsitePopupExistingTextCommand } from './websitePopupExistingTextCommand';
import {
  getWebsitePopupResultFavorite,
  getWebsitePopupResultHotkey,
  setWebsitePopupResultFavorite,
  setWebsitePopupResultHotkey,
  syncWebsitePopupResultFavoriteLabel,
  updateWebsitePopupResultEntity,
} from './websitePopupResultEditAdapter';

import type {
  WebsitePopupExecutionBridgeRequest,
  WebsitePopupExecutionBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
type ExecutionBridgeSendResponse = (response: WebsitePopupExecutionBridgeResponse) => void;
/** Shared entity launch used by popup activation and omnibox Open all. */
export async function openTextCommandEntity(type: string, id: string) {
  if (type === 'webCollection') return openWebCollection(id);
  const path = buildCommandTerminalNewtabPath({ triggerHotkey: true, type, id });
  await chrome.tabs.create({ url: chrome.runtime.getURL(path), active: true });
}
export function handleWebsitePopupResultOperation(
  operation: WebsitePopupExecutionBridgeRequest['operation'],
  sender: chrome.runtime.MessageSender,
  sendResponse: ExecutionBridgeSendResponse,
): boolean {
  if (operation.kind === 'open-web-collection' || operation.kind === 'open-web-collection-item') {
    void (async () => {
      try {
        await openWebCollection(operation.collectionId, operation.organisationId,
          operation.kind === 'open-web-collection-item' ? operation.itemId : undefined);
        sendResponse({ success: true, outcome: { status: 'action-executed', actionId: operation.kind } });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }
  if (operation.kind === 'get-result-hotkey' || operation.kind === 'set-result-hotkey') {
    void (async () => {
      try {
        const value =
          operation.kind === 'set-result-hotkey'
            ? await setWebsitePopupResultHotkey(
                operation.entity,
                operation.targetId,
                operation.value || '',
                operation.approval,
              )
            : await getWebsitePopupResultHotkey(operation.entity, operation.targetId);
        if (operation.kind === 'set-result-hotkey') {
          await broadcastWebsitePopupEntityChanges(['hotkeysMap']).catch(() => undefined);
        }
        sendResponse({
          success: true,
          outcome: {
            status: operation.kind === 'set-result-hotkey' ? 'hotkey-updated' : 'hotkey-state',
            entity: operation.entity,
            targetId: operation.targetId,
            value,
          },
        });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }
  if (operation.kind === 'get-result-favorite' || operation.kind === 'set-result-favorite') {
    void (async () => {
      try {
        const favorite =
          operation.kind === 'set-result-favorite'
            ? await setWebsitePopupResultFavorite(operation.entity, operation.targetId, Boolean(operation.favorite))
            : await getWebsitePopupResultFavorite(operation.entity, operation.targetId);
        if (operation.kind === 'set-result-favorite') {
          await broadcastWebsitePopupEntityChanges(['favorites']).catch(() => undefined);
        }
        sendResponse({
          success: true,
          outcome: {
            status: operation.kind === 'set-result-favorite' ? 'favorite-updated' : 'favorite-state',
            entity: operation.entity,
            targetId: operation.targetId,
            favorite,
          },
        });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }
  if (operation.kind === 'update-result-entity') {
    void (async () => {
      try {
        const table = await updateWebsitePopupResultEntity(
          operation.entity,
          operation.targetId,
          operation.expectedUpdatedAt,
          operation.changes,
          operation.expectedBookmark,
        );
        const favoriteLabelChanged = await syncWebsitePopupResultFavoriteLabel(
          operation.entity,
          operation.targetId,
          operation.changes.title.trim(),
        ).catch(() => false);
        await broadcastWebsitePopupEntityChanges([table, ...(favoriteLabelChanged ? ['favorites'] : [])]).catch(
          () => undefined,
        );
        sendResponse({
          success: true,
          outcome: {
            status: 'entity-updated',
            entity: operation.entity,
            targetId: operation.targetId,
          },
        });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }
  if (operation.kind === 'update-item-text-command') {
    void (async () => {
      try {
        const updated = await updateWebsitePopupExistingTextCommand(
          operation.entity,
          operation.targetId,
          operation.value,
          operation.approval,
          operation.expectedValue,
          operation.expectedReferenceId,
        );
        await broadcastWebsitePopupEntityChanges([
          'userShortcuts',
          updated.changedTable,
          ...(operation.approval?.kind === 'command' ? ['commands'] : []),
        ]);
        notifyWebsitePopup(sender, updated.value ? 'Text Command saved' : 'Text Command removed', 'success');
        sendResponse({
          success: true,
          outcome: {
            status: 'text-command-updated',
            entity: operation.entity,
            targetId: operation.targetId,
            value: updated.value,
            referenceId: updated.referenceId,
          },
        });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }
  if (operation.kind === 'open-entity' || operation.kind === 'open-entity-editor') {
    void (async () => {
      try {
        if (operation.kind === 'open-entity-editor') {
          const path = buildCommandTerminalNewtabPath({
            altsAction: true,
            editMode: true,
            // Popup collections are saved Session records, not dashboard collection views.
            type: getWebsitePopupEntityLaunchType(operation.entity),
            entityId: operation.targetId,
          });
          await chrome.tabs.create({ url: chrome.runtime.getURL(path), active: true });
        } else {
          await openTextCommandEntity(getWebsitePopupEntityLaunchType(operation.entity), operation.targetId);
        }
        sendResponse({
          success: true,
          outcome: {
            status: 'entity-opened',
            entity: operation.entity,
            targetId: operation.targetId,
          },
        });
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  return false;
}

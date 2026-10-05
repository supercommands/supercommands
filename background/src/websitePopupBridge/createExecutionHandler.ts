import { broadcastWebsitePopupEntityChanges } from './broadcastWebsitePopupChanges';
/** Background execution authority for Website Popup. */

import { db } from '../../../src/storage/indexDB/dbConfig';

import type { WebsitePopupBaseCreateEntity } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';

import { handleTodoMessage } from '../todos/todos';
import { createWebsitePopupBaseEntity } from './websitePopupCreateEntityAdapter';

import { notifyWebsitePopup } from './websitePopupNotificationAdapter';
import { assignWebsitePopupCreatedFavorite } from './websitePopupFavoriteAssignment';

import {
  assertWebsitePopupTextCommandAvailable,
  assignWebsitePopupCreatedTextCommand,
} from './websitePopupTextCommandAssignment';
import { assertWebsitePopupHotkeyAvailable, assignWebsitePopupCreatedHotkey } from './websitePopupHotkeyBridgeHandler';
import type { WebsitePopupHotkeyConflict } from '../../../src/shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';

import type {
  WebsitePopupExecutionBridgeRequest,
  WebsitePopupExecutionBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
type ExecutionBridgeSendResponse = (response: WebsitePopupExecutionBridgeResponse) => void;
const finishWebsitePopupCreatedEntity = async (
  sender: chrome.runtime.MessageSender,
  sendResponse: ExecutionBridgeSendResponse,
  entity: WebsitePopupBaseCreateEntity,
  entityId: string,
  title: string,
  createAnother: boolean,
  favorite: boolean,
) => {
  if (favorite) {
    try {
      await assignWebsitePopupCreatedFavorite(entity, entityId, title);
      await broadcastWebsitePopupEntityChanges(['favorites']);
    } catch (error: unknown) {
      sendResponse({
        success: true,
        outcome: {
          status: 'entity-created-favorite-pending',
          entity,
          entityId,
          title,
          createAnother,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return;
    }
  }
  notifyWebsitePopup(sender, `Created "${title}" successfully`, 'success');
  sendResponse({
    success: true,
    outcome: {
      status: 'entity-created',
      entity,
      entityId,
      title,
      createAnother,
    },
  });
};

/** Stops the post-create pipeline at Hotkey assignment while retaining its saved ID. */
const assignCreatedHotkeyOrReportPending = async (
  sendResponse: ExecutionBridgeSendResponse,
  entity: WebsitePopupBaseCreateEntity,
  entityId: string,
  title: string,
  hotkey: string | undefined,
  approval: WebsitePopupHotkeyConflict | undefined,
  createAnother: boolean,
): Promise<boolean> => {
  if (!hotkey) return false;
  try {
    await assignWebsitePopupCreatedHotkey(entity, entityId, hotkey, approval);
    return false;
  } catch (error: unknown) {
    sendResponse({
      success: true,
      outcome: {
        status: 'entity-created-hotkey-pending',
        entity,
        entityId,
        title,
        createAnother,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return true;
  }
};

/** Reuse the New Tab Todo alarm handler and notify open extension surfaces. */
const completeCreatedTodoHandoff = async (todoId: string, isAnytime: boolean, sender: chrome.runtime.MessageSender) => {
  const todo = await db.todos.get(todoId);
  if (!todo || !Number.isFinite(todo.scheduleTime)) {
    throw new Error('The created Todo could not be found for alarm scheduling.');
  }
  const schedule = new Promise<void>((resolve, reject) => {
    handleTodoMessage(
      {
        action: 'schedule_todo_alarm',
        todoId,
        deadline: new Date(todo.scheduleTime).toISOString(),
        is_anytime: isAnytime,
      },
      sender,
      response => {
        if (response?.ok) resolve();
        else reject(new Error(response?.error || 'Unable to schedule the Todo alarm.'));
      },
    );
  });
  // Both handoffs must be attempted: a rejected alarm must not hide an
  // already-created Todo from open surfaces, and both steps are retry-safe.
  const outcomes = await Promise.allSettled([schedule, broadcastWebsitePopupEntityChanges(['todos'])]);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
};

export function handleWebsitePopupCreateOperation(
  operation: WebsitePopupExecutionBridgeRequest['operation'],
  sender: chrome.runtime.MessageSender,
  sendResponse: ExecutionBridgeSendResponse,
): boolean {
  if (operation.kind === 'create-entity') {
    void (async () => {
      try {
        const textCommand = String(operation.draft.fieldValues.shortcut || '').trim();
        if (textCommand) {
          await assertWebsitePopupTextCommandAvailable(textCommand, operation.draft.textCommandApproval);
        }
        const hotkey = String(operation.draft.fieldValues.hotkey || '').trim();
        if (hotkey) await assertWebsitePopupHotkeyAvailable(hotkey, operation.draft.hotkeyApproval);
        const created = await createWebsitePopupBaseEntity(operation.entity, operation.draft);
        if (operation.entity === 'agent') {
          await broadcastWebsitePopupEntityChanges(['aiPrompts']).catch(error => {
            console.warn('[WebsitePopup] AI Prompt saved; refresh broadcast failed.', error);
          });
        }
        if ('todoAlarm' in created && created.todoAlarm) {
          try {
            await completeCreatedTodoHandoff(created.id, created.todoAlarm.isAnytime, sender);
          } catch (error: unknown) {
            sendResponse({
              success: true,
              outcome: {
                status: 'entity-created-todo-followup-pending',
                entityId: created.id,
                title: created.title,
                message: error instanceof Error ? error.message : String(error),
                isAnytime: created.todoAlarm.isAnytime,
                createAnother: operation.createAnother,
              },
            });
            return;
          }
        }
        if (textCommand) {
          try {
            await assignWebsitePopupCreatedTextCommand(
              operation.entity,
              created.id,
              textCommand,
              operation.draft.textCommandApproval,
            );
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            sendResponse({
              success: true,
              outcome: {
                status: 'entity-created-shortcut-pending',
                entity: operation.entity,
                entityId: created.id,
                title: created.title,
                message,
                createAnother: operation.createAnother,
              },
            });
            return;
          }
        }
        if (
          await assignCreatedHotkeyOrReportPending(
            sendResponse,
            operation.entity,
            created.id,
            created.title,
            hotkey,
            operation.draft.hotkeyApproval,
            operation.createAnother,
          )
        )
          return;
        await finishWebsitePopupCreatedEntity(
          sender,
          sendResponse,
          operation.entity,
          created.id,
          created.title,
          operation.createAnother,
          operation.draft.fieldValues.favorite === 'enabled',
        );
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        notifyWebsitePopup(sender, messageText || `Failed to create ${operation.entity}`, 'error');
        sendResponse({ success: false, error: messageText || `Failed to create ${operation.entity}` });
      }
    })();
    return true;
  }

  if (operation.kind === 'complete-created-todo') {
    void (async () => {
      try {
        await completeCreatedTodoHandoff(operation.entityId, operation.isAnytime, sender);
        if (operation.textCommand) {
          try {
            await assignWebsitePopupCreatedTextCommand(
              'todo',
              operation.entityId,
              operation.textCommand,
              operation.approval,
            );
          } catch (error: unknown) {
            sendResponse({
              success: true,
              outcome: {
                status: 'entity-created-shortcut-pending',
                entity: 'todo',
                entityId: operation.entityId,
                title: operation.title,
                message: error instanceof Error ? error.message : String(error),
                createAnother: operation.createAnother,
              },
            });
            return;
          }
        }
        if (
          await assignCreatedHotkeyOrReportPending(
            sendResponse,
            'todo',
            operation.entityId,
            operation.title,
            operation.hotkey,
            operation.hotkeyApproval,
            operation.createAnother,
          )
        )
          return;
        await finishWebsitePopupCreatedEntity(
          sender,
          sendResponse,
          'todo',
          operation.entityId,
          operation.title,
          operation.createAnother,
          Boolean(operation.favorite),
        );
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (operation.kind === 'assign-created-text-command') {
    void (async () => {
      try {
        await assignWebsitePopupCreatedTextCommand(
          operation.entity,
          operation.entityId,
          operation.value,
          operation.approval,
        );
        if (
          await assignCreatedHotkeyOrReportPending(
            sendResponse,
            operation.entity,
            operation.entityId,
            operation.title,
            operation.hotkey,
            operation.hotkeyApproval,
            operation.createAnother,
          )
        )
          return;
        await finishWebsitePopupCreatedEntity(
          sender,
          sendResponse,
          operation.entity,
          operation.entityId,
          operation.title,
          operation.createAnother,
          Boolean(operation.favorite),
        );
      } catch (error: unknown) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (operation.kind === 'assign-created-hotkey') {
    void (async () => {
      if (
        await assignCreatedHotkeyOrReportPending(
          sendResponse,
          operation.entity,
          operation.entityId,
          operation.title,
          operation.value,
          operation.approval,
          operation.createAnother,
        )
      )
        return;
      await finishWebsitePopupCreatedEntity(
        sender,
        sendResponse,
        operation.entity,
        operation.entityId,
        operation.title,
        operation.createAnother,
        Boolean(operation.favorite),
      );
    })().catch((error: unknown) =>
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return true;
  }

  if (operation.kind === 'assign-created-favorite') {
    void (async () => {
      await finishWebsitePopupCreatedEntity(
        sender,
        sendResponse,
        operation.entity,
        operation.entityId,
        operation.title,
        operation.createAnother,
        true,
      );
    })();
    return true;
  }

  return false;
}

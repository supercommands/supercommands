/**
 * @file todoData.ts
 * @description Handles IndexedDB transactions (CRUD) for Todo records,
 * supporting setting references and updating completion status.
 *
 * @usage
 * ```ts
 * import { createTodo, updateTodo } from './todoData';
 * const todo = await createTodo('Finish task', [], 'one-time', Date.now());
 * ```
 */

import { generateEntityId } from '../../../../shared-components/utils';

import { db } from '../../../../storage/indexDB/dbConfig';
import type { TodoRecord, TodoReference, TodoSnapshot } from './todoTypes';
import {
  createInitialHistory,
  normalizeHistory,
  upsertVersionForChange,
} from '../../../../shared-components/versionHistory/structuredVersionHistory';

function extractTodoSnapshot(todo: TodoRecord): TodoSnapshot {
  return {
    name: todo.name,
    description: todo.description,
    references: todo.references || [],
    isDone: !!todo.isDone,
    scheduleType: todo.scheduleType,
    recurringType: todo.recurringType,
    scheduleTime: todo.scheduleTime,
    tags: todo.tags,
    tagIds: todo.tagIds,
    shortcut: todo.shortcut,
    workspaceId: todo.workspaceId,
    folderId: todo.folderId,
  };
}

const getReferenceDisplayName = (ref: any): string => {
  const data = ref?.data || {};
  const value = ref?.value ?? data?.value;

  const directName =
    ref?.name ||
    ref?.title ||
    ref?.key ||
    ref?.label ||
    ref?.prefix ||
    data?.name ||
    data?.title ||
    data?.key ||
    data?.label ||
    data?.prefix ||
    data?.sessionName;

  if (directName) return String(directName);

  if (value && typeof value === 'object') {
    if (Array.isArray(value.names) && value.names.length > 0) return String(value.names[0]);
    if (Array.isArray(value.urls) && value.urls.length > 0) return String(value.urls[0]);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed?.names) && parsed.names.length > 0) return String(parsed.names[0]);
        if (Array.isArray(parsed?.urls) && parsed.urls.length > 0) return String(parsed.urls[0]);
      } catch {
        // Fall through to the category fallback.
      }
    }
  }

  const category = String(ref?.type || ref?.category || data?.category || '').toLowerCase();
  if (category === 'note') return 'Saved note';
  if (category === 'snippet') return 'Saved snippet';
  if (category === 'link') return 'Saved link';
  if (category === 'command') return 'Saved command';
  if (category === 'automation') return 'Saved automation';
  if (category === 'agent' || category === 'chat_agent') return 'Saved agent';
  if (category === 'prompt' || category === 'aiprompt' || category === 'ai_prompt') return 'Saved prompt';
  if (category === 'tabgroup' || category === 'session') return 'Saved session';
  return 'Saved item';
};

export const mapTodoReferences = (references: any[] = []): TodoReference[] =>
  references.map((ref: any) => ({
    id: String(ref.id || ref.value || ref.snippet_id || ref.data?.id || ''),
    type: ref.type || ref.category || ref.data?.category || 'note',
    name: getReferenceDisplayName(ref),
  }));

export const createTodo = async (
  title: string,
  references: any[],
  scheduleType: 'one-time' | 'recurring',
  scheduleTime: number,
  recurringCycle?: string,
  description?: string,
  tagIds?: string[],
  shortcut?: string,
  workspaceId?: string,
  folderId?: string,
): Promise<TodoRecord> => {
  try {
    console.log('[createTodo:Dexie] Invoked with:', {
      title,
      references,
      scheduleType,
      scheduleTime,
      recurringCycle,
      description,
      tagIds,
      shortcut,
    });
    const now = Date.now();
    let finalTitle = title;
    const mappedReferences = mapTodoReferences(references);

    if (!finalTitle && mappedReferences.length) {
      finalTitle = mappedReferences[0].name || 'Untitled Todo';
    }

    const newTodo: TodoRecord = {
      id: generateEntityId('todo'),
      name: finalTitle,
      description,
      references: mappedReferences,
      isDone: false,
      scheduleType,
      recurringType: recurringCycle as any,
      scheduleTime,
      tagIds: tagIds || [],
      tags: tagIds || [],
      shortcut: shortcut || '',
      workspaceId,
      folderId,
      createdAt: now,
      updatedAt: now,
      versionHistory: undefined as any,
    };

    const initialSnapshot = extractTodoSnapshot(newTodo);
    newTodo.versionHistory = createInitialHistory<TodoSnapshot>(initialSnapshot, now);

    const addedId = await db.todos.add(newTodo);
    console.log('[createTodo:Dexie] Successfully added todo to IndexedDB with key:', addedId, newTodo);
    return newTodo;
  } catch (e) {
    console.error('[createTodo:Dexie] Failed to create todo in Dexie', e);
    throw e;
  }
};

export const deleteTodo = async (todoId: string): Promise<void> => {
  try {
    if (todoId) {
      await db.todos.delete(todoId);
    }
  } catch (e) {
    console.error('Permanent delete failed:', e);
    throw e;
  }
};

export const updateTodoContent = async (todoId: string, updates: Partial<TodoRecord>): Promise<TodoRecord> => {
  try {
    if (!todoId) throw new Error('todoId is required');
    return await db.transaction('rw', db.todos, async () => {
      const existing = await db.todos.get(todoId);
      if (!existing) throw new Error('Todo not found after update');

      const now = Date.now();
      const nextRecord: TodoRecord = {
        ...existing,
        ...updates,
        updatedAt: now,
      };

      const prevSnapshot = extractTodoSnapshot(existing);
      const nextSnapshot = extractTodoSnapshot(nextRecord);

      const { history: nextHistory } = upsertVersionForChange<TodoSnapshot>(
        existing.versionHistory,
        prevSnapshot,
        nextSnapshot,
        now,
      );

      nextRecord.versionHistory = nextHistory;
      await db.todos.put(nextRecord);
      return nextRecord;
    });
  } catch (e) {
    console.error('Failed to update todo content in Dexie', e);
    throw e;
  }
};

export const updateTodo = async (todoId: string, newDoneStatus: boolean, nextDeadline?: string): Promise<void> => {
  const updates: Partial<TodoRecord> = {
    isDone: newDoneStatus,
  };
  if (nextDeadline) {
    updates.scheduleTime = new Date(nextDeadline).getTime();
  }
  await updateTodoContent(todoId, updates);
};

/**
 * @file todoTypes.ts
 * @description Defines TypeScript interfaces for the Todo entity, references to other entities
 * (notes, snippets, links, etc.), schedules (one-time/recurring), and recurring periods.
 * 
 * @usage
 * ```ts
 * import type { TodoRecord, TodoReference } from './todoTypes';
 * ```
 */

export type TodoReferenceType =
  | 'note'
  | 'prompt'
  | 'aiPrompt'
  | 'ai_prompt'
  | 'link'
  | 'snippet'
  | 'command'
  | 'automation'
  | 'agent'
  | 'chat_agent'
  | 'module'
  | 'session'
  | 'tabgroup';


export interface TodoReference {
  type: TodoReferenceType;
  id: string;
  name?: string;
}

export type ScheduleType = 'one-time' | 'recurring';
export type RecurringType = 'daily' | 'weekly' | 'monthly';

import type { StructuredVersionHistory } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface TodoSnapshot {
  name: string;
  description?: string;
  references: TodoReference[];
  isDone: boolean;
  scheduleType: ScheduleType;
  recurringType?: RecurringType;
  scheduleTime: number;
  tags?: string[];
  tagIds?: string[];
  shortcut?: string;
  workspaceId?: string;
  folderId?: string;
}

export interface TodoRecord {
  id: string; // todoId
  name: string; // todoName
  description?: string; // Add description for the UI
  references: TodoReference[];
  isDone: boolean;
  
  scheduleType: ScheduleType;
  recurringType?: RecurringType;
  scheduleTime: number; // Unix timestamp in milliseconds
  
  tags?: string[];
  tagIds?: string[];
  shortcut?: string;
  workspaceId?: string;
  folderId?: string;

  createdAt: number;
  updatedAt: number;

  versionHistory?: StructuredVersionHistory<TodoSnapshot>;
}

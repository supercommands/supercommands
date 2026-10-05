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
export type TodoReferenceType = 'note' | 'prompt' | 'aiPrompt' | 'ai_prompt' | 'link' | 'snippet' | 'command' | 'agent' | 'chat_agent' | 'workspace' | 'session' | 'tabgroup';
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
    priority?: string;
    shortcut?: string;
    organisationId?: string;
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
    /** Set only on a saved daily occurrence; the recurring Todo keeps the series ID. */
    dailySeriesId?: string;
    dailyOccurrenceDate?: string;
    /** First time separate daily occurrences were enabled for this series. */
    dailyOccurrencesStartedAt?: number;
    tags?: string[];
    tagIds?: string[];
    priority?: string;
    shortcut?: string;
    organisationId?: string;
    createdAt: number;
    updatedAt: number;
    versionHistory?: StructuredVersionHistory<TodoSnapshot>;
}
export const TODO_COMPARISON_FIELDS = [
    'id',
    'name',
    'description',
    'references',
    'isDone',
    'scheduleType',
    'recurringType',
    'scheduleTime',
    'dailySeriesId',
    'dailyOccurrenceDate',
    'dailyOccurrencesStartedAt',
    'tags',
    'tagIds',
    'priority',
    'shortcut',
    'organisationId'
] as const satisfies readonly (keyof TodoRecord)[];

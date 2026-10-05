/**
 * @file index.ts
 * @description Barrel export file for the todos module,
 * exposing the main workspace view, lists, calendars, and sub-views.
 *
 * @usage
 * ```ts
 * import { TodoWorkspace } from './todos';
 * ```
 */
export { default as TodoWorkspace } from './ui/TodoWorkspace';
export { default as TodoList } from './ui/TodoList';
export { default as CreateTodoView } from './ui/CreateTodoView';
export { default as TodoCalendar } from './ui/TodoCalendar';

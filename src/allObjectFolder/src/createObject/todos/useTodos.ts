/**
 * @file useTodos.ts
 * @description Provides React hooks (`useAllTodos` and `useTodoById`)
 * for querying the db state store for todos.
 *
 * @usage
 * ```tsx
 * import { useAllTodos } from './useTodos';
 * const todos = useAllTodos();
 * ```
 */
import { useMemo } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';
import type { TodoRecord } from './todoTypes';
export const useAllTodos = (): TodoRecord[] | undefined => {
    const todos = useDbStore(state => state.todos);
    // Sort them like they were sorted previously
    return useMemo(() => {
        return [...todos].sort((a, b) => b.updatedAt - a.updatedAt);
    }, [todos]);
};
export const useTodoById = (id: string): TodoRecord | undefined => {
    const todos = useDbStore(state => state.todos);
    return todos.find(t => t.id === id);
};

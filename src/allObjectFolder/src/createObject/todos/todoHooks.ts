/**
 * @file todoHooks.ts
 * @description Provides React hooks for filtering tasks, mapping convertible items 
 * (notes, snippets, links, etc.) to todos, and calculating todo stats.
 * 
 * @usage
 * ```tsx
 * import { useFilteredTodos } from './todoHooks';
 * const list = useFilteredTodos(tasks, 'today', '', [], new Date());
 * ```
 */

import { useMemo } from 'react';

import { isSameDay } from 'date-fns';
import { TodoRecord } from './todoTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';

export const useConvertibleItems = () => {
  const notes = useDbStore(state => state.notes);
  const snippets = useDbStore(state => state.snippets);
  const links = useDbStore(state => state.links);
  const automations = useDbStore(state => state.automations);
  const chatAgents = useDbStore(state => state.chatAgents);
  const aiPrompts = useDbStore(state => state.aiPrompts);
  const sessions = useDbStore(state => state.sessions);

  return useMemo(() => {
    try {
      const items: any[] = [];

      notes.forEach(n => {
        items.push({ id: n.id, name: (n as any).title || (n as any).name || 'Untitled Note', category: 'note', data: n });
      });
      snippets.forEach(s => {
        if (!(s as any).is_todo_type && (s as any).category !== 'task') {
          items.push({ id: s.id, name: (s as any).key || 'Untitled Snippet', category: (s as any).category || 'snippet', data: s });
        }
      });
      links.forEach(l => {
        items.push({ id: l.id, name: (l as any).title || (l as any).name || 'Untitled Link', category: 'link', data: l });
      });
      automations.forEach(a => {
        const steps = (a as any).automation_steps || (a as any).steps || [];
        const isAiAgent = Array.isArray(steps) && steps.some(
          (step: any) => String(step.module_id || step.moduleId) === '5' || step.config?.agentId === 'all_ai' || step.config?.isAllAi
        );
        const cat = isAiAgent ? 'agent' : 'automation';
        items.push({ id: `auto-${a.id}`, name: (a as any).name || 'Untitled Automation', category: cat, data: a });
      });
      chatAgents.forEach(a => {
        items.push({ id: `agent-${a.id}`, name: (a as any).title || (a as any).name || 'Untitled Agent', category: 'agent', data: a });
      });
      aiPrompts.forEach(p => {
        items.push({ id: `prompt-${p.id}`, name: (p as any).title || (p as any).name || 'Untitled Prompt', category: 'prompt', data: p });
      });
      sessions.forEach(s => {
        items.push({ id: `session-${s.id}`, name: (s as any).title || (s as any).name || 'Untitled Tab Session', category: 'tabgroup', data: s });
      });

      return items;
    } catch (e) {
      console.warn('Failed to compute convertible items from useDbStore', e);
      return [];
    }
  }, [notes, snippets, links, automations, chatAgents, aiPrompts, sessions]);
};

export const parseTaskDate = (d: string | number | undefined) => {
  if (!d) return new Date(0);
  if (typeof d === 'number') return new Date(d);
  const date = new Date(d.replace(' ', 'T'));
  return isNaN(date.getTime()) ? new Date(0) : date;
};

export const useFilteredTodos = (
  tasks: TodoRecord[],
  activeSection: string,
  searchQuery: string,
  collapsedCategories: string[],
  selectedDate: Date
) => {
  return useMemo(() => {
    let filtered = tasks;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          (t.name && typeof t.name === 'string' && t.name.toLowerCase().includes(q)) ||
          (t.references &&
            t.references.some(r => typeof r.id === 'string' && r.id.toLowerCase().includes(q))),
      );
    } else {
      // Filter by active section if no search query
      filtered = filtered.filter(t => {
        const d = parseTaskDate(t.scheduleTime);
        switch (activeSection) {
          case 'today':
            if (t.isDone) return false;
            // Include overdue, today's tasks, and tasks without a deadline
            return !t.scheduleTime || isSameDay(d, selectedDate) || d.getTime() < selectedDate.getTime();
          case 'scheduled':
            if (t.isDone) return false;
            return t.scheduleTime && !isSameDay(d, selectedDate) && d.getTime() >= selectedDate.getTime();
          case 'done':
            return t.isDone;
          case 'one-time':
            return !t.isDone && t.scheduleType === 'one-time';
          case 'recurring':
            return !t.isDone && t.scheduleType === 'recurring';
          case 'calendar':
            return t.scheduleTime && isSameDay(d, selectedDate);
          default:
            return true;
        }
      });

      // Filter out collapsed categories (only if not searching)
      if (collapsedCategories.length > 0) {
        filtered = filtered.filter(t => {
          let cat = 'task'; // Default for TodoRecord if we don't map categories directly on the record
          // For now, everything is a task unless we have logic to extract it from references
          return !collapsedCategories.includes(cat);
        });
      }
    }

    // Sort: tasks with time first, then alphabetically by value/name
    return filtered.sort((a, b) => {
      const hasTimeA = a.scheduleTime > 0;
      const hasTimeB = b.scheduleTime > 0;
      
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [tasks, activeSection, searchQuery, collapsedCategories, selectedDate]);
};

export const useTodoStats = (tasks: TodoRecord[]) => {
  return useMemo(() => {
    const today = new Date();
    const todayTasks = tasks.filter(t => {
      if (t.isDone) return false;
      const d = parseTaskDate(t.scheduleTime);
      return !t.scheduleTime || isSameDay(d, today) || d.getTime() < today.getTime();
    });
    
    return {
      todayCount: todayTasks.length,
      scheduledCount: tasks.filter(t => {
        if (t.isDone) return false;
        const d = parseTaskDate(t.scheduleTime);
        return t.scheduleTime && !isSameDay(d, today) && d.getTime() >= today.getTime();
      }).length,
      doneCount: tasks.filter(t => t.isDone).length,
      recurringCount: tasks.filter(t => !t.isDone && t.scheduleType === 'recurring').length,
      oneTimeCount: tasks.filter(t => !t.isDone && t.scheduleType === 'one-time').length
    };
  }, [tasks]);
};

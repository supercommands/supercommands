/**
 * @file widgetData.ts
 * @description Provides IndexedDB data access helpers for Widget entities,
 * spatial grid layouts, view tabs, and polymorphic entity resolution.
 */

import { db } from '../../../../storage/indexDB/dbConfig';
import type { WidgetRecord, WidgetLayoutRecord, WidgetViewRecord } from './widgetTypes';
import { createNote } from '../notes/noteData';
import { createSession } from '../session/sessionData';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { DEFAULT_SESSION_SETTINGS } from '../session/sessionSettings';

/**
 * Fetch all Views, Widgets, & Layouts for a specific Workspace
 */
export async function getDashboardDataForWorkspace(workspaceId: string) {
  if (!workspaceId) {
    return { widgets: [], layouts: [], views: [] };
  }

  const [widgets, layouts, views] = await Promise.all([
    db.widgets.where('workspaceId').equals(workspaceId).toArray(),
    db.widgetLayouts.where('workspaceId').equals(workspaceId).toArray(),
    db.widgetViews.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return { widgets, layouts, views };
}

/**
 * Fetch all views for a workspace, but only the widgets/layouts for one dashboard view.
 * This keeps new-tab startup proportional to the selected collection instead of every
 * widget ever added to the workspace.
 */
export async function getDashboardDataForWorkspaceView(workspaceId: string, viewId: string) {
  if (!workspaceId || !viewId) {
    return { widgets: [], layouts: [], views: [] };
  }

  const [widgets, layouts, views] = await Promise.all([
    db.widgets.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray(),
    db.widgetLayouts.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray(),
    db.widgetViews.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return { widgets, layouts, views };
}

/**
 * Dynamically resolve target entity data bound to a widget via polymorphic reference
 */
export async function resolveWidgetEntity(widget: WidgetRecord) {
  if (!widget.referenceType) return null;

  switch (widget.referenceType) {
    case 'session':
      return widget.referenceId ? (await db.sessions.get(widget.referenceId)) || null : null;
    case 'note':
      return widget.referenceId ? (await db.notes.get(widget.referenceId)) || null : null;
    case 'link':
      return widget.referenceId ? (await db.links.get(widget.referenceId)) || null : null;
    case 'snippet':
      return widget.referenceId ? (await db.snippets.get(widget.referenceId)) || null : null;
    case 'aiPrompt':
      return widget.referenceId ? (await db.aiPrompts.get(widget.referenceId)) || null : null;
    case 'todo':
      return widget.referenceId ? (await db.todos.get(widget.referenceId)) || null : null;
    case 'link-library':
      return await db.links.toArray();
    case 'snippet-library':
      return await db.snippets.toArray();
    case 'ai-prompt-library':
      return await db.aiPrompts.toArray();
    case 'note-library':
      return await db.notes.toArray();
    default:
      return null;
  }
}

/**
 * Create a new Widget record and its spatial grid layout position in Dexie
 */
export async function createWidgetInWorkspace(
  workspaceId: string,
  viewId: string,
  input: Partial<WidgetRecord>,
  layoutInput?: Partial<WidgetLayoutRecord>
): Promise<{ widgetRecord: WidgetRecord; layoutRecord: WidgetLayoutRecord }> {
  const widgetId = input.id || generateEntityId('widget');
  const now = Date.now();

  const widgetRecord: WidgetRecord = {
    id: widgetId,
    workspaceId,
    viewId,
    categoryId: input.categoryId || 'core-widgets',
    title: input.title || 'New Widget',
    type: input.type || 'generic',
    referenceId: input.referenceId,
    referenceType: input.referenceType,
    settings: input.settings || {},
    sizePreset: input.sizePreset || 'medium',
    expansionMode: input.expansionMode || 'preset',
    createdAt: input.createdAt || now,
    updatedAt: now,
  };

  const layoutRecord: WidgetLayoutRecord = {
    id: widgetId,
    workspaceId,
    viewId,
    widgetId,
    gridVersion: layoutInput?.gridVersion,
    x: layoutInput?.x ?? 0,
    y: layoutInput?.y ?? Number.MAX_SAFE_INTEGER,
    w: layoutInput?.w ?? 4,
    h: layoutInput?.h ?? 5,
    minW: layoutInput?.minW ?? 4,
    maxW: layoutInput?.maxW ?? 12,
    minH: layoutInput?.minH ?? 3,
    maxH: layoutInput?.maxH ?? 12,
    isDraggable: layoutInput?.isDraggable ?? true,
    isResizable: layoutInput?.isResizable ?? true,
    static: layoutInput?.static ?? false,
    updatedAt: now,
  };

  await db.transaction('rw', [db.widgets, db.widgetLayouts], async () => {
    await db.widgets.put(widgetRecord);
    await db.widgetLayouts.put(layoutRecord);
  });

  return { widgetRecord, layoutRecord };
}

/**
 * Save updated spatial grid positions for all widgets in a view (e.g. after drag or resize)
 */
export async function saveWorkspaceWidgetLayouts(
  workspaceId: string,
  viewId: string,
  updatedLayouts: WidgetLayoutRecord[]
): Promise<void> {
  const now = Date.now();
  const recordsToPut = updatedLayouts.map(l => {
    const { gridVersion, ...rest } = l;
    return {
      ...rest,
      workspaceId,
      viewId,
      updatedAt: now,
    };
  });

  await db.widgetLayouts.bulkPut(recordsToPut);
}

/**
 * Delete a widget and its layout entry from Dexie
 */
export async function deleteWidgetFromWorkspace(widgetId: string): Promise<void> {
  if (!widgetId) return;

  await db.transaction('rw', [db.widgets, db.widgetLayouts], async () => {
    await db.widgets.delete(widgetId);
    await db.widgetLayouts.delete(widgetId);
  });
}

/**
 * Creates default note and session records, then links widgets to them.
 */
export async function createDefaultWidgetsForView(
  workspaceId: string,
  viewId: string,
  noteTitle = 'Untitled Note',
  sessionTitle = 'Untitled Tab Session',
): Promise<{ noteId: string; noteWidgetId: string; sessionId: string; sessionWidgetId: string }> {
  const defaultNoteTitle = noteTitle.trim() || 'Untitled Note';
  const defaultSessionTitle = sessionTitle.trim() || 'Untitled Tab Session';

  // 1. Create fresh note in db.notes
  const newNote = await createNote({
    title: defaultNoteTitle,
    body: '',
    workspaceId,
  });

  // 2. Attach note-item widget linked to newNote.id
  const { widgetRecord: noteWidget } = await createWidgetInWorkspace(
    workspaceId,
    viewId,
    {
      title: defaultNoteTitle,
      type: 'note-item',
      referenceId: newNote.id,
      referenceType: 'note',
      sizePreset: 'medium',
      expansionMode: 'preset',
    },
    {
      x: 0,
      y: 0,
      w: 8,
      h: 6,
    }
  );

  // 3. Create a default session and attach a Large session-item widget to it.
  const newSession = await createSession({
    title: defaultSessionTitle,
    urls: [],
    workspaceId,
    sessionOpenSettings: DEFAULT_SESSION_SETTINGS,
  });

  const { widgetRecord: sessionWidget } = await createWidgetInWorkspace(
    workspaceId,
    viewId,
    {
      title: defaultSessionTitle,
      type: 'session-item',
      referenceId: newSession.id,
      referenceType: 'session',
      sizePreset: 'large',
      expansionMode: 'preset',
    },
    {
      x: 0,
      y: 6,
      w: 12,
      h: 6,
    }
  );

  return { noteId: newNote.id, noteWidgetId: noteWidget.id, sessionId: newSession.id, sessionWidgetId: sessionWidget.id };
}

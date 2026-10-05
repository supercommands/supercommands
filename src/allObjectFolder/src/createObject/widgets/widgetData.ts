import { updateWorkspace } from '../session/workspaceData';
import { getWorkspaceViewAppearances } from './workspaceViewAppearance';
/**
 * @file widgetData.ts
 * @description Provides IndexedDB data access helpers for Widget entities,
 * spatial grid layouts, view tabs, and polymorphic entity resolution.
 */
import { db } from '../../../../storage/indexDB/dbConfig';
import { createHomeDashboardRecord, dashboardToWidgetTarget, type WidgetRecord, type WidgetLayoutRecord, type WidgetViewRecord } from './widgetTypes';
import { createNote } from '../notes/noteData';
import { createSession } from '../session/sessionData';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { DEFAULT_SESSION_SETTINGS } from '../session/sessionSettings';
/**
 * Fetch all Views, Widgets, & Layouts for a specific Workspace
 */
export async function getDashboardDataForOrganisation(organisationId: string) {
    if (!organisationId) {
        return { widgets: [], layouts: [], views: [] };
    }
    const home = await ensureHomeWidgetDashboard(organisationId);
    const [widgets, layouts, views] = await Promise.all([
        db.widgets.where('[organisationId+viewId]').equals([organisationId, home.id]).toArray(),
        db.widgetLayouts.where('[organisationId+viewId]').equals([organisationId, home.id]).toArray(),
        getWidgetTargetsForOrganisation(organisationId)
    ]);
    return { widgets, layouts, views };
}
/**
 * Fetch all views for a workspace, but only the widgets/layouts for one dashboard view.
 * This keeps new-tab startup proportional to the selected collection instead of every
 * widget ever added to the workspace.
 */
export async function getDashboardDataForOrganisationView(organisationId: string, viewId: string) {
    if (!organisationId || !viewId) {
        return { widgets: [], layouts: [], views: [] };
    }
    const home = await ensureHomeWidgetDashboard(organisationId);
    const [widgets, layouts, views] = await Promise.all([
        viewId === home.id ? db.widgets.where('[organisationId+viewId]').equals([organisationId, viewId]).toArray() : [],
        viewId === home.id ? db.widgetLayouts.where('[organisationId+viewId]').equals([organisationId, viewId]).toArray() : [],
        getWidgetTargetsForOrganisation(organisationId)
    ]);
    return { widgets, layouts, views };
}
/**
 * Dynamically resolve target entity data bound to a widget via polymorphic reference
 */
export async function resolveWidgetEntity(widget: WidgetRecord) {
    if (!widget.referenceType)
        return null;
    switch (widget.referenceType) {
        case 'session':
            return widget.referenceId ? (await db.workspaceSessions.get(widget.referenceId)) : null;
        case 'note':
            return widget.referenceId ? (await db.notes.get(widget.referenceId)) : null;
        case 'link':
            return widget.referenceId ? (await db.links.get(widget.referenceId)) : null;
        case 'snippet':
            return widget.referenceId ? (await db.snippets.get(widget.referenceId)) : null;
        case 'aiPrompt':
            return widget.referenceId ? (await db.aiPrompts.get(widget.referenceId)) : null;
        case 'todo':
            return widget.referenceId ? (await db.todos.get(widget.referenceId)) : null;
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
export async function createWidgetInOrganisation(organisationId: string, viewId: string, input: Partial<WidgetRecord>, layoutInput?: Partial<WidgetLayoutRecord>): Promise<{
    widgetRecord: WidgetRecord;
    layoutRecord: WidgetLayoutRecord;
}> {
    await assertWidgetTargetOwner(organisationId, viewId);
    if (input.type === 'session-item' || input.referenceType === 'session' || input.referenceType === 'workspace') throw new Error('Home does not support saved-session widgets.');
    const widgetId = input.id || generateEntityId('widget');
    const now = Date.now();
    const widgetRecord: WidgetRecord = {
        id: widgetId,
        organisationId,
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
        organisationId,
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
export async function saveOrganisationWidgetLayouts(organisationId: string, viewId: string, updatedLayouts: WidgetLayoutRecord[]): Promise<void> {
    await assertWidgetTargetOwner(organisationId, viewId);
    const now = Date.now();
    const recordsToPut = updatedLayouts.map(l => {
        const { gridVersion, ...rest } = l;
        return {
            ...rest,
            organisationId,
            viewId,
            updatedAt: now,
        };
    });
    await db.widgetLayouts.bulkPut(recordsToPut);
}
/**
 * Delete a widget and its layout entry from Dexie
 */
export async function deleteWidgetFromOrganisation(widgetId: string): Promise<void> {
    if (!widgetId)
        return;
    await db.transaction('rw', [db.widgets, db.widgetLayouts], async () => {
        await db.widgets.delete(widgetId);
        await db.widgetLayouts.delete(widgetId);
    });
}
/**
 * Creates default note and session records, then links widgets to them.
 */
export async function createDefaultWidgetsForView(organisationId: string, viewId: string, noteTitle = 'Untitled Note', sessionTitle = 'Untitled Tab Session'): Promise<{
    noteId: string;
    noteWidgetId: string;
    sessionId: string;
    sessionWidgetId: string;
}> { throw new Error('Workspaces do not contain widgets.'); }

export async function ensureHomeWidgetDashboard(organisationId: string) {
  return db.transaction('rw', db.widgetDashboards, async () => {
    const existing = await db.widgetDashboards.where('[organisationId+kind]').equals([organisationId, 'home']).first();
    if (existing) return existing;
    const record = createHomeDashboardRecord(organisationId);
    await db.widgetDashboards.add(record);
    return record;
  });
}
export async function getWidgetTargetsForOrganisation(organisationId: string): Promise<WidgetViewRecord[]> {
  const home = await ensureHomeWidgetDashboard(organisationId);
  const views = await db.workspaceViews.where('organisationId').equals(organisationId).toArray();
  const appearances = await getWorkspaceViewAppearances(views.map(view => view.id));
  return [dashboardToWidgetTarget(home), ...views.map(view => ({...view, settings: {...view.settings, ...appearances.get(view.id)}}))];
}
export async function getWidgetTarget(id: string): Promise<WidgetViewRecord | undefined> {
  if (!id.startsWith('widgetDashboard_')) {
    const view = await db.workspaceViews.get(id);
    if (!view) return undefined;
    const appearance = (await getWorkspaceViewAppearances([id])).get(id);
    return {...view, settings: {...view.settings, ...appearance}};
  }
  const dashboard = await db.widgetDashboards.get(id);
  return dashboard ? dashboardToWidgetTarget(dashboard) : undefined;
}
export async function updateWidgetTarget(id: string, patch: Partial<WidgetViewRecord>): Promise<number> {
  if (!id.startsWith('widgetDashboard_')) {
    if (patch.settings && Object.keys(patch.settings).length) throw new Error('Workspaces contain no widget settings.');
    if (patch.title !== undefined) await updateWorkspace(id, {workspaceName: patch.title});
    else if (!await db.workspaces.get(id)) throw new Error('This Workspace no longer exists.');
    return 1;
  }
  const dashboard = await db.widgetDashboards.get(id);
  if (!dashboard) throw new Error('Home dashboard does not exist.');
  return db.widgetDashboards.update(id, {
    ...(patch.title !== undefined ? { dashboardName: patch.title } : {}),
    ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
    ...(patch.updatedAt !== undefined ? { updatedAt: patch.updatedAt } : {}),
  });
}
export async function assertWidgetTargetOwner(organisationId: string, targetId: string): Promise<void> {
 const target = await db.widgetDashboards.get(targetId);
 if (!target || target.organisationId !== organisationId || target.kind !== 'home') throw new Error('Widgets belong only to Home.');
}

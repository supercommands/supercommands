/**
 * @file migrateWidgetsToDexie.ts
 * @description Migration script that safely reads legacy widget data from chrome.storage.local,
 * converts specific entity IDs (noteId, sessionId, linkId) into polymorphic references
 * (referenceId & referenceType), and bulk saves them into Dexie IndexedDB tables.
 */

import { db } from './dbConfig';
import {
  normalizeCollectionLaunchSettings,
  type WidgetRecord,
  type WidgetLayoutRecord,
  type WidgetViewRecord,
} from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { convertFineGridToLegacyPosition } from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';

const MIGRATION_FLAG_KEY = 'widgets_migrated_to_dexie_v1';
const MIGRATION_BOOT_HINT_KEY = 'widgets_migrated_to_dexie_v1_boot_hint';
const LEGACY_STORAGE_KEYS = [
  'widget-dashboard-layout-v2',
  'widget-dashboard-layout-v1',
  'widget_dashboard_v2',
  'widget_dashboard',
];

const ENABLE_WIDGET_MIGRATION_PERF_LOGS = false;

const widgetMigrationPerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_WIDGET_MIGRATION_PERF_LOGS) return;
  console.log('[NewTabPerf][WidgetMigration]', label, data || {});
};

const hasMigrationBootHint = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_BOOT_HINT_KEY) === 'true';
  } catch {
    return false;
  }
};

const setMigrationBootHint = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MIGRATION_BOOT_HINT_KEY, 'true');
    }
  } catch {
    // The hint is only a startup optimization.
  }
};

export async function migrateWidgetsFromLocalStorageToDexie(): Promise<{ migratedCount: number; purged: boolean }> {
  const startedAt = performance.now();
  if (hasMigrationBootHint()) {
    widgetMigrationPerf('skip:boot-hint', {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return { migratedCount: 0, purged: false };
  }

  widgetMigrationPerf('start');
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    widgetMigrationPerf('skip:no-chrome-storage', {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return { migratedCount: 0, purged: false };
  }

  // 1. Check if migration has already been executed
  const flagCheck = await chrome.storage.local.get(MIGRATION_FLAG_KEY);
  if (flagCheck[MIGRATION_FLAG_KEY]) {
    setMigrationBootHint();
    widgetMigrationPerf('skip:already-migrated', {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return { migratedCount: 0, purged: false };
  }

  // 2. Read legacy storage items
  const storageData = await chrome.storage.local.get(LEGACY_STORAGE_KEYS);
  const legacyBlob =
    storageData['widget-dashboard-layout-v2'] ||
    storageData['widget-dashboard-layout-v1'] ||
    storageData['widget_dashboard_v2'] ||
    storageData['widget_dashboard'];

  if (!legacyBlob || typeof legacyBlob !== 'object') {
    // No legacy widget data to migrate, mark flag as done
    await chrome.storage.local.set({ [MIGRATION_FLAG_KEY]: true });
    setMigrationBootHint();
    widgetMigrationPerf('done:no-legacy-blob', {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return { migratedCount: 0, purged: true };
  }

  const legacyWidgets: any[] = Array.isArray(legacyBlob.widgets) ? legacyBlob.widgets : [];
  const legacyLayout: any[] = Array.isArray(legacyBlob.layout) ? legacyBlob.layout : [];
  const legacyViews: any[] = Array.isArray(legacyBlob.views) ? legacyBlob.views : [];

  if (legacyWidgets.length === 0 && legacyViews.length === 0) {
    await chrome.storage.local.set({ [MIGRATION_FLAG_KEY]: true });
    setMigrationBootHint();
    widgetMigrationPerf('done:empty-legacy-data', {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return { migratedCount: 0, purged: false };
  }

  // 3. Resolve last used workspace ID from local storage or Dexie DB
  let defaultWorkspaceId = 'default';
  try {
    const localWorkspace = await chrome.storage.local.get([
      'last_active_workspace_id',
      'active_workspace_id',
      'last_used_workspace_id',
      'currentWorkspaceId',
    ]);
    const lastWsId =
      localWorkspace.last_active_workspace_id ||
      localWorkspace.active_workspace_id ||
      localWorkspace.last_used_workspace_id ||
      localWorkspace.currentWorkspaceId;

    if (lastWsId) {
      defaultWorkspaceId = String(lastWsId);
    } else {
      const firstWs = await db.workspaces.toCollection().first();
      if (firstWs?.id) {
        defaultWorkspaceId = firstWs.id;
      }
    }
  } catch {
    defaultWorkspaceId = 'default';
  }

  const now = Date.now();

  // 4. Map legacy widgets to polymorphic WidgetRecords
  const widgetRecords: WidgetRecord[] = legacyWidgets.map(widget => {
    let referenceId: string | undefined = undefined;
    let referenceType: string | undefined = undefined;

    if (widget.sessionId) {
      referenceId = String(widget.sessionId);
      referenceType = 'session';
    } else if (widget.noteId) {
      referenceId = String(widget.noteId);
      referenceType = 'note';
    } else if (widget.linkId) {
      referenceId = String(widget.linkId);
      referenceType = 'link';
    } else if (widget.snippetId) {
      referenceId = String(widget.snippetId);
      referenceType = 'snippet';
    } else if (widget.aiPromptId) {
      referenceId = String(widget.aiPromptId);
      referenceType = 'aiPrompt';
    } else if (widget.type === 'link-library' || widget.type === 'snippet-library' || widget.type === 'ai-prompt-library' || widget.type === 'note-library') {
      referenceType = widget.type;
    }

    return {
      id: String(widget.id),
      workspaceId: String(widget.workspaceId || defaultWorkspaceId),
      viewId: String(widget.viewId || 'default'),
      categoryId: widget.categoryId ? String(widget.categoryId) : undefined,
      title: String(widget.title || 'Widget'),
      type: String(widget.type || 'generic'),
      referenceId,
      referenceType,
      settings: widget.settings && typeof widget.settings === 'object' ? widget.settings : {},
      sizePreset: widget.sizePreset || 'medium',
      expansionMode: widget.expansionMode || 'preset',
      createdAt: Number(widget.createdAt) || now,
      updatedAt: Number(widget.updatedAt) || now,
    };
  });

  // 5. Map legacy layout grid positions to WidgetLayoutRecords
  const layoutRecords: WidgetLayoutRecord[] = legacyLayout.map(pos => {
    const rawPosition = {
      i: String(pos.i),
      viewId: String(pos.viewId || 'default'),
      gridVersion: pos.gridVersion,
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0,
      w: Number(pos.w) || 4,
      h: Number(pos.h) || 4,
      minW: pos.minW ? Number(pos.minW) : 3,
      maxW: pos.maxW ? Number(pos.maxW) : 12,
      minH: pos.minH ? Number(pos.minH) : 3,
      maxH: pos.maxH ? Number(pos.maxH) : 12,
      isDraggable: pos.isDraggable ?? true,
      isResizable: pos.isResizable ?? true,
      static: pos.static ?? false,
    };

    const downgraded = pos.gridVersion === 2
      ? convertFineGridToLegacyPosition(rawPosition)
      : rawPosition;

    return {
      id: String(pos.i),
      workspaceId: String(pos.workspaceId || defaultWorkspaceId),
      viewId: String(pos.viewId || 'default'),
      widgetId: String(pos.i),
      x: downgraded.x,
      y: downgraded.y,
      w: downgraded.w,
      h: downgraded.h,
      minW: downgraded.minW,
      maxW: downgraded.maxW,
      minH: downgraded.minH,
      maxH: downgraded.maxH,
      isDraggable: pos.isDraggable ?? true,
      isResizable: pos.isResizable ?? true,
      static: pos.static ?? false,
      updatedAt: now,
    };
  });

  // 6. Map legacy dashboard views to WidgetViewRecords
  let viewRecords: WidgetViewRecord[] = legacyViews.map(view => ({
    id: String(view.id),
    workspaceId: String(view.workspaceId || defaultWorkspaceId),
    title: String(view.title || 'Main Dashboard'),
    isDefault: Boolean(view.isDefault),
    collectionLaunchSettings: normalizeCollectionLaunchSettings(view.collectionLaunchSettings),
    settings: view.settings && typeof view.settings === 'object' ? view.settings : {},
    createdAt: Number(view.createdAt) || now,
    updatedAt: Number(view.updatedAt) || now,
  }));

  if (viewRecords.length === 0) {
    const legacyViewIds = Array.from(
      new Set([
        ...widgetRecords.map(widget => widget.viewId).filter(Boolean),
        ...layoutRecords.map(layout => layout.viewId).filter(Boolean),
      ]),
    );
    const fallbackViewIds = legacyViewIds.length > 0 ? legacyViewIds : [`dashboardView_default_${defaultWorkspaceId}`];
    viewRecords = fallbackViewIds.map((viewId, index) => ({
      id: viewId,
      workspaceId: defaultWorkspaceId,
      title: index === 0 ? 'Main Dashboard' : `Dashboard View ${index + 1}`,
      isDefault: index === 0,
      collectionLaunchSettings: normalizeCollectionLaunchSettings(),
      settings: {},
      createdAt: now,
      updatedAt: now,
    }));
  } else if (!viewRecords.some(view => view.isDefault)) {
    viewRecords = viewRecords.map((view, index) => ({
      ...view,
      isDefault: index === 0,
    }));
  }

  // 7. Bulk transaction write to Dexie IndexedDB
  await db.transaction('rw', [db.widgets, db.widgetLayouts, db.widgetViews], async () => {
    if (widgetRecords.length > 0) {
      await db.widgets.bulkPut(widgetRecords);
    }
    if (layoutRecords.length > 0) {
      await db.widgetLayouts.bulkPut(layoutRecords);
    }
    if (viewRecords.length > 0) {
      await db.widgetViews.bulkPut(viewRecords);
    }
  });

  // 8. Mark migration as complete without destroying legacy local storage backup
  await chrome.storage.local.set({
    [MIGRATION_FLAG_KEY]: true,
  });
  setMigrationBootHint();

  widgetMigrationPerf('done:migrated', {
    durationMs: Math.round(performance.now() - startedAt),
    widgetCount: widgetRecords.length,
    layoutCount: layoutRecords.length,
    viewCount: viewRecords.length,
    workspaceId: defaultWorkspaceId,
  });

  return { migratedCount: widgetRecords.length, purged: false };
}

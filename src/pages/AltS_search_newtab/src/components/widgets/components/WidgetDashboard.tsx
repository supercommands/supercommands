import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import WidgetGrid from './WidgetGrid';
import { normalizeWidgetLayout } from '../engine/widgetLayoutEngine';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import {
  applyWidgetSizePresetAsync,
  commitWidgetDashboardLayoutAsync,
  commitWidgetDashboardResizeAsync,
  deleteWidgetInstanceAsync,
  LEGACY_WIDGET_DASHBOARD_STORAGE_KEY,
  loadWidgetDashboardStateAsync,
  purgeMissingNoteWidgetsAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
  WIDGET_DASHBOARD_STORAGE_KEY,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import type { WidgetDashboardState, WidgetGridPosition, WidgetSizePreset } from '../widgetDashboard.types';

import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

interface WidgetDashboardProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
  isEditMode?: boolean;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const WidgetDashboard = ({ scrollContainerRef, isEditMode = false, onQuickCommandSelect }: WidgetDashboardProps) => {
  const [dashboardState, setDashboardState] = useState<WidgetDashboardState | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const notes = useDbStore(state => state.notes);

  useEffect(() => {
    if (!dashboardState || !Array.isArray(notes)) return;
    const validNoteIds = new Set(notes.map(n => n.id));
    const hasOrphanedNoteWidget = dashboardState.widgets.some(
      widget =>
        widget.type === 'note-item' &&
        ((widget.noteId && !validNoteIds.has(widget.noteId)) ||
          (typeof widget.settings?.noteId === 'string' && !validNoteIds.has(widget.settings.noteId))),
    );

    if (hasOrphanedNoteWidget) {
      purgeMissingNoteWidgetsAsync(validNoteIds).then(nextState => {
        setDashboardState(nextState);
      });
    }
  }, [dashboardState, notes]);

  useEffect(() => {
    let mounted = true;
    const fetchState = () => {
      loadWidgetDashboardStateAsync().then(state => {
        if (mounted) {
          setDashboardError(null);
          setDashboardState({
            ...state,
            layout: state.layout,
          });
          setIsLoading(false);
        }
      }).catch(error => {
        if (mounted) {
          setDashboardError(error instanceof Error ? error.message : 'Could not load widgets.');
          setIsLoading(false);
        }
      });
    };

    fetchState();

    const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      if (
        areaName === 'local' &&
        (changes[WIDGET_DASHBOARD_STORAGE_KEY] || changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY])
      ) {
        fetchState();
      }
    };
    const handleWidgetDashboardChange = () => fetchState();
    const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;

    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);

    if (extensionChrome?.storage?.onChanged) {
      extensionChrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      mounted = false;
      if (extensionChrome?.storage?.onChanged) {
        extensionChrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
    };
  }, []);

  useEffect(() => {
    setSelectedWidgetId(null);
  }, [dashboardState?.activeViewId]);

  const activeViewLayout = useMemo(
    () => dashboardState ? normalizeWidgetLayout(dashboardState.layout.filter(position => position.viewId === dashboardState.activeViewId)) : [],
    [dashboardState],
  );

  const sortedWidgets = useMemo(
    () =>
      dashboardState
        ? dashboardState.widgets.filter(
            widget =>
              widget.viewId === dashboardState.activeViewId &&
              activeViewLayout.some(position => position.i === widget.id),
          )
        : [],
    [activeViewLayout, dashboardState],
  );

  const handleCommitLayout = useCallback(
    async (layout: WidgetGridPosition[]) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await commitWidgetDashboardLayoutAsync(activeViewId, layout);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode],
  );

  const handleCommitResize = useCallback(
    async (layout: WidgetGridPosition[], widgetId: string | undefined) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await commitWidgetDashboardResizeAsync(activeViewId, layout, widgetId);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode],
  );

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await deleteWidgetInstanceAsync(activeViewId, widgetId);
      setSelectedWidgetId(null);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode],
  );

  const handleApplyPreset = useCallback(
    async (widgetId: string, preset: WidgetSizePreset) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await applyWidgetSizePresetAsync(activeViewId, widgetId, preset);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode],
  );

  const handleSelectWidget = useCallback(
    (widgetId: string | null) => {
      if (!isEditMode) return;
      setSelectedWidgetId(widgetId);
    },
    [isEditMode],
  );

  useEffect(() => {
    if (!isEditMode) setSelectedWidgetId(null);
  }, [isEditMode]);

  if (isLoading || !dashboardState) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className={`text-sm font-semibold ${dashboardError ? 'text-[var(--color-danger)]' : 'text-[var(--color-textMuted)]'}`}>
          {dashboardError || 'Loading widgets...'}
        </div>
      </div>
    );
  }

  if (sortedWidgets.length === 0) {
    return (
      <div className="flex-1 w-full min-h-[300px] relative select-none pointer-events-none">
        <div className="absolute bottom-8 right-10 text-right">
          <div className="text-sm font-semibold text-[var(--color-textPrimary)]">No widgets added</div>
          <div className="mt-1 text-xs text-[var(--color-textMuted)]">Choose a widget from the right panel.</div>
        </div>
      </div>
    );
  }

  return (
    <WidgetGrid
      widgets={sortedWidgets}
      layout={activeViewLayout}
      scrollContainerRef={scrollContainerRef}
      isEditMode={isEditMode}
      selectedWidgetId={selectedWidgetId}
      onSelectWidget={handleSelectWidget}
      onCommitLayout={handleCommitLayout}
      onCommitResize={handleCommitResize}
      onDeleteWidget={handleDeleteWidget}
      onApplyPreset={handleApplyPreset}
      onQuickCommandSelect={onQuickCommandSelect}
    />
  );
};

export default WidgetDashboard;

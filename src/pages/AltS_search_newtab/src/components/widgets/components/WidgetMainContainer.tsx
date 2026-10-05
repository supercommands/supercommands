import { useEffect, useLayoutEffect, useRef } from 'react';
import type { FC } from 'react';
import 'react-grid-layout/css/styles.css';
import WidgetDashboard from './WidgetDashboard';
import WorkspaceCollectionView from './WorkspaceCollectionView';
import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import { isMainDashboardView } from '../engine/widgetDashboardData';
import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import { startupPerf } from '../../../startupPerf';
/**
 * Placeholder for the future isolated widget main container.
 *
 * Current contract:
 * - It must remain a sibling of existing main views, never a wrapper around them.
 * - It must not wrap or alter BoardView, SpreadsheetMainContainer, Searchbar, editors, popups, or modals.
 * - Future rendering must be guarded so it is hidden whenever board view, sheet view, editors, prompts,
 *   links, notes, AI/agent panels, settings, tutorial, embedded mode, or search suggestions are active.
 */
interface WidgetMainContainerProps {
    isEditMode?: boolean;
    onEnterWidgetEditMode?: (widgetId?: string) => void;
    onExitWidgetEditMode?: () => void;
    pendingSelectedWidgetId?: string | null;
    onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}
const WidgetMainContainer: FC<WidgetMainContainerProps> = ({ isEditMode = false, onEnterWidgetEditMode, onExitWidgetEditMode, pendingSelectedWidgetId, onQuickCommandSelect, }) => {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    const scrollContainerRef = useRef<HTMLElement>(null);
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const activeDashboardView = dashboardState?.views.find(view => view.id === dashboardState.activeViewId);
    const shouldRenderWidgetDashboard = !activeDashboardView || isMainDashboardView(activeDashboardView);
    const didResetAfterHydrationRef = useRef(false);
    useLayoutEffect(() => {
        if (!dashboardState || didResetAfterHydrationRef.current)
            return;
        didResetAfterHydrationRef.current = true;
        if (scrollContainerRef.current)
            scrollContainerRef.current.scrollTop = 0;
    }, [dashboardState]);
    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        const resetScroll = () => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
            window.scrollTo(0, 0);
        };
        resetScroll();
        window.addEventListener('pageshow', resetScroll);
        const timer = setTimeout(resetScroll, 0);
        const rAF = requestAnimationFrame(resetScroll);
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(rAF);
            window.removeEventListener('pageshow', resetScroll);
        };
    }, []);
    useEffect(() => {
        startupPerf('WidgetMainContainer:commit', {
            renderCount: renderCountRef.current,
            isEditMode,
            hasPendingSelectedWidget: Boolean(pendingSelectedWidgetId),
        });
    });
    return (<section ref={scrollContainerRef} className="main-page-scrollbar w-full h-full min-h-0 max-h-full flex flex-col relative box-border overflow-y-auto overflow-x-hidden overscroll-contain" style={{ overflowAnchor: 'none' }} data-widget-main-container="true">
      {shouldRenderWidgetDashboard ? (<>
          <WidgetDashboard scrollContainerRef={scrollContainerRef} isEditMode={isEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} pendingSelectedWidgetId={pendingSelectedWidgetId} onQuickCommandSelect={onQuickCommandSelect}/>
        </>) : (<WorkspaceCollectionView />)}
    </section>);
};
export default WidgetMainContainer;

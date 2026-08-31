import * as React from 'react';
import logoUrl from './assets/cmdOS_logo.png';
import { useUIStore } from './uiStateManager';
import { useWidgetDashboardStore } from '../storage/store/useWidgetDashboardStore';
import { switchWidgetDashboardViewAsync } from '../storage/localStorage/widgetDashboardStorage';

interface BrandingProps {
  className?: string;
  onClick?: () => void;
  showAvatar?: boolean;
  showText?: boolean;
  textColor?: string;
}

const Branding: React.FC<BrandingProps> = ({
  className = '',
  onClick,
  showText = true,
  textColor = 'text-[var(--color-textPrimary)]',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
    const store = useUIStore.getState();
    if (store.isSheetOpen) {
      store.closeSheet();
    }
    if (store.activeEditor) {
      store.closeEditor();
    }
    store.setView({ type: 'home' });

    // Reset Workspace Collection / Dashboard View to Default View (e.g. Main Dashboard)
    try {
      const dashboardStore = useWidgetDashboardStore.getState();
      const dashboardState = dashboardStore.state;
      const workspaceId = dashboardStore.workspaceId || 'default';

      if (dashboardState?.views && dashboardState.views.length > 0) {
        const defaultView =
          dashboardState.views.find(v => v.isDefault === true) ||
          dashboardState.views.find(v => v.title === 'Main Dashboard') ||
          dashboardState.views[0];

        if (defaultView && dashboardState.activeViewId !== defaultView.id) {
          switchWidgetDashboardViewAsync(defaultView.id, workspaceId, {
            trigger: 'manual-click',
            forceDispatch: true,
          })
            .then(nextState => {
              dashboardStore.setDashboardState(nextState, workspaceId);
            })
            .catch(err => {
              console.error('[Branding] Failed to switch to default dashboard view:', err);
            });
        }
      }
    } catch (err) {
      console.error('[Branding] Error resetting dashboard view:', err);
    }
  };

  return (
    <div className={`flex items-center z-50 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          className={`h-7 w-7 object-contain rounded cursor-pointer select-none ${showText ? 'mr-2' : ''}`}
          onClick={handleClick}
          alt="cmdOS"
        />
      ) : null}
      {showText && (
        <span className={`text-lg ${textColor} font-comfortaa cursor-pointer select-none`} onClick={handleClick}>
          cmdOS
        </span>
      )}
    </div>
  );
};

export default Branding;

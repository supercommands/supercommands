import React, { useEffect } from 'react';
import { FavoritesGrid } from '../../../landingPage/views/FavoritesGrid';
import type { WidgetInstance } from '../widgetDashboard.types';
import { widgetPerf } from '../utils/widgetPerf';

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface FavoritesWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

export const FavoritesWidget: React.FC<FavoritesWidgetProps> = ({ widget, isEditMode = false }) => {
  useEffect(() => {
    widgetPerf('body:delegatedToFavoritesGrid', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      sizePreset: widget.sizePreset,
    });
  }, [widget.id, widget.sizePreset, widget.type, widget.viewId]);

  return (
    <div className="h-full w-full overflow-hidden">
      <FavoritesGrid
        variant="widget"
        sizePreset={widget.sizePreset}
        isWidgetEditMode={isEditMode}
      />
    </div>
  );
};

export default FavoritesWidget;

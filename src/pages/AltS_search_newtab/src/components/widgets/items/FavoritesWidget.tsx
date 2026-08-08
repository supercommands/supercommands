import React from 'react';
import { FavoritesGrid } from '../../../landingPage/views/FavoritesGrid';
import type { WidgetInstance } from '../widgetDashboard.types';

interface FavoritesWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
}

export const FavoritesWidget: React.FC<FavoritesWidgetProps> = ({ widget, isEditMode = false }) => {
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

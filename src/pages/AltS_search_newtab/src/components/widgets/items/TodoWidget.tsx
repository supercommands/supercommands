import { useEffect } from 'react';
import type * as React from 'react';
import TodoList from '../../../../../../allObjectFolder/src/createObject/todos/ui/TodoList';
import type { WidgetInstance } from '../widgetDashboard.types';
import { widgetPerf } from '../utils/widgetPerf';

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface TodoWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({ widget, isEditMode = false }) => {
  useEffect(() => {
    widgetPerf('body:delegatedToEditor', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      sizePreset: widget.sizePreset,
    });
  }, [widget.id, widget.sizePreset, widget.type, widget.viewId]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <TodoList
        isOpen={true}
        onClose={() => {}}
        isSidebar={false}
        isWidget={true}
        widgetSizePreset={widget.sizePreset}
        showWidgetDisplayModeControl={isEditMode}
      />
    </div>
  );
};

export default TodoWidget;

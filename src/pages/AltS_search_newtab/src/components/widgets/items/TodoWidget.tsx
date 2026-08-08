import type * as React from 'react';
import TodoList from '../../../../../../allObjectFolder/src/createObject/todos/ui/TodoList';
import type { WidgetInstance } from '../widgetDashboard.types';

interface TodoWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({ widget, isEditMode = false }) => {
  return (
    <div className="h-full w-full overflow-hidden relative">
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

import type * as React from 'react';
import type { WidgetInstance } from '../widgetDashboard.types';
import { NoteEditorView } from '../../../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView';

interface NoteWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
}

const NoteWidget: React.FC<NoteWidgetProps> = ({ widget, isEditMode = false }) => {
  return (
    <div className="w-full h-full overflow-hidden">
      <NoteEditorView
        noteId={widget.noteId}
        isWidgetMode={true}
        isFullScreenMode={false}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default NoteWidget;

import { useEffect } from 'react';
import type * as React from 'react';
import type { WidgetInstance } from '../widgetDashboard.types';
import { NoteEditorView } from '../../../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView';
import { widgetPerf } from '../utils/widgetPerf';

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface NoteWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

const NoteWidget: React.FC<NoteWidgetProps> = ({ widget, isEditMode = false }) => {
  useEffect(() => {
    widgetPerf('body:delegatedToEditor', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      noteId: widget.noteId,
    });
  }, [widget.id, widget.noteId, widget.type, widget.viewId]);

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

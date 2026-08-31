import React, { Suspense, useCallback, useEffect } from 'react';
import type { WidgetInstance } from '../widgetDashboard.types';
import { updateWidgetReferenceAsync } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import { widgetPerf } from '../utils/widgetPerf';

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

const SessionEditorView = React.lazy(
  () => import('../../../../../../allObjectFolder/src/createObject/session/ui/SessionEditorView'),
);

interface SessionWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

const SessionWidget: React.FC<SessionWidgetProps> = ({ widget, isEditMode = false }) => {
  const sessionId = widget.sessionId || (widget.referenceType === 'session' ? widget.referenceId : undefined);
  const sessionWidgetKey = `${widget.id}:${widget.sessionId || 'unlinked'}`;

  useEffect(() => {
    widgetPerf('body:delegatedToEditor', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      sessionId,
      referenceId: widget.referenceId,
      referenceType: widget.referenceType,
    });
  }, [sessionId, widget.id, widget.viewId, widget.referenceId, widget.referenceType, widget.type]);

  const handleSessionCreated = useCallback(async (newSessionId: string) => {
    if (!widget.id) return;
    try {
      await updateWidgetReferenceAsync(widget.id, newSessionId);
    } catch (err) {
      console.error('[SessionWidget] Failed to link session to widget:', err);
    }
  }, [widget.id]);

  return (
    <div data-session-widget-root className="w-full h-full overflow-hidden flex flex-col">
      <Suspense fallback={null}>
        <SessionEditorView
          key={sessionWidgetKey}
          isOpen={true}
          sessionId={sessionId}
          session={sessionId ? { id: sessionId } : null}
          isWidgetMode={true}
          isFullScreenMode={false}
          isEditMode={isEditMode}
          widgetId={widget.id}
          viewId={widget.viewId}
          widgetTitle={widget.title || 'Session'}
          onSessionCreated={handleSessionCreated}
        />
      </Suspense>
    </div>
  );
};

export default SessionWidget;

import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { LuCode, LuRefreshCw } from 'react-icons/lu';
import {
  loadHtmlWidgetContentAsync,
  saveHtmlWidgetContentAsync,
  type HtmlWidgetContentRecord,
} from '../../../../../../storage/localStorage/htmlWidgetContentStorage';
import HtmlWidgetSetupModal, { makeIframeSrcDoc, type ParsedHtmlWidgetContent } from '../modals/HtmlWidgetSetupModal';
import type { WidgetInstance } from '../widgetDashboard.types';

interface HtmlWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
}

const getContentId = (widget: WidgetInstance) => {
  const contentId = widget.settings?.contentId;
  return typeof contentId === 'string' ? contentId : '';
};

const HtmlWidget: React.FC<HtmlWidgetProps> = ({ widget, isEditMode = false }) => {
  const contentId = getContentId(widget);
  const [content, setContent] = useState<HtmlWidgetContentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(contentId));
  const [error, setError] = useState('');
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!contentId) {
      setContent(null);
      setIsLoading(false);
      setError('HTML content is missing.');
      return undefined;
    }

    setIsLoading(true);
    setError('');
    loadHtmlWidgetContentAsync(contentId)
      .then(record => {
        if (!mounted) return;
        setContent(record);
        setError(record ? '' : 'HTML content was not found.');
      })
      .catch(loadError => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load HTML content.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [contentId]);

  const srcDoc = useMemo(() => (content ? makeIframeSrcDoc(content) : ''), [content]);

  const handleReplace = async (nextContent: ParsedHtmlWidgetContent) => {
    if (!contentId) throw new Error('HTML content is missing.');
    const savedContent = await saveHtmlWidgetContentAsync({
      contentId,
      title: nextContent.title,
      html: nextContent.html,
      css: nextContent.css,
      js: nextContent.js,
      originalSource: nextContent.originalSource,
      warnings: nextContent.warnings,
    });
    setContent(savedContent);
    setError('');
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs font-semibold text-[var(--color-textSecondary)]">
        <LuRefreshCw className="animate-spin" size={20} />
        Loading HTML...
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-xs font-semibold text-[var(--color-textSecondary)]">
        <LuCode size={24} className="text-[var(--color-iconDefault)]" />
        <div>{error || 'HTML content unavailable.'}</div>
        {isEditMode && (
          <button
            type="button"
            data-no-widget-drag="true"
            onClick={event => {
              event.stopPropagation();
              setIsSetupOpen(true);
            }}
            className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-bold text-[var(--color-textPrimary)]">
            Replace
          </button>
        )}
        <HtmlWidgetSetupModal isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} onSave={handleReplace} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {isEditMode && (
        <button
          type="button"
          data-no-widget-drag="true"
          onPointerDown={event => event.stopPropagation()}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            setIsSetupOpen(true);
          }}
          className="absolute right-3 top-3 z-10 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-widgetToolbarBg)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--color-widgetToolbarText)] shadow-lg">
          Edit / Replace
        </button>
      )}
      <iframe
        title={content.title || widget.title || 'HTML Widget'}
        sandbox="allow-scripts allow-popups allow-forms"
        srcDoc={srcDoc}
        className="h-full w-full border-0"
        data-no-widget-drag="true"
      />
      <HtmlWidgetSetupModal
        isOpen={isSetupOpen}
        initialContent={content}
        onClose={() => setIsSetupOpen(false)}
        onSave={handleReplace}
      />
    </div>
  );
};

export default HtmlWidget;

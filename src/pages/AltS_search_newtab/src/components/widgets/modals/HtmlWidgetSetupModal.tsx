import { useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import ReactDOM from 'react-dom';
import { LuArrowLeft, LuCheck, LuCode, LuFileUp, LuPlay, LuTriangleAlert, LuX } from 'react-icons/lu';
import type { HtmlWidgetContentRecord } from '../../../../../../storage/localStorage/htmlWidgetContentStorage';

export interface ParsedHtmlWidgetContent {
  title: string;
  html: string;
  css: string;
  js: string;
  originalSource: string;
  warnings: string[];
  sourceType?: 'upload' | 'paste' | 'blank';
  fileName?: string;
}

interface HtmlWidgetSetupModalProps {
  isOpen: boolean;
  initialContent?: HtmlWidgetContentRecord | null;
  onClose: () => void;
  onSave: (content: ParsedHtmlWidgetContent) => Promise<void> | void;
}

type SetupStep = 'upload' | 'preview' | 'permissions';

const MAX_HTML_FILE_SIZE_BYTES = 1024 * 1024;
const BLANK_HTML_SOURCE =
  '<div class="html-widget-blank">\n  <h1>Hello HTML Widget</h1>\n  <p>Edit or replace this widget with your own HTML.</p>\n</div>';

const isRenderableContent = (content: ParsedHtmlWidgetContent) =>
  Boolean(content.html.trim() || content.css.trim() || content.js.trim());

const makeIframeSrcDoc = ({ html, css, js }: Pick<ParsedHtmlWidgetContent, 'html' | 'css' | 'js'>) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        width: 100%;
        min-height: 100%;
        margin: 0;
        overflow-x: hidden;
        overflow-y: auto;
        box-sizing: border-box;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      *, *::before, *::after { box-sizing: inherit; max-width: 100%; }
      img, video, canvas, svg { max-width: 100%; height: auto; }
      body { padding: 16px; color: #111827; background: #ffffff; }
      ${css}
    </style>
  </head>
  <body>
    ${html}
    <script>
      try {
        ${js}
      } catch (error) {
        console.error('[HTML Widget]', error);
      }
    </script>
  </body>
</html>`;

export const parseHtmlWidgetSource = (source: string): ParsedHtmlWidgetContent => {
  const originalSource = source;
  const warnings: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');

  const parserError = doc.querySelector('parsererror');
  if (parserError) warnings.push('The HTML parser reported malformed markup; preview may still render.');

  const title = doc.querySelector('title')?.textContent?.trim() || 'HTML Widget';
  const css = Array.from(doc.querySelectorAll('style'))
    .map(style => style.textContent || '')
    .join('\n\n')
    .trim();

  const inlineScripts: string[] = [];
  doc.querySelectorAll('script').forEach(script => {
    const src = script.getAttribute('src');
    if (src) {
      warnings.push(`External script blocked: ${src}`);
      script.remove();
      return;
    }
    inlineScripts.push(script.textContent || '');
    script.remove();
  });

  doc.querySelectorAll('link[rel~="stylesheet"], img[src], source[src], video[src], audio[src]').forEach(element => {
    const url = element.getAttribute('href') || element.getAttribute('src') || '';
    if (/^(file:|\.{0,2}\/)/i.test(url)) {
      warnings.push(`Local asset reference may not load inside the widget: ${url}`);
    }
  });

  doc.querySelectorAll('style').forEach(style => style.remove());
  const bodyHtml = doc.body?.innerHTML?.trim() || source.trim();

  return {
    title,
    html: bodyHtml,
    css,
    js: inlineScripts.join('\n\n').trim(),
    originalSource,
    warnings: Array.from(new Set(warnings)),
  };
};

const HtmlWidgetSetupModal: React.FC<HtmlWidgetSetupModalProps> = ({
  isOpen,
  initialContent = null,
  onClose,
  onSave,
}) => {
  const [step, setStep] = useState<SetupStep>('upload');
  const [sourceText, setSourceText] = useState(initialContent?.originalSource || '');
  const [fileName, setFileName] = useState('');
  const [parsedContent, setParsedContent] = useState<ParsedHtmlWidgetContent | null>(
    initialContent
      ? {
          title: initialContent.title,
          html: initialContent.html,
          css: initialContent.css,
          js: initialContent.js,
          originalSource: initialContent.originalSource,
          warnings: initialContent.warnings,
        }
      : null,
  );
  const [allowScripts, setAllowScripts] = useState(Boolean(initialContent?.js));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewSrcDoc = useMemo(() => (parsedContent ? makeIframeSrcDoc(parsedContent) : ''), [parsedContent]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('upload');
    setSourceText(initialContent?.originalSource || '');
    setFileName('');
    setParsedContent(
      initialContent
        ? {
            title: initialContent.title,
            html: initialContent.html,
            css: initialContent.css,
            js: initialContent.js,
            originalSource: initialContent.originalSource,
            warnings: initialContent.warnings,
          }
        : null,
    );
    setAllowScripts(Boolean(initialContent?.js));
    setError('');
    setIsSaving(false);
  }, [initialContent, isOpen]);

  if (!isOpen) return null;

  const handleParsedContent = (
    content: ParsedHtmlWidgetContent,
    nextFileName = '',
    sourceType: ParsedHtmlWidgetContent['sourceType'] = 'paste',
  ) => {
    if (!isRenderableContent(content)) {
      setError('Add HTML, CSS, or JavaScript before previewing.');
      return;
    }
    setError('');
    setParsedContent({ ...content, fileName: nextFileName, sourceType });
    setFileName(nextFileName);
    setAllowScripts(Boolean(content.js.trim()));
    setStep('preview');
  };

  const handlePreviewFromText = () => {
    const source = sourceText.trim();
    if (!source) {
      setError('Paste HTML or start from a blank widget first.');
      return;
    }
    handleParsedContent(parseHtmlWidgetSource(source), '', 'paste');
  };

  const handleStartBlank = () => {
    setSourceText(BLANK_HTML_SOURCE);
    handleParsedContent(parseHtmlWidgetSource(BLANK_HTML_SOURCE), '', 'blank');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'html' && extension !== 'htm') {
      setError('Upload a .html or .htm file.');
      return;
    }
    if (file.size > MAX_HTML_FILE_SIZE_BYTES) {
      setError('HTML files must be 1 MB or smaller.');
      return;
    }

    try {
      const text = await file.text();
      setSourceText(text);
      handleParsedContent(parseHtmlWidgetSource(text), file.name, 'upload');
    } catch {
      setError('Could not read this HTML file.');
    }
  };

  const handleSave = async () => {
    if (!parsedContent) return;
    if (parsedContent.js.trim() && !allowScripts) {
      setError('Confirm script-enabled rendering before saving.');
      setStep('permissions');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSave({
        ...parsedContent,
        fileName,
        warnings: fileName ? [...parsedContent.warnings, `Source file: ${fileName}`] : parsedContent.warnings,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save HTML widget.');
    } finally {
      setIsSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[var(--color-overlayBg)] px-4">
      <div
        className="flex h-[min(720px,88vh)] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border"
        style={{
          backgroundColor: 'var(--color-cardBg)',
          borderColor: 'var(--color-borderDefault)',
          boxShadow: '0 22px 60px var(--color-widgetToolbarShadow)',
        }}>
        <div className="flex items-center justify-between border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <LuCode size={18} className="shrink-0 text-[var(--color-iconDefault)]" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--color-textPrimary)]">HTML Widget</div>
              <div className="text-[11px] font-semibold text-[var(--color-textMuted)]">
                {step === 'upload'
                  ? 'Upload, paste, or start blank'
                  : step === 'preview'
                    ? 'Preview before saving'
                    : 'Confirm rendering permissions'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-textMuted)] hover:bg-[var(--color-bgHover)] hover:text-[var(--color-textPrimary)]">
            <LuX size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
          {step === 'upload' && (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-4 py-3 text-xs font-bold text-[var(--color-textPrimary)] hover:bg-[var(--color-bgHover)]">
                  <LuFileUp size={15} />
                  Upload HTML
                </button>
                <button
                  type="button"
                  onClick={handleStartBlank}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-4 py-3 text-xs font-bold text-[var(--color-textPrimary)] hover:bg-[var(--color-bgHover)]">
                  <LuCode size={15} />
                  Start Blank
                </button>
              </div>
              <textarea
                value={sourceText}
                onChange={event => setSourceText(event.target.value)}
                placeholder="Paste full HTML or a renderable HTML fragment..."
                className="min-h-0 flex-1 resize-none rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-3 font-mono text-xs text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-borderActive)]"
              />
            </div>
          )}

          {step === 'preview' && parsedContent && (
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_220px] gap-4">
              <div className="min-h-0 overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-white">
                <iframe
                  title="HTML widget preview"
                  sandbox="allow-scripts allow-popups allow-forms"
                  srcDoc={previewSrcDoc}
                  className="h-full w-full border-0"
                />
              </div>
              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                <div>
                  <div className="text-[11px] font-bold uppercase text-[var(--color-textMuted)]">Title</div>
                  <div className="mt-1 truncate text-sm font-bold text-[var(--color-textPrimary)]">
                    {parsedContent.title}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-3 text-[11px] font-semibold leading-5 text-[var(--color-textSecondary)]">
                  Inline JavaScript is isolated in a sandboxed iframe. Public `fetch` calls depend on browser CORS.
                </div>
                {parsedContent.warnings.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-[var(--color-textMuted)]">
                      <LuTriangleAlert size={13} />
                      Warnings
                    </div>
                    {parsedContent.warnings.map(warning => (
                      <div
                        key={warning}
                        className="rounded-md bg-[var(--color-dangerBg)] p-2 text-[11px] font-semibold text-[var(--color-danger)]">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'permissions' && parsedContent && (
            <div className="flex flex-1 flex-col justify-center gap-4">
              <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-4">
                <div className="text-sm font-bold text-[var(--color-textPrimary)]">Script-enabled rendering</div>
                <div className="mt-2 text-xs font-semibold leading-5 text-[var(--color-textSecondary)]">
                  This widget runs inline JavaScript inside a sandboxed iframe without same-origin access. External
                  scripts are blocked in v1. Do not paste private API keys or secrets.
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-3 text-xs font-bold text-[var(--color-textPrimary)]">
                <input
                  type="checkbox"
                  checked={allowScripts}
                  onChange={event => setAllowScripts(event.target.checked)}
                  className="h-4 w-4"
                />
                Allow inline scripts for this HTML widget
              </label>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-[var(--color-dangerBg)] px-3 py-2 text-[11px] font-bold text-[var(--color-danger)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-borderDefault)] px-5 py-4">
          <button
            type="button"
            onClick={() => setStep(step === 'permissions' ? 'preview' : 'upload')}
            disabled={step === 'upload'}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-bold text-[var(--color-textSecondary)] hover:bg-[var(--color-bgHover)] disabled:cursor-not-allowed disabled:opacity-40">
            <LuArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button
                type="button"
                onClick={handlePreviewFromText}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-bold text-[var(--color-textPrimary)]">
                <LuPlay size={14} />
                Preview
              </button>
            )}
            {step === 'preview' && parsedContent?.js.trim() && (
              <button
                type="button"
                onClick={() => setStep('permissions')}
                className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-bold text-[var(--color-textPrimary)] hover:bg-[var(--color-bgHover)]">
                Permissions
              </button>
            )}
            {step !== 'upload' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-bold text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-60">
                <LuCheck size={14} />
                {isSaving ? 'Saving...' : 'Save Widget'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export { makeIframeSrcDoc };
export default HtmlWidgetSetupModal;

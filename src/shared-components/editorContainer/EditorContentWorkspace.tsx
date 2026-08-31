import * as React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SnippetBuilderMainViewEditor } from '../../allObjectFolder/src/createObject/snippets/AdvancedSnippetEditor/SnippetBuilderMainView';

export interface EditorContentWorkspaceProps {
  category: 'snippet' | 'link' | 'session' | 'aiPrompt' | 'todo';
  
  // Snippet specific props
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onBlurCapture?: () => void;
  onCreateAnother?: () => void;
  activeId?: string | null;

  // Render fallback or custom children if needed
  children?: React.ReactNode;
}

export const EditorContentWorkspace: React.FC<EditorContentWorkspaceProps> = ({
  category,
  containerRef,
  onBlurCapture,
  onCreateAnother,
  activeId,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  if (category === 'snippet') {
    return (
      <div className="flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-[var(--color-textPrimary)] pt-0.5 pb-1">
        <div className="flex flex-col gap-1.5 min-h-0 flex-1 mt-4">
          <label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center gap-1">
            Content <span className="text-red-500">*</span>
          </label>
          <div
            className="relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm overflow-y-auto custom-scrollbar px-3.5 py-2 cursor-text"
            style={{ minHeight: '220px', maxHeight: 'clamp(280px, 35vh, 400px)' }}
            ref={containerRef as any}
            onBlurCapture={onBlurCapture}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const editorDom = e.currentTarget.querySelector('.ProseMirror') as HTMLElement | null;
                editorDom?.focus();
              }
            }}
          >
            <SnippetBuilderMainViewEditor />

            {activeId && onCreateAnother && (
              <button
                id="create-another-btn"
                type="button"
                onClick={onCreateAnother}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPos({
                    top: rect.top + window.scrollY - 46,
                    left: rect.left + window.scrollX - 40,
                  });
                  setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}
                className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none"
              >
                <span>Create another</span>
              </button>
            )}
          </div>
        </div>

        {showTooltip && createPortal(
          <div
            style={{
              position: 'absolute',
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
            }}
            className="bg-[var(--color-popupBg)] border border-[var(--color-borderDefault)] rounded-xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none"
          >
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Ctrl</kbd>
              <span className="text-[10px] text-[var(--color-textMuted)] font-bold">+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Shift</kbd>
              <span className="text-[10px] text-[var(--color-textMuted)] font-bold">+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Enter</kbd>
            </div>
            <span className="text-[var(--color-textMuted)] text-left whitespace-nowrap">to save and create new</span>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // Fallback for links, sessions, etc.
  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {children}
    </div>
  );
};

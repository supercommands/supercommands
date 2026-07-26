import React, { useState } from 'react';
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
      <div className="flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white pt-0.5 pb-1">
        <div className="flex flex-col gap-1.5 min-h-0 flex-1 mt-4">
          <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-3.5 flex items-center gap-1">
            Content <span className="text-red-500">*</span>
          </label>
          <div
            className="flex-1 min-h-[120px] relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-3.5 py-2"
            ref={containerRef as any}
            onBlurCapture={onBlurCapture}
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
                className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-black/10 dark:border-white/20 bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/90 hover:bg-neutral-200 dark:hover:bg-white/20 hover:text-neutral-900 dark:hover:text-white cursor-pointer select-none"
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
            className="bg-[#1c1d27] border border-[#2f3142] rounded-xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex items-center gap-3 text-[12px] font-sans text-white pointer-events-none"
          >
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Ctrl</kbd>
              <span className="text-[10px] text-neutral-400 font-bold">+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
              <span className="text-[10px] text-neutral-400 font-bold">+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
            </div>
            <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
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

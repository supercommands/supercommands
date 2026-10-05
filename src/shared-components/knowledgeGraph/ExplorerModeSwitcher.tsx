import type * as React from 'react';
import { useDbStore } from '../../storage/store/useDbStore';
export type ExplorerMode = 'graph' | 'spreadsheet';
interface ExplorerModeSwitcherProps {
    mode: ExplorerMode;
    onModeChange: (mode: ExplorerMode) => void;
}
const ExplorerModeSwitcher: React.FC<ExplorerModeSwitcherProps> = ({ mode, onModeChange }) => {
    const graphNodeCount = useDbStore(state => state.notes.filter(item => !item.deletedAt).length +
        state.links.filter(item => !item.deletedAt).length +
        state.snippets.filter(item => !item.deletedAt).length +
        state.todos.length +
        state.sessions.filter(item => !item.deletedAt).length +
        state.aiPrompts.filter(item => !item.deletedAt).length +
        state.chatAgents.filter(item => !item.deletedAt).length);
    const textCommandCount = useDbStore(state => Object.values(state.shortcutsMap).filter(command => String(command || '').trim()).length);
    return (<div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-1" role="group" aria-label="Explorer view">
      <button type="button" aria-label={`Knowledge graph view, ${graphNodeCount} nodes`} aria-pressed={mode === 'graph'} title="Knowledge graph" onClick={() => onModeChange('graph')} className={`flex h-8 items-center justify-center gap-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${mode === 'graph'
            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
            : 'text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
        <span className="text-xs font-semibold">Graph</span>
        <span className="text-[var(--color-textMuted)]" aria-hidden="true">·</span>
        <span className="text-xs font-semibold tabular-nums">{graphNodeCount}</span>
      </button>
      <button type="button" aria-label={`Commands view${textCommandCount > 0 ? `, ${textCommandCount} text commands` : ''}`} aria-pressed={mode === 'spreadsheet'} title="Commands" onClick={() => onModeChange('spreadsheet')} className={`flex h-8 items-center justify-center gap-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${mode === 'spreadsheet'
            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
            : 'text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
        <span className="text-xs font-semibold">Commands</span>
        {textCommandCount > 0 && (<>
            <span className="text-[var(--color-textMuted)]" aria-hidden="true">·</span>
            <span className="text-xs font-semibold tabular-nums">{textCommandCount}</span>
          </>)}
      </button>
    </div>);
};
export default ExplorerModeSwitcher;

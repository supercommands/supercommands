import { Clock3 } from 'lucide-react';
import { useUIStore } from '../../../../../shared-components/uiStateManager';

const TimelineSidebarEntry = ({ compact, iconOnly }: { compact: boolean; iconOnly: boolean }) => {
    const active = useUIStore(state => state.activeView.type === 'timeline' && !state.activeEditor);
    const open = () => {
        const state = useUIStore.getState();
        if (state.isSheetOpen) state.closeSheet();
        state.clearEditorStates();
        state.setView({ type: 'timeline' });
    };
    return <div className={iconOnly ? 'mx-1 px-0.5' : compact ? 'mx-1 px-0.5' : 'mx-2 px-2'}>
        <button type="button" onClick={open} title="Recent" aria-label="Recent" aria-current={active ? 'page' : undefined}
            className={`group flex w-full min-w-0 items-center rounded-md text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)] ${active ? 'bg-[var(--color-selectedBg)]' : ''} ${iconOnly ? 'h-10 flex-col justify-center gap-0.5 px-1' : compact ? 'h-7 gap-1.5 px-1.5' : 'h-7 gap-2 px-2'}`}>
            <span className={`flex shrink-0 items-center justify-center ${iconOnly || !compact ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} aria-hidden="true">
                <Clock3 size={iconOnly || !compact ? 15 : 11} className="shrink-0 text-[var(--color-iconDefault)]"/>
            </span>
            <span className={`min-w-0 truncate font-medium ${active ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-textSecondary)]'} ${iconOnly ? 'text-center text-[8px]' : compact ? 'text-left text-[9px]' : 'text-left text-[12.5px]'}`}>Recent</span>
        </button>
    </div>;
};

export default TimelineSidebarEntry;

import * as React from 'react';
import { createPortal } from 'react-dom';
export interface CreateAnotherShortcutTooltipProps {
    position: {
        top: number;
        left: number;
    };
    message?: string;
    portalTarget?: Element | DocumentFragment | null;
    appearanceTokens?: React.CSSProperties;
    positionStrategy?: 'absolute' | 'fixed';
}
export const CreateAnotherShortcutTooltip: React.FC<CreateAnotherShortcutTooltipProps> = ({ position, message = 'to save and create another', portalTarget, appearanceTokens, positionStrategy = 'absolute', }) => {
    const isMac = typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
    const keyClass = 'px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]';
    return createPortal(<div style={{
            ...appearanceTokens,
            position: positionStrategy,
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 2147483647,
            color: 'var(--color-textPrimary)',
        }} className="max-w-[calc(100vw-24px)] rounded-xl border border-[var(--color-borderDefault)] bg-[#0E0F10] px-3 py-2 shadow-2xl z-alts-subpopup flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
      <div className="flex items-center gap-1">
        <kbd className={keyClass}>{isMac ? 'Cmd' : 'Ctrl'}</kbd>
        <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
        <kbd className={keyClass}>Shift</kbd>
        <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
        <kbd className={keyClass}>Enter</kbd>
      </div>
      <span className="whitespace-nowrap text-[var(--color-textSecondary)] font-medium">
        {message}
      </span>
    </div>, portalTarget || document.body);
};

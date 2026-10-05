import React from 'react';
import LeftSideWidget from './leftSideWidget';
import { LuCircleHelp, LuX } from 'react-icons/lu';
import { getTheme, useAppearance } from '@extension/ui';
import { CMDOS_WIDGETS_DOCS_URL } from '../../../../../../storage/API/core/apiConfig';
interface RightSideWidgetProps {
    onClose?: () => void;
}
export const WIDGET_CATALOG_PANEL_WIDTH = 280;
// 180px labeled navigation + 280px catalog + 48px canvas inset +
// 32px grid inset + 256px minimum readable card.
export const WIDGET_CATALOG_MIN_DOCK_VIEWPORT_WIDTH = 796;
export const RightSideWidget: React.FC<RightSideWidgetProps> = ({ onClose }) => {
    const { theme } = useAppearance();
    const selectedDarkTheme = theme.isDark && !theme.wallpaper ? getTheme(theme.id) : null;
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
    React.useEffect(() => {
        const measure = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);
    return (<aside aria-label="Widget Catalog Panel" className="fixed right-0 top-0 h-full shrink-0 flex flex-col pt-[56px] border-l border-neutral-200 dark:border-white/10 shadow-2xl z-[9999] bg-[var(--color-sidebarBg)] select-none pointer-events-auto relative" style={{
            width: `${WIDGET_CATALOG_PANEL_WIDTH}px`,
            position: viewportWidth < WIDGET_CATALOG_MIN_DOCK_VIEWPORT_WIDTH ? 'fixed' : 'relative',
            backgroundColor: selectedDarkTheme?.tokens.sidebarBg ?? (theme.wallpaper ? theme.tokens.cardBg : undefined),
            ...(selectedDarkTheme ? { '--color-cardBg': selectedDarkTheme.tokens.cardBg } : {}),
        } as React.CSSProperties}>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <a href={CMDOS_WIDGETS_DOCS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open SuperCommands widgets documentation" title="Help and documentation" className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
          <LuCircleHelp size={18}/>
        </a>
        {onClose && (<button type="button" onClick={onClose} aria-label="Close widget panel" title="Close edit mode" className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
            <LuX size={18}/>
          </button>)}
      </div>
      <LeftSideWidget />
    </aside>);
};
export default RightSideWidget;

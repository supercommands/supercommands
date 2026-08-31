import type * as React from 'react';
import LeftSideWidget from './leftSideWidget';
import { LuCircleHelp } from 'react-icons/lu';
import { CMDOS_DOCS_URL } from '../../../../../../storage/API/core/apiConfig';

export const RightSideWidget: React.FC = () => {
  return (
    <aside
      aria-label="Widget Catalog Panel"
      className="fixed right-0 top-0 h-full shrink-0 flex flex-col pt-[56px] border-l border-neutral-200 dark:border-white/10 shadow-2xl z-[9999] bg-[var(--color-sidebarBg)] select-none pointer-events-auto relative"
      style={{
        width: '280px',
      }}>
      <a
        href={CMDOS_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open cmdOS documentation"
        title="Help and documentation"
        className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] text-[var(--color-iconDefault)] shadow-sm transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer"
      >
        <LuCircleHelp size={18} />
      </a>
      <LeftSideWidget />
    </aside>
  );
};

export default RightSideWidget;

import type * as React from 'react';
import { FiChevronLeft } from 'react-icons/fi';
export const EditorBackButton: React.FC<{
    onClick: () => void;
    label?: string;
    outsideTitle?: boolean;
}> = ({ onClick, label = 'Back to collection', outsideTitle = false, }) => (<button type="button" onClick={onClick} className={`pointer-events-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--color-iconDefault)] transition-all hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)] ${outsideTitle ? 'lg:absolute lg:right-full lg:mr-3 lg:top-1/2 lg:-translate-y-1/2' : ''}`} title={label} aria-label={label}>
    <FiChevronLeft size={21}/>
  </button>);

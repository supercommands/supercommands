import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface CollectionActionsMenuProps {
    name: string;
    onRename: () => void;
    onDelete: () => void;
    compact?: boolean;
}

const CollectionActionsMenu = ({ name, onRename, onDelete, compact = false }: CollectionActionsMenuProps) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    const runAction = (action: () => void) => {
        setOpen(false);
        action();
    };

    return <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" onClick={() => setOpen(value => !value)} aria-label={`More actions for ${name}`} aria-expanded={open} className={`flex items-center justify-center rounded-lg text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}>
        <MoreHorizontal size={compact ? 16 : 18} aria-hidden="true"/>
      </button>
      {open && <div role="group" aria-label={`Actions for ${name}`} className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-contextMenuBg)] p-1 shadow-lg">
        <button type="button" onClick={() => runAction(onRename)} className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Rename</button>
        <button type="button" onClick={() => runAction(onDelete)} className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Delete</button>
      </div>}
    </div>;
};

export default CollectionActionsMenu;

/** App adapter only; assigned keys are listened for by the outer New Tab route. */
import { useEffect, useCallback } from 'react';
import { registerNewTabHotkeyAppBindings } from './newTabHotkeyAppBindings';
interface UseKeyboardShortcutsProps {
    setIsViewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isKeystrokeRecordingActive: () => boolean;
    searchbarRef: React.MutableRefObject<any>;
}
export const useKeyboardShortcuts = ({ searchbarRef, setIsViewDropdownOpen, setIsGlobalCreateMenuOpen }: UseKeyboardShortcutsProps) => {
    // Helper function to check if any modal/popup is open
    const isModalOpen = useCallback((): boolean => {
        // Check for modals/popups by looking for common modal classes or fixed overlays
        const modals = document.querySelectorAll('.fixed.inset-0');
        // Also check if activeElement is inside a modal (any element with fixed inset-0 parent)
        const activeElement = document.activeElement;
        if (activeElement) {
            const modalParent = activeElement.closest('.fixed.inset-0');
            if (modalParent) {
                // Check if this modal is actually visible (has opacity > 0 or is in the DOM)
                const style = window.getComputedStyle(modalParent);
                if (style.opacity !== '0' && style.display !== 'none') {
                    return true;
                }
            }
        }
        // Check if any visible modal exists
        for (let i = 0; i < modals.length; i++) {
            const modal = modals[i] as HTMLElement;
            const style = window.getComputedStyle(modal);
            if (style.opacity !== '0' && style.display !== 'none') {
                return true;
            }
        }
        return false;
    }, []);
    useEffect(() => registerNewTabHotkeyAppBindings({
        openCreateMenu: () => { setIsViewDropdownOpen(true); setIsGlobalCreateMenuOpen(true); },
        executeCommand: id => { searchbarRef.current?.executeCommand(id, { mode: 'lock' }); searchbarRef.current?.focus(); },
        focusSearch: () => {
            const input = document.getElementById('sheet-search-name') || document.querySelector('input[placeholder*="Search"]');
            if (input instanceof HTMLElement) input.focus(); else searchbarRef.current?.focus();
        },
    }), [searchbarRef, setIsViewDropdownOpen, setIsGlobalCreateMenuOpen]);
    return { isModalOpen };
};

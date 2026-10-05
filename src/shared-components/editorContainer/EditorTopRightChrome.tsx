import * as React from 'react';
import { FaInfo, FaPlus, FaTimes } from 'react-icons/fa';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
type EditorSheetExpansionControl = {
    isExpanded: boolean;
    onToggle: () => void;
    label: string;
};
interface EditorTopRightChromeProps {
    docsUrl: string;
    onClose: () => void;
    actionSlot?: React.ReactNode;
    leadingActionSlot?: React.ReactNode;
    sheetCreateAction?: { label: string; onCreate: () => void };
    sheetExpansion?: EditorSheetExpansionControl;
    positionClassName?: string;
}
export const EditorTopRightChrome: React.FC<EditorTopRightChromeProps> = ({ docsUrl, onClose, actionSlot, leadingActionSlot, sheetCreateAction, sheetExpansion, positionClassName = 'fixed top-0 right-1', }) => {
    const handleOpenDocs = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url: docsUrl });
            return;
        }
        window.open(docsUrl, '_blank', 'noopener,noreferrer');
    }, [docsUrl]);
    return (<div data-editor-top-right-chrome="true" className={`${positionClassName} z-[100000] flex items-center gap-1`}>
      {sheetCreateAction && (<button type="button" onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                sheetCreateAction.onCreate();
            }} className="mr-8 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[var(--color-success)] transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] sm:mr-16 lg:mr-32 xl:mr-72" aria-label={sheetCreateAction.label}>
          <FaPlus size={12} className="shrink-0"/>
          <span className="whitespace-nowrap text-[12px] font-normal leading-none">{sheetCreateAction.label}</span>
        </button>)}
      {leadingActionSlot}
      {sheetExpansion && (<button type="button" onMouseDown={event => event.preventDefault()} onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                sheetExpansion.onToggle();
            }} className="w-9 h-9 p-0 rounded-lg text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]" title={`${sheetExpansion.isExpanded ? 'Collapse' : 'Expand'} ${sheetExpansion.label} sheet`} aria-label={`${sheetExpansion.isExpanded ? 'Collapse' : 'Expand'} ${sheetExpansion.label} sheet`} aria-expanded={sheetExpansion.isExpanded}>
          {sheetExpansion.isExpanded ? <FiMinimize2 size={15}/> : <FiMaximize2 size={15}/>}
        </button>)}
      <button type="button" onClick={handleOpenDocs} className="w-9 h-9 p-0 rounded-lg text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none focus:outline-none" title="Open docs">
        <FaInfo size={14}/>
      </button>
      {actionSlot}
      <button type="button" onClick={onClose} className="w-9 h-9 p-0 rounded-lg text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none focus:outline-none" title="Close">
        <FaTimes size={14}/>
      </button>
    </div>);
};

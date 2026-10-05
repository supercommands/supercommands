import TextExpanderIcon from '../../../../../shared-components/icons/TextExpanderIcon';
import type React from 'react';
import { FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import WebCollectionIcon from '../../../../../shared-components/icons/webCollectionIcon';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';
export const DEFAULT_CREATE_ITEMS_ORDER = [
    'createnotes',
    'createlinks',
    'createprompt',
    'createtodo',
    'createsnippet',
    'createcollections',
];
const CREATE_ITEM_LABELS: Record<string, string> = {
    createnotes: 'Notes',
    createlinks: 'Links',
    ai: 'Chat Agents',
    createprompt: 'Chat Agents',
    createtodo: 'Todo',
    agent: 'Chat Agents',
    createsnippet: 'Text Expander',
    createcollections: 'Webclips',
    commands: 'All commands',
};
export const sanitizeAndMigrateCreateOrder = (rawOrder?: string[]): string[] => {
    if (!rawOrder || !Array.isArray(rawOrder) || rawOrder.length === 0) {
        return [...DEFAULT_CREATE_ITEMS_ORDER];
    }
    const filtered = rawOrder.filter(id => id !== 'createsession' &&
        id !== 'header-others' &&
        id !== 'header-workspace' &&
        id !== 'createfolder' &&
        id !== 'createworkspace' &&
        id !== 'createorganisation' &&
        id !== 'ai' &&
        id !== 'agent' &&
        id !== 'header-shortcuts' &&
        id !== 'header-automations' &&
        id !== 'header-knowledge' &&
        id !== 'header-workflows');
    let order = [...filtered];
    const missing = DEFAULT_CREATE_ITEMS_ORDER.filter(id => !order.includes(id));
    if (missing.length > 0) {
        order = [...order, ...missing];
    }
    return order;
};
export const EXPANDED_CREATE_MENU_ORDER = ['createnotes', 'createtodo', 'createcollections'];
export const SHORTCUT_SECTION_ORDER = ['createlinks', 'createprompt', 'createsnippet', 'commands'];
export const COMPACT_CREATE_MENU_ORDER = [...EXPANDED_CREATE_MENU_ORDER];
interface CreateMenuPanelProps {
    onCommandSelect: (id: string) => void;
    activeItemId?: string;
    section?: 'create' | 'shortcuts';
    isCollapsed?: boolean;
    isIconOnly?: boolean;
    overlayExpandedItems?: boolean;
    expanded?: boolean;
    hideExpansionIndicator?: boolean;
}
export const CreateMenuPanel: React.FC<CreateMenuPanelProps> = ({ onCommandSelect, activeItemId, section = 'create', isCollapsed = false, isIconOnly = false, }) => {
    const compact = isCollapsed || isIconOnly;
    const iconOnly = isIconOnly;
    const order = section === 'shortcuts' ? SHORTCUT_SECTION_ORDER : compact ? COMPACT_CREATE_MENU_ORDER : EXPANDED_CREATE_MENU_ORDER;
    const iconSize = iconOnly ? 15 : compact ? 11 : 15;
    const itemClass = iconOnly
        ? 'flex h-10 w-full min-w-0 flex-col items-center justify-center gap-0.5 cursor-pointer group px-1 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150'
        : compact
            ? 'flex h-7 w-full min-w-0 items-center justify-start cursor-pointer group px-1.5 gap-1.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150 text-left'
            : 'flex h-7 w-full min-w-0 items-center justify-start text-left cursor-pointer group pr-2 pl-2 gap-2 rounded-md text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] transition-colors duration-150';
    const iconWrapperClass = iconOnly
        ? 'w-5 h-5 flex items-center justify-center shrink-0 opacity-80 group-hover:opacity-100 transition-opacity'
        : compact
            ? 'w-3.5 h-3.5 flex items-center justify-center shrink-0'
            : 'w-5 h-5 flex items-center justify-center shrink-0';
    const labelClass = iconOnly
        ? 'block w-full min-w-0 truncate whitespace-nowrap text-center text-[8px] font-medium leading-none text-[var(--color-textSecondary)]'
        : compact
            ? 'min-w-0 flex-1 truncate whitespace-nowrap text-left text-[9px] font-medium leading-none transition-colors duration-150 text-[var(--color-textSecondary)]'
            : 'min-w-0 flex-1 truncate whitespace-nowrap text-left text-[12.5px] font-medium leading-none transition-colors duration-150 text-[var(--color-textSecondary)]';
    const iconClass = 'text-[var(--color-iconDefault)] shrink-0';
    const icons: Record<string, React.ReactNode> = {
        commands: <CUnderscoreIcon size={iconSize} className={iconClass}/>,
        createlinks: <FaLink size={iconSize} className={iconClass}/>,
        createprompt: <LuSparkles size={iconSize} className={iconClass}/>,
        createsnippet: <TextExpanderIcon size={iconSize} className={iconClass}/>,
        createnotes: <NotesIcon size={iconSize} className={iconClass}/>,
        createtodo: <BsCalendarCheck size={iconSize} className={iconClass}/>,
        createcollections: <WebCollectionIcon size={Math.max(iconSize, 14)} className={iconClass}/>,
    };
    const renderItem = (id: string) => {
        const label = CREATE_ITEM_LABELS[id];
        return (<button key={id} type="button" className={`${itemClass} ${activeItemId === id ? 'bg-[var(--color-selectedBg)]' : ''} outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]`} title={label} aria-label={label} aria-current={activeItemId === id ? 'page' : undefined} onClick={event => {
                event.stopPropagation();
                onCommandSelect(id);
            }}>
          <span className={iconWrapperClass} aria-hidden="true">{icons[id]}</span>
          <span className={labelClass}>{label}</span>
        </button>);
    };
    return (<div className={`relative flex flex-col select-none ${compact ? 'mx-1' : 'mx-2'} bg-transparent`}>
      <div className={`flex flex-col gap-0.5 ${compact ? 'px-0.5' : 'px-2'} py-1.5`}>
        {order.map(renderItem)}
      </div>
    </div>);
};
export const ShortcutsMenuSection: React.FC<Omit<CreateMenuPanelProps, 'section'>> = props => <CreateMenuPanel {...props} section="shortcuts"/>;
export default CreateMenuPanel;

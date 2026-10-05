/**
 * @file TagTreeRenderer.tsx
 * @description Clean, Notion-style multi-tag tree renderer using pure indentation spacing
 * (no borders, no heavy lines, clean whitespace hierarchy) with expand/collapse toggles.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { FiChevronRight, FiChevronDown, FiExternalLink, FiStar, FiMoreVertical, FiPlus } from 'react-icons/fi';
import { FaStar, FaTrash, FaTag } from 'react-icons/fa';
import type { TagTreeNode } from './tagTreeUtils';
export interface TagTreeRendererProps<T extends {
    id: string;
}> {
    nodes: TagTreeNode<T>[];
    activeItemId: string | null;
    collapsedTagIds: Set<string>;
    onToggleTagCollapse: (tagId: string) => void;
    onLoadItem: (id: string) => void;
    onDeleteItem: (id: string) => void;
    deletingIds: Set<string>;
    onUndoDelete: (id: string) => void;
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    getItemCompoundId: (item: T) => string;
    getItemType: (item: T) => string;
    getItemTitle: (item: T) => string;
    getItemPreview: (item: T) => string;
    getItemIcon?: (item: T) => React.ReactNode;
    onOpenerClick?: (item: T) => void;
    shortcutPrefix?: string;
    isFavorite: (compoundId: string) => boolean;
    toggleFavorite: (compoundId: string, type: string, title: string) => Promise<void>;
    onTagClick?: (tagId: string, tagName: string) => void;
    /** When rendered in narrow sidebar (240px), keep rows compact and clean */
    isCollapsedMode?: boolean;
    /** Callback to expand the sidebar when clicking the 3-dots in collapsed mode */
    onToggleExpand?: () => void;
    /** Callback to open TagSelector popover for a specific item */
    onOpenTagPicker?: (itemId: string, targetRect: DOMRect) => void;
    /** Callback when '+' button on a tag heading is clicked to create a fresh item with that tag */
    onCreateItemInTag?: (tagNames: string[], tagIds: string[]) => void;
    /** Replaces compact tag/expand actions with a Delete-only overflow menu. */
    compactItemMenu?: 'default' | 'delete-only';
}
function TagTreeRendererComponent<T extends {
    id: string;
}>({ nodes, activeItemId, collapsedTagIds, onToggleTagCollapse, onLoadItem, onDeleteItem, deletingIds, onUndoDelete, shortcutsMap, hotkeysMap, getItemCompoundId, getItemType, getItemTitle, getItemPreview, getItemIcon, onOpenerClick, shortcutPrefix = 'c', isFavorite, toggleFavorite, onTagClick, isCollapsedMode = false, onToggleExpand, onOpenTagPicker, onCreateItemInTag, compactItemMenu = 'delete-only', }: TagTreeRendererProps<T>) {
    const [openItemMenu, setOpenItemMenu] = React.useState<{
        itemId: string;
        nodeId: string;
        left: number;
        top: number;
    } | null>(null);
    React.useEffect(() => {
        if (!openItemMenu)
            return;
        const closeMenu = () => setOpenItemMenu(null);
        const closeMenuOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                closeMenu();
        };
        window.addEventListener('click', closeMenu);
        window.addEventListener('keydown', closeMenuOnEscape);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('keydown', closeMenuOnEscape);
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [openItemMenu]);
    const renderNode = (node: TagTreeNode<T>): React.ReactNode => {
        if (node.type === 'tag' || node.type === 'section') {
            const isSection = node.type === 'section';
            const isCollapsed = collapsedTagIds.has(node.id);
            // Align a tag marker with item icons at the same tree depth. The disclosure
            // control sits in its own gutter and must not shift the marker column.
            const indentStyle = { paddingLeft: `${node.clampedIndentPx + 14}px` };
            return (<div key={node.id} className="flex flex-col">
          {/* Notion-style Clean Tag Folder Row (Spacing only, no borders) */}
          <div onClick={() => onToggleTagCollapse(node.id)} style={indentStyle} className="group relative flex items-center justify-between py-0.5 pr-2 rounded-md hover:bg-[var(--color-hoverBg)] cursor-pointer select-none transition-colors">
            <button type="button" style={{ left: `${node.clampedIndentPx}px` }} className="absolute top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] shrink-0 transition-opacity opacity-0 group-hover:opacity-100" title={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`} aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`} aria-expanded={!isCollapsed}>
              {isCollapsed ? <FiChevronRight size={11}/> : <FiChevronDown size={11}/>}
            </button>

            <div className="flex items-center min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-medium text-[var(--color-textSecondary)] select-none shrink-0 opacity-70">
                  {isSection ? <FiStar size={11}/> : '#'}
                </span>
                <span className={`text-[11.5px] font-medium truncate ${isSection ? 'text-[var(--color-textSecondary)] opacity-75' : 'text-[var(--color-textPrimary)]'}`} title={node.name}>
                  {node.name}
                </span>
              </div>
            </div>

            {/* Right side action: Create new item under this tag */}
            {!isSection && onCreateItemInTag && (<button type="button" onClick={e => {
                        e.stopPropagation();
                        onCreateItemInTag(node.tagPathNames || [node.name], node.tagPathIds || []);
                    }} className="w-4 h-4 flex items-center justify-center rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer" title={`New item in ${node.name}`} aria-label={`Create item in ${node.name}`}>
                <FiPlus size={11}/>
              </button>)}
          </div>

          {/* Render children if not collapsed */}
          {!isCollapsed && node.children.length > 0 && (<div className="flex flex-col">
              {node.children.map(child => renderNode(child))}
            </div>)}
        </div>);
        }
        // Node is an Item
        const item = node.item!;
        const isCurrent = item.id === activeItemId;
        const isDeleting = deletingIds.has(item.id);
        const compoundId = getItemCompoundId(item);
        const itemType = getItemType(item);
        const title = getItemTitle(item);
        const preview = getItemPreview(item);
        const sc = shortcutsMap[compoundId] || shortcutsMap[item.id] || '';
        const hotkeyCombo = hotkeysMap[compoundId] || '';
        const indentStyle = { paddingLeft: `${node.clampedIndentPx + 14}px` };
        return (<div key={node.id} style={indentStyle} onClick={() => {
                if (!isDeleting)
                    onLoadItem(item.id);
            }} className={`group flex items-center justify-between py-0.5 pr-2 rounded-md cursor-pointer transition-colors text-xs select-none ${isDeleting
                ? 'bg-red-900/20 text-[var(--color-textMuted)]'
                : isCurrent
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-semibold'
                    : 'hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getItemIcon && (<div className="shrink-0 flex items-center justify-center opacity-80 group-hover:opacity-100">
              {getItemIcon(item)}
            </div>)}

          {/* Title & Preview */}
          <span className={`truncate max-w-[200px] text-xs transition-colors ${isCurrent ? 'text-[var(--color-textPrimary)] font-medium' : 'text-[var(--color-textSecondary)] opacity-75 group-hover:opacity-95'}`}>
            {title || <span className="italic text-[var(--color-textMuted)] opacity-60">Untitled</span>}
          </span>

          {preview.trim() && (<span className="truncate text-[11px] text-[var(--color-textSecondary)] opacity-60 max-w-[180px] hidden sm:inline">
              {preview}
            </span>)}
        </div>

        {/* Badges & Actions (clean, Notion-like, no borders) */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {!isCollapsedMode && sc && (<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-inputBg)] text-[var(--color-textSecondary)]" title={`Shortcut: ${shortcutPrefix} ${sc}`}>
              {shortcutPrefix} {sc}
            </span>)}

          {!isCollapsedMode && hotkeyCombo && (<span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-inputBg)] text-[var(--color-textSecondary)]" title={`Hotkey: ${hotkeyCombo}`}>
              {hotkeyCombo}
            </span>)}

          {onOpenerClick && !isCollapsedMode && (<button type="button" onClick={e => {
                    e.stopPropagation();
                    onOpenerClick(item);
                }} className="p-1 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] opacity-0 group-hover:opacity-100 transition-opacity" title="Open item">
              <FiExternalLink size={12}/>
            </button>)}

          {isDeleting ? (<button type="button" onClick={e => {
                    e.stopPropagation();
                    onUndoDelete(item.id);
                }} className="text-blue-400 hover:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-all cursor-pointer" title="Undo delete">
              UNDO
            </button>) : isCollapsedMode ? (<div className="flex items-center gap-0.5 shrink-0">
              {compactItemMenu === 'delete-only' ? (<button type="button" onClick={e => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const menuWidth = 112;
                        const menuHeight = 40;
                        const viewportMargin = 8;
                        setOpenItemMenu(current => current?.nodeId === node.id
                            ? null
                            : {
                                itemId: item.id,
                                nodeId: node.id,
                                left: Math.max(viewportMargin, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportMargin)),
                                top: rect.bottom + menuHeight + 4 <= window.innerHeight - viewportMargin
                                    ? rect.bottom + 4
                                    : rect.top - menuHeight - 4,
                            });
                    }} className="p-1 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all shrink-0 cursor-pointer" title="More options" aria-label="More options" aria-haspopup="menu" aria-expanded={openItemMenu?.nodeId === node.id}>
                  <FiMoreVertical size={14}/>
                </button>) : (<>
                  {onOpenTagPicker && (<button type="button" onClick={e => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            onOpenTagPicker(item.id, rect);
                        }} className="p-1 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer" title="Tags" aria-label="Manage tags">
                      <FaTag size={10}/>
                    </button>)}
                  {onToggleExpand && (<button type="button" onClick={e => {
                            e.stopPropagation();
                            onToggleExpand();
                        }} className="p-1 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer" title="Expand panel" aria-label="Expand panel">
                      <FiMoreVertical size={14}/>
                    </button>)}
                </>)}
            </div>) : (<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={async (e) => {
                    e.stopPropagation();
                    await toggleFavorite(compoundId, itemType, title);
                }} className="p-1 text-[var(--color-iconDefault)] hover:text-amber-400 transition-colors" title="Favorite">
                {isFavorite(compoundId) ? (<FaStar className="text-amber-400" size={11}/>) : (<FiStar size={11}/>)}
              </button>

              <button type="button" onClick={e => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                }} className="p-1 text-[var(--color-iconDefault)] hover:text-[var(--color-textError)] transition-colors" title="Delete">
                <FaTrash size={10}/>
              </button>
            </div>)}
        </div>
      </div>);
    };
    if (nodes.length === 0) {
        return (<div className="text-xs text-[var(--color-textMuted)] text-center py-8">
        No items or tags found.
      </div>);
    }
    return (<>
      <div className="flex flex-col gap-0.5 py-1">{nodes.map(renderNode)}</div>
      {openItemMenu &&
            createPortal(<div role="menu" onClick={event => event.stopPropagation()} style={{ position: 'fixed', left: openItemMenu.left, top: openItemMenu.top, zIndex: 2147483647 }} className="w-28 rounded-lg border border-white/10 bg-[#0E0F10] p-1 shadow-lg">
            <button type="button" role="menuitem" onClick={event => {
                    event.stopPropagation();
                    const itemId = openItemMenu.itemId;
                    setOpenItemMenu(null);
                    onDeleteItem(itemId);
                }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-400 hover:bg-white/5 transition-colors cursor-pointer">
              <FaTrash size={10}/>
              <span>Delete</span>
            </button>
          </div>, document.body)}
    </>);
}
export const TagTreeRenderer = React.memo(TagTreeRendererComponent) as typeof TagTreeRendererComponent;

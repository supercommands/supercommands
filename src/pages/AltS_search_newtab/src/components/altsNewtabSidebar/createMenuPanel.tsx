import type * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { FiChevronUp, FiChevronDown, FiZap, FiFolder, FiBriefcase } from 'react-icons/fi';
import { FaCaretDown, FaCaretRight, FaCode, FaLink, FaRobot } from 'react-icons/fa';
import { BsCalendarCheck } from 'react-icons/bs';
import { getSidebarStorageData, setSidebarStorageData } from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import {
  CREATE_SECTION_COLLAPSED_STORAGE_KEY,
  getCreateSectionCollapsed,
  setCreateSectionCollapsed,
} from '../../../../../storage/localStorage/createSectionCollapseStorage';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import ReactDOM from 'react-dom';
import { SidebarDashboardViewsSection } from './sidebarDashboardViewsSection';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';


const SortableCreateItem = ({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDragStart={e => e.preventDefault()}
      draggable="false"
      className={`relative select-none ${isDragging ? 'grabbing opacity-0 pointer-events-none' : 'cursor-grab'}`}
    >
      {children}
    </div>
  );
};

const SortableHeader = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef } = useSortable({ id, disabled: true });

  return (
    <div ref={setNodeRef} className="w-full">
      {children}
    </div>
  );
};

interface CreateMenuPanelProps {
  onCommandSelect: (id: string) => void;
}

export const CreateMenuPanel: React.FC<CreateMenuPanelProps> = ({ onCommandSelect }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isCreateExpanded, setIsCreateExpanded] = useState<boolean>(true);
  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createnotes: true,
    createlinks: true,
    createsession: true,
    createtodo: true,
    ai: true,
    createsnippet: true,
    agent: true,
    'header-knowledge': true,
    'header-workflows': true,
    'header-automations': true,
  });
  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>([
    'header-knowledge',
    'createnotes',
    'createlinks',
    'header-workflows',
    'createsession',
    'createtodo',
    'ai',
    'header-automations',
    'createsnippet',
    'agent',
  ]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const oldIndex = createItemsOrder.indexOf(activeId);
    const newIndex = createItemsOrder.indexOf(overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...createItemsOrder];
      newOrder.splice(oldIndex, 1);
      const adjustedNewIndex = newOrder.indexOf(overId);
      
      let targetIndex: number;
      if (overId.startsWith('header-') && oldIndex < newIndex) {
        targetIndex = adjustedNewIndex + 1;
      } else {
        targetIndex = adjustedNewIndex;
      }

      // If active item is not a header, ensure it is not dragged above the very first header
      if (!activeId.startsWith('header-')) {
        const firstHeaderIndex = newOrder.findIndex(id => id.startsWith('header-'));
        if (firstHeaderIndex !== -1 && targetIndex <= firstHeaderIndex) {
          targetIndex = firstHeaderIndex + 1;
        }
      }

      newOrder.splice(targetIndex, 0, activeId);
      setCreateItemsOrder(newOrder); // Update React layout in real-time
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveDragId(null);
    setSidebarStorageData({ favorites_create_items_order: createItemsOrder });
  };

  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
  const [groupsOrder, setGroupsOrder] = useState<string[]>([]);
  const allCreateOptions = [
    { id: 'header-knowledge' },
    { id: 'createnotes' },
    { id: 'createlinks' },
    { id: 'header-workflows' },
    { id: 'createsession' },
    { id: 'createtodo' },
    { id: 'ai' },
    { id: 'header-automations' },
    { id: 'createsnippet' },
    { id: 'agent' },
  ];

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = async () => {
      const isCreateCollapsed = await getCreateSectionCollapsed();
      setIsCreateExpanded(!isCreateCollapsed);

      const result = await getSidebarStorageData([
        'favorites_create_visible_items',
        'favorites_create_items_order',
        'customGroupNames',
        'createGroupsOrder',
      ]);

      if (result.favorites_create_visible_items) {
        const stored = result.favorites_create_visible_items;
        setVisibleCreateItems(prev => ({
          ...prev,
          ...stored,
          createtodo: stored.createtodo ?? true,
          createsession: stored.createsession ?? true,
          createlinks: stored.createlinks ?? true,
          createnotes: stored.createnotes ?? true,
          ai: stored.ai ?? true,
          createsnippet: stored.createsnippet ?? true,
          agent: stored.agent ?? true,
        }));
      }

      if (result.favorites_create_items_order) {
        let order: string[] = result.favorites_create_items_order;
        order = order.filter(id => id !== 'header-others' && id !== 'header-shortcuts' && id !== 'header-workspace' && id !== 'createfolder' && id !== 'createworkspace');
        
        const defaultAllIds = [
          'header-knowledge',
          'createnotes',
          'createlinks',
          'header-workflows',
          'createsession',
          'createtodo',
          'ai',
          'header-automations',
          'createsnippet',
          'agent',
        ];
        const missing = defaultAllIds.filter(id => !order.includes(id));
        if (missing.length > 0) {
          order = [...order, ...missing];
        }
        // Ensure the first item is a group header so no item exists outside a group
        const firstHeaderIdx = order.findIndex(id => id.startsWith('header-'));
        if (firstHeaderIdx > 0) {
          const headerId = order.splice(firstHeaderIdx, 1)[0];
          order.unshift(headerId);
        } else if (firstHeaderIdx === -1) {
          order.unshift('header-knowledge');
        }
        setCreateItemsOrder(order);
      }

      if (result.customGroupNames) {
        setCustomGroupNames(result.customGroupNames);
      }
    };

    loadPreferences();

    const handleStorageChange = (changes: { [key: string]: any }) => {
      if (changes.favorites_create_visible_items) {
        const stored = changes.favorites_create_visible_items.newValue || {};
        setVisibleCreateItems(prev => ({
          ...prev,
          ...stored,
          createtodo: stored.createtodo ?? true,
          createsession: stored.createsession ?? true,
          createlinks: stored.createlinks ?? true,
          createnotes: stored.createnotes ?? true,
          ai: stored.ai ?? true,
          createsnippet: stored.createsnippet ?? true,
          agent: stored.agent ?? true,
        }));
      }
      if (changes.favorites_create_items_order) {
        let order: string[] = (changes.favorites_create_items_order.newValue || []).filter(
          (id: string) => id !== 'header-workspace' && id !== 'createfolder' && id !== 'createworkspace'
        );
        const defaultAllIds = [
          'createtodo',
          'createlinks',
          'ai',
          'createsnippet',
          'agent',
          'createsession',
          'createnotes',
        ];
        const missing = defaultAllIds.filter(id => !order.includes(id));
        if (missing.length > 0) {
          order = [...order, ...missing];
        }
        setCreateItemsOrder(order);
      }
      if (changes.customGroupNames) {
        setCustomGroupNames(changes.customGroupNames.newValue || {});
      }
      if (changes[CREATE_SECTION_COLLAPSED_STORAGE_KEY]) {
        setIsCreateExpanded(changes[CREATE_SECTION_COLLAPSED_STORAGE_KEY].newValue !== true);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const mainItems = useMemo(() => {
    return createItemsOrder.filter(id => visibleCreateItems[id]);
  }, [createItemsOrder, visibleCreateItems]);

  const collapsedItems = useMemo(() => {
    return createItemsOrder.filter(id => !visibleCreateItems[id]);
  }, [createItemsOrder, visibleCreateItems]);

  const handleToggleCreateExpanded = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsCreateExpanded(prev => {
      const next = !prev;
      setCreateSectionCollapsed(!next);
      return next;
    });
  };

  const renderCreateItem = (id: string, isIndented: boolean = false) => {
    const paddingClass = isIndented ? 'pl-[28px]' : 'pl-[12px]';
    const itemClass = `flex items-center cursor-pointer group py-[4px] pr-[8px] ${paddingClass} gap-2.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150`;
    const labelClass = `text-[12px] font-semibold tracking-tight transition-colors duration-150 text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]`;

    switch (id) {
      case 'createlinks':
        return (
          <div
            key="createlinks"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createlinks');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaLink size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Link
            </span>
          </div>
        );
      case 'createsession':
        return (
          <div
            key="createsession"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createsession');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <SessionGridIcon size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Session
            </span>
          </div>
        );
      case 'createnotes':
        return (
          <div
            key="createnotes"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createnotes');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <NotesIcon size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Note
            </span>
          </div>
        );
      case 'ai':
        return (
          <div
            key="ai"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('ai');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaRobot size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              AI Prompt
            </span>
          </div>
        );
      case 'createtodo':
        return (
          <div
            key="createtodo"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createtodo');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Todo
            </span>
          </div>
        );
      case 'agent':
        return (
          <div
            key="agent"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('agent');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiZap size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Automation (Beta)
            </span>
          </div>
        );
      case 'createsnippet':
        return (
          <div
            key="createsnippet"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createsnippet');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaCode size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Text Expander
            </span>
          </div>
        );
      case 'createfolder':
        return (
          <div
            key="createfolder"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createfolder');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiFolder size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Folder
            </span>
          </div>
        );
      case 'createworkspace':
        return (
          <div
            key="createworkspace"
            className={itemClass}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createworkspace');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiBriefcase size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span className={labelClass}>
              Organization
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div className={`px-3 pt-2 ${isCreateExpanded ? 'pb-1' : 'pb-0'}`}>
        <button
          type="button"
          aria-label={isCreateExpanded ? 'Collapse Create' : 'Expand Create'}
          aria-expanded={isCreateExpanded}
          onClick={handleToggleCreateExpanded}
          className="w-full flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors text-left">
          <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
            Create
          </span>
          <span className="w-4 h-4 flex items-center justify-center text-[var(--color-textMuted)]">
            {isCreateExpanded ? <FaCaretDown size={12} /> : <FaCaretRight size={12} />}
          </span>
        </button>
      </div>

      {isCreateExpanded && (
        <div className="flex flex-col px-3 pt-0.5 pb-2">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}>
            <SortableContext items={createItemsOrder.filter(id => id !== 'agent')} strategy={verticalListSortingStrategy}>
              {(() => {
                let hasSeenHeader = false;
                const filteredOrder = createItemsOrder.filter(id => id !== 'agent');
                return filteredOrder.map((id, index) => {
                  if (id.startsWith('header-')) {
                    // A header is visible if any of its children are visible (defaulting to true if not explicitly false)
                    let isVisible = false;
                    for (let i = index + 1; i < filteredOrder.length; i++) {
                      if (filteredOrder[i].startsWith('header-')) break;
                      const itemVisible = visibleCreateItems[filteredOrder[i]] !== false;
                      if (itemVisible || isExpanded) {
                        isVisible = true;
                        break;
                      }
                    }

                    if (isVisible) {
                      hasSeenHeader = true; // Any items after this visible header will be indented
                      const groupId = id.replace('header-', '');
                      const defaultTitles: Record<string, string> = {
                        knowledge: 'Knowledge',
                        workflows: 'Workflows',
                        automations: 'Automations',
                        workspace: 'Workspace',
                      };
                      const title = customGroupNames[groupId] || defaultTitles[groupId] || groupId;
                      return (
                        <SortableHeader key={id} id={id}>
                          <div className="flex items-center gap-2 mt-2 mb-1 px-1.5 select-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
                              {title}
                            </span>
                          </div>
                        </SortableHeader>
                      );
                    }
                    return null;
                  } else {
                    const isVisible = visibleCreateItems[id] !== false;
                    if (!isVisible && !isExpanded) return null;
                    return (
                      <SortableCreateItem key={id} id={id}>
                        {renderCreateItem(id, hasSeenHeader)}
                      </SortableCreateItem>
                    );
                  }
                });
              })()}
            </SortableContext>
            <DragOverlay>
              {activeDragId ? (
                <div className="scale-105 opacity-80 shadow-md rounded-md p-1 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[140px]">
                  {activeDragId.startsWith('header-') ? null : renderCreateItem(activeDragId, false)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {createItemsOrder.some(id => {
            if (id.startsWith('header-')) return false;
            return visibleCreateItems[id] === false;
          }) && (
            <div className="flex justify-center mt-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}>
                {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreateMenuPanel;

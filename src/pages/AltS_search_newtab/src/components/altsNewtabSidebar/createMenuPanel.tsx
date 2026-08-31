import type * as React from 'react';
import { useState, useEffect } from 'react';
import { FiZap, FiFolder, FiBriefcase, FiPlus } from 'react-icons/fi';
import { FaCaretDown, FaCaretRight, FaCode, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
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
      className={`relative w-full select-none ${isDragging ? 'grabbing opacity-0 pointer-events-none' : 'cursor-grab'}`}
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

export const DEFAULT_CREATE_ITEMS_ORDER = [
  'createnotes',
  'createlinks',
  'ai',
  'createtodo',
  'createsnippet',
];

export const sanitizeAndMigrateCreateOrder = (rawOrder?: string[]): string[] => {
  if (!rawOrder || !Array.isArray(rawOrder) || rawOrder.length === 0) {
    return [...DEFAULT_CREATE_ITEMS_ORDER];
  }

  const filtered = rawOrder.filter(
    id =>
      id !== 'createsession' &&
      id !== 'header-others' &&
      id !== 'header-workspace' &&
      id !== 'createfolder' &&
      id !== 'createworkspace' &&
      id !== 'agent' &&
      id !== 'header-shortcuts' &&
      id !== 'header-automations' &&
      id !== 'header-knowledge' &&
      id !== 'header-workflows',
  );

  let order = [...filtered];
  const missing = DEFAULT_CREATE_ITEMS_ORDER.filter(id => !order.includes(id));
  if (missing.length > 0) {
    order = [...order, ...missing];
  }

  return order;
};

interface CreateMenuPanelProps {
  onCommandSelect: (id: string) => void;
  isCollapsed?: boolean;
}

export const CreateMenuPanel: React.FC<CreateMenuPanelProps> = ({ onCommandSelect, isCollapsed = false }) => {
  const [isCreateExpanded, setIsCreateExpanded] = useState<boolean>(true);
  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>([
    'createnotes',
    'createlinks',
    'ai',
    'createsnippet',
    'createtodo',
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
      newOrder.splice(targetIndex, 0, activeId);
      setCreateItemsOrder(newOrder); // Update React layout in real-time
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveDragId(null);
    setSidebarStorageData({ favorites_create_items_order: sanitizeAndMigrateCreateOrder(createItemsOrder) });
  };

  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = async () => {
      const isCreateCollapsed = await getCreateSectionCollapsed();
      setIsCreateExpanded(!isCreateCollapsed);

      const result = await getSidebarStorageData([
        'favorites_create_items_order',
        'customGroupNames',
      ]);

      const migratedOrder = sanitizeAndMigrateCreateOrder(result.favorites_create_items_order);
      setCreateItemsOrder(migratedOrder);
      setSidebarStorageData({ favorites_create_items_order: migratedOrder });

      if (result.customGroupNames) {
        setCustomGroupNames(result.customGroupNames);
      }
    };

    loadPreferences();

    const handleStorageChange = (changes: { [key: string]: any }) => {
      if (changes.favorites_create_items_order) {
        const migratedOrder = sanitizeAndMigrateCreateOrder(changes.favorites_create_items_order.newValue);
        setCreateItemsOrder(migratedOrder);
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

  const handleToggleCreateExpanded = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsCreateExpanded(prev => {
      const next = !prev;
      setCreateSectionCollapsed(!next);
      return next;
    });
  };

  const renderCreateItem = (id: string) => {
    const paddingClass = 'pl-2';
    const iconSize = isCollapsed ? 12 : 15;
    const iconWrapperClass = isCollapsed
      ? 'w-4 h-4 flex items-center justify-center shrink-0'
      : 'w-5 h-5 flex items-center justify-center shrink-0';
    const itemClass = isCollapsed
      ? 'flex min-h-9 w-full min-w-0 flex-col items-center justify-center cursor-pointer group py-1 px-1.5 gap-0.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150 text-center'
      : `flex h-7 w-full min-w-0 items-center cursor-pointer group pr-2 ${paddingClass} gap-3 rounded-md text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] transition-colors duration-150`;
    const labelClass = isCollapsed
      ? 'w-full truncate whitespace-nowrap text-center text-[9px] font-medium leading-tight transition-colors duration-150 text-[var(--color-textMuted)]'
      : 'min-w-0 flex-1 truncate whitespace-nowrap text-[12.5px] font-medium leading-none transition-colors duration-150 text-[var(--color-textMuted)]';
    const iconClass = isCollapsed
      ? 'text-[var(--color-textMuted)] shrink-0'
      : 'text-[var(--color-textMuted)] shrink-0';

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
            <div className={iconWrapperClass}>
              <FaLink size={iconSize} className={iconClass} />
            </div>
            <span className={labelClass}>
              Link
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
            <div className={iconWrapperClass}>
              <NotesIcon size={iconSize} className={iconClass} />
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
            <div className={iconWrapperClass}>
              <LuSparkles size={iconSize} className={iconClass} />
            </div>
            <span className={labelClass}>
              Chat Agent
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
            <div className={iconWrapperClass}>
              <BsCalendarCheck size={iconSize} className={iconClass} />
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
            <div className={iconWrapperClass}>
              <FiZap size={iconSize} className={iconClass} />
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
            <div className={iconWrapperClass}>
              <FaCode size={iconSize} className={iconClass} />
            </div>
            <span className={labelClass}>
              Text Expander
            </span>
          </div>
        );
      // Workspace/folder creation is only allowed from onboarding for now.
      // case 'createfolder':
      //   return (
      //     <div
      //       key="createfolder"
      //       className={itemClass}
      //       onClick={e => {
      //         e.stopPropagation();
      //         onCommandSelect('createfolder');
      //       }}>
      //       <div className="w-4 h-4 flex items-center justify-center shrink-0">
      //         <FiFolder size={14} className="text-[var(--color-iconDefault)] shrink-0" />
      //       </div>
      //       <span className={labelClass}>
      //         Folder
      //       </span>
      //     </div>
      //   );
      // case 'createworkspace':
      //   return (
      //     <div
      //       key="createworkspace"
      //       className={itemClass}
      //       onClick={e => {
      //         e.stopPropagation();
      //         onCommandSelect('createworkspace');
      //       }}>
      //       <div className="w-4 h-4 flex items-center justify-center shrink-0">
      //         <FiBriefcase size={14} className="text-[var(--color-iconDefault)] shrink-0" />
      //       </div>
      //       <span className={labelClass}>
      //         Organization
      //       </span>
      //     </div>
      //   );
      default:
        return null;
    }
  };
  return (
    <div className="flex flex-col select-none">
      <div className={`${isCollapsed ? 'px-0.5' : 'px-2'} pt-1.5 pb-1 flex flex-col`}>
        <button
          type="button"
          aria-label={isCreateExpanded ? 'Collapse Create' : 'Expand Create'}
          aria-expanded={isCreateExpanded}
          onClick={handleToggleCreateExpanded}
          className={`w-full ${isCollapsed ? 'grid grid-cols-[10px_minmax(0,1fr)] items-center gap-0.5 px-1' : 'relative flex h-7 items-center gap-2 pl-2 pr-10'} py-1 rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors text-left cursor-pointer`}>
          <FiPlus strokeWidth={4.5} size={isCollapsed ? 10 : 14} style={{ color: '#10B981' }} className="shrink-0" />
          <span className={`${isCollapsed ? 'min-w-0 truncate whitespace-nowrap text-left text-[8px] leading-none tracking-normal' : 'min-w-0 flex-1 truncate whitespace-nowrap text-[12.5px] tracking-normal'} font-medium capitalize text-[var(--color-textMuted)]`}>
            Create
          </span>
          {!isCollapsed && (
            <span className="absolute right-8 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-textMuted)]">
              {isCreateExpanded ? <FaCaretDown size={12} /> : <FaCaretRight size={12} />}
            </span>
          )}
        </button>
        <div className={`${isCollapsed ? 'w-[calc(100%+0.25rem)] -mx-0.5' : 'w-full'} border-b border-[var(--color-borderDefault)] mt-1`} />
      </div>

      {isCreateExpanded && (
        <div className={`flex flex-col ${isCollapsed ? 'px-0.5' : 'px-2'} pt-0 pb-1`}>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}>
            <SortableContext items={createItemsOrder.filter(id => id !== 'agent')} strategy={verticalListSortingStrategy}>
              {(() => {
                const filteredOrder = sanitizeAndMigrateCreateOrder(createItemsOrder).filter(id => id !== 'agent');
                return filteredOrder.map((id, index) => {
                  if (id.startsWith('header-')) {
                    let isVisible = false;
                    for (let i = index + 1; i < filteredOrder.length; i++) {
                      if (filteredOrder[i].startsWith('header-')) break;
                      if (filteredOrder[i] !== 'agent') {
                        isVisible = true;
                        break;
                      }
                    }

                    if (isVisible) {
                      const groupId = id.replace('header-', '');
                      const defaultTitles: Record<string, string> = {
                        shortcuts: 'Shortcuts',
                        automations: 'Automations',
                        knowledge: 'Knowledge',
                        workflows: 'Workflows',
                        workspace: 'Workspace',
                      };
                      const title = customGroupNames[groupId] || defaultTitles[groupId] || groupId;
                      return (
                        <SortableHeader key={id} id={id}>
                          <div className={`flex items-center ${isCollapsed ? (index === 0 ? 'mt-1' : 'mt-2') : (index === 0 ? 'mt-1' : 'mt-2.5')} mb-0.5 ${isCollapsed ? 'pl-2 pr-1 justify-start text-left' : 'px-2'} select-none`}>
                            <span
                              className={`${isCollapsed ? 'min-w-0 max-w-full truncate whitespace-nowrap text-left text-[8px] leading-none tracking-normal' : 'min-w-0 max-w-full truncate whitespace-nowrap text-[12px] tracking-normal'} font-medium capitalize text-[var(--color-textMuted)]`}
                              title={title}>
                              {title}
                            </span>
                          </div>
                        </SortableHeader>
                      );
                    }
                    return null;
                  } else {
                    return (
                      <SortableCreateItem key={id} id={id}>
                        {renderCreateItem(id)}
                      </SortableCreateItem>
                    );
                  }
                });
              })()}
            </SortableContext>
            <DragOverlay>
              {activeDragId ? (
                <div className="scale-105 opacity-80 shadow-md rounded-md p-1 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[140px]">
                  {activeDragId.startsWith('header-') ? null : renderCreateItem(activeDragId)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default CreateMenuPanel;

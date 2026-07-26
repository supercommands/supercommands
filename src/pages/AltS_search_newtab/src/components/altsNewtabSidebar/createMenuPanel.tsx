import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { FiChevronUp, FiChevronDown, FiZap, FiFolder, FiBriefcase } from 'react-icons/fi';
import { FaCode, FaLink, FaRobot, FaLayerGroup } from 'react-icons/fa';
import { BsCalendarCheck } from 'react-icons/bs';
import { getSidebarStorageData, setSidebarStorageData } from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import ReactDOM from 'react-dom';

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
  const [isCreateExpanded, setIsCreateExpanded] = useState<boolean>(false);
  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createnotes: true,
    createlinks: true,
    createsession: true,
    createtodo: true,
    ai: true,
    createsnippet: true,
    agent: true,
    createfolder: false,
    createworkspace: false,
    'header-knowledge': true,
    'header-workflows': true,
    'header-automations': true,
    'header-workspace': true,
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
    'header-workspace',
    'createfolder',
    'createworkspace',
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
    { id: 'header-workspace' },
    { id: 'createfolder' },
    { id: 'createworkspace' },
  ];

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = async () => {
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
          createfolder: stored.createfolder ?? false,
          createworkspace: stored.createworkspace ?? false,
        }));
      }

      if (result.favorites_create_items_order) {
        let order: string[] = result.favorites_create_items_order;
        if (order.includes('header-others')) {
          order = order.map(id => id === 'header-others' ? 'header-workspace' : id);
        }
        if (!order.includes('header-knowledge')) {
          const notesIdx = order.indexOf('createnotes');
          if (notesIdx >= 0) {
            order.splice(notesIdx, 0, 'header-knowledge');
          } else {
            order = ['header-knowledge', ...order];
          }
        }
        if (!order.includes('header-automations')) {
          const snippetIdx = order.indexOf('createsnippet');
          if (snippetIdx >= 0) {
            order.splice(snippetIdx, 0, 'header-automations');
          } else {
            order.push('header-automations');
          }
        }
        if (!order.includes('header-workflows')) {
          const sessionIdx = order.indexOf('createsession');
          if (sessionIdx >= 0) {
            order.splice(sessionIdx, 0, 'header-workflows');
          } else {
            order.push('header-workflows');
          }
        }
        if (!order.includes('header-workspace')) {
          const folderIdx = order.indexOf('createfolder');
          if (folderIdx >= 0) {
            order.splice(folderIdx, 0, 'header-workspace');
          } else {
            order.push('header-workspace');
          }
        }
        order = order.filter(id => id !== 'header-others' && id !== 'header-shortcuts');
        
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
          'header-workspace',
          'createfolder',
          'createworkspace',
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

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
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
          createfolder: stored.createfolder ?? false,
          createworkspace: stored.createworkspace ?? false,
        }));
      }
      if (changes.favorites_create_items_order) {
        let order: string[] = changes.favorites_create_items_order.newValue || [];
        const defaultAllIds = [
          'createtodo',
          'createlinks',
          'ai',
          'createsnippet',
          'agent',
          'createsession',
          'createnotes',
          'createfolder',
          'createworkspace',
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

  const renderCreateItem = (id: string, isIndented: boolean = false) => {
    const paddingClass = isIndented ? 'pl-[28px]' : 'pl-[12px]';
    switch (id) {
      case 'createlinks':
        return (
          <div
            key="createlinks"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createlinks');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaLink size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Link
            </span>
          </div>
        );
      case 'createsession':
        return (
          <div
            key="createsession"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createsession');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaLayerGroup size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Tab Session
            </span>
          </div>
        );
      case 'createnotes':
        return (
          <div
            key="createnotes"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createnotes');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Note
            </span>
          </div>
        );
      case 'ai':
        return (
          <div
            key="ai"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('ai');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaRobot size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Chat Agent
            </span>
          </div>
        );
      case 'createtodo':
        return (
          <div
            key="createtodo"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createtodo');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Todo
            </span>
          </div>
        );
      case 'agent':
        return (
          <div
            key="agent"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('agent');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiZap size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Automation (Beta)
            </span>
          </div>
        );
      case 'createsnippet':
        return (
          <div
            key="createsnippet"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createsnippet');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FaCode size={14} className="text-[var(--color-iconDefault)] shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Text Expander
            </span>
          </div>
        );
      case 'createfolder':
        return (
          <div
            key="createfolder"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createfolder');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiFolder size={14} className="text-gray-400 shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
              Folder
            </span>
          </div>
        );
      case 'createworkspace':
        return (
          <div
            key="createworkspace"
            className={`flex items-center cursor-pointer group py-[4px] ${paddingClass} gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150`}
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createworkspace');
            }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <FiBriefcase size={14} className="text-gray-400 shrink-0" />
            </div>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
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
      <div className="px-3 pt-2.5 pb-1">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
          <span className="text-[11px] font-bold tracking-wider capitalize text-neutral-500 dark:text-neutral-400">
            Create
          </span>
          <button
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createlinks');
            }}
            title="Customize Create Items"
            className="text-neutral-400 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-[18px] font-bold select-none leading-none flex items-center justify-center p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none border-none pb-0.5">
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col px-3 pt-0.5 pb-2">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
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
                          <span
                            className={`text-[11px] font-bold tracking-wider capitalize ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
                          >
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
              className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateMenuPanel;

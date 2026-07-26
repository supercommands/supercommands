import type React from 'react';
import { useCallback } from 'react';
import {
  useUIStore,
  useIsFullScreenModalOpen,
  useShowTodosView,
  useTodoCreatePrefill,
} from '../../../../shared-components/uiStateManager';
import { BsCalendarCheck } from 'react-icons/bs';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { useAppearance } from '@extension/ui';
import RightTodoWorkspace from '../../../../allObjectFolder/src/createObject/todos/ui/TodoWorkspace';

interface AppTodoSidebarProps {
  isEmbedded: boolean;
  isSpreadsheetViewOpen: boolean;
  isBoardViewOpen: boolean;
  isActuallyExpanded: boolean;
  isLoggedIn: boolean;
}

export const AppTodoSidebar: React.FC<AppTodoSidebarProps> = ({
  isEmbedded,
  isSpreadsheetViewOpen,
  isBoardViewOpen,
  isActuallyExpanded,
  isLoggedIn,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const isFullScreenModalOpen = useIsFullScreenModalOpen();
  const showTodosView = useShowTodosView();
  const todoCreatePrefill = useTodoCreatePrefill();
  const activeView = useUIStore(s => s.activeView);
  const activeEditor = useUIStore(s => s.activeEditor);
  const lockedCommand = useUIStore(s => s.lockedCommand);

  const todoDisplayMode = useUIStore(s => s.todoDisplayMode);

  const handleCloseTodosView = useCallback(() => {
    useUIStore.getState().setSidebar('todoSidebar', { open: false });
  }, []);

  return (
    <>
      {/* ── Right-Side Todo Panel & Toggle (Hidden when a full-screen modal is open) ── */}
      {!isEmbedded && (
        <div
          className={`${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {/* Floating Toggle Button */}
          {!isEmbedded &&
            todoDisplayMode !== 'data-blur' &&
            todoDisplayMode !== 'pin' &&
            !showTodosView &&
            !isBoardViewOpen &&
            !isSpreadsheetViewOpen &&
            activeView?.type === 'home' &&
            !activeEditor &&
            !lockedCommand && (
              <button
                onClick={() => {
                  console.log('Today tasks button clicked!');
                  useUIStore.getState().setSidebar('todoSidebar', { open: true });
                }}
                className={`fixed right-4 top-[14vh] z-[40] flex items-center gap-1.5 hover:gap-3 px-2.5 hover:px-4 py-1.5 rounded-full shadow-lg border transition-all duration-300 ease-out group
              ${
                isDark
                  ? 'bg-[#171821]/95 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/30 hover:shadow-white/5'
                  : 'bg-white/95 border-black/10 text-neutral-500 hover:text-black hover:bg-black/5 hover:border-black/20'
              } backdrop-blur-md cursor-pointer`}
                title="Open Todo Workspace">
                <BsCalendarCheck size={14} className="transition-transform duration-200" />
                <span className="text-[11px] font-semibold">Today tasks</span>
              </button>
            )}

          {/* Right Todo Workspace Panel */}
          {(() => {
            const isCreateModalOnly = !!todoCreatePrefill?.isCreateModalOnly && activeEditor?.type !== 'todo';
            return (
              <RightTodoWorkspace
                isOpen={
                  isCreateModalOnly ||
                  (todoDisplayMode === 'data-blur' || todoDisplayMode === 'pin'
                    ? activeView?.type === 'home' && !isBoardViewOpen && !isSpreadsheetViewOpen && !isActuallyExpanded
                    : showTodosView &&
                      activeView?.type === 'home' &&
                      (!isBoardViewOpen || showTodosView) &&
                      !isSpreadsheetViewOpen &&
                      !isActuallyExpanded)
                }
                onClose={() => {
                  if (showTodosView) handleCloseTodosView();
                  else useUIStore.getState().closeEditor();
                }}
                isLoggedIn={isLoggedIn}
                isCreateModalOnly={isCreateModalOnly}
              />
            );
          })()}
        </div>
      )}
    </>
  );
};

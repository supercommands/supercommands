import * as React from 'react';
import { useEffect } from 'react';
import { BsPinAngleFill } from 'react-icons/bs';
import TodoList from './TodoList';
import { useUIStore } from '../../../../../shared-components/uiStateManager';

interface TodoWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
  isCreateModalOnly?: boolean;
}

const TodoWorkspace: React.FC<TodoWorkspaceProps> = ({
  isOpen,
  onClose,
  isLoggedIn,
  isCreateModalOnly,
}) => {
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true; // We handled the escape
    });
    return unregister;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={
        isCreateModalOnly
          ? "fixed inset-0 z-[45] pointer-events-none"
          : 'fixed right-4 top-[14vh] max-h-[85vh] w-[360px] z-[45] flex flex-col border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden'
      }
    >
      {/* Content */}
      <div className={isCreateModalOnly ? "fixed inset-0 pointer-events-auto" : "flex-1 min-h-0 overflow-y-auto relative custom-scrollbar"}>
        <TodoList
          isOpen={isOpen}
          onClose={onClose}
          isLoggedIn={isLoggedIn}
          isSidebar={!isCreateModalOnly}
          isCreateModalOnly={isCreateModalOnly}
        />
      </div>
    </div>
  );
};

export default TodoWorkspace;

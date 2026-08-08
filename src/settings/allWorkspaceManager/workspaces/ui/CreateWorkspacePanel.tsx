import * as React from 'react';
import { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { getAvatarColor, getSingleInitial } from '../../../../shared-components/utils/avatarColors';
import { createWorkspace } from '../workspaceData';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface CreateWorkspacePanelProps {
  onClose?: () => void;
  onSuccess?: (workspaceId: string, workspaceName: string) => void;
}

const CreateWorkspacePanel: React.FC<CreateWorkspacePanelProps> = ({ onClose, onSuccess }) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (onClose) {
        onClose();
        return true;
      }
      return false;
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregister();
    };
  }, [onClose, workspaceName]);

  const handleCreate = async () => {
    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const data = await createWorkspace(workspaceName.trim());
      if (onSuccess) {
        onSuccess(data.id, data.workspaceName);
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err?.message || 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden outline-none text-[var(--color-textPrimary)] select-none"
    >
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2 md:top-2.5 md:right-2 p-2 rounded-md text-[var(--color-textSecondary)] hover:text-[var(--color-textError)] hover:bg-[var(--color-hoverBg)] transition-colors z-50 cursor-pointer"
      >
        <FaTimes size={16} />
      </button>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar w-full">
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(workspaceName || 'W')} text-base font-bold text-white shadow-md transition-colors duration-300`}
            >
              {getSingleInitial(workspaceName || 'W')}
            </div>
            <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Workspace Details</h2>
          </div>

          <div className="mb-4 w-full">
            <div className="relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-4 py-2.5 flex items-center">
              <input
                type="text"
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                placeholder="Give your organization a name..."
                className="flex-1 text-sm font-medium text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0"
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-xs text-[var(--color-textError)] mt-2 font-semibold">{error}</p>}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-6 py-4 
                border-t border-[var(--color-borderDefault)]
                bg-[var(--color-panelBg)] 
                text-xs text-[var(--color-textSecondary)] flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--color-textPrimary)] transition-colors"
            onClick={onClose}
          >
            <span className="px-1.5 py-0.5 rounded bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[9px] font-bold">Esc</span>
            <span className="text-[var(--color-textSecondary)] font-medium">Back</span>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating || !workspaceName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-inputBg)] hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating...' : 'Create'}
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] text-[9px] font-bold">Alt+Enter</span>
        </button>
      </div>
    </div>
  );
};

export default CreateWorkspacePanel;

import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { getAvatarColor, getSingleInitial } from '../../../../shared-components/utils/avatarColors';
import { createFolder } from '../folderData';
import { useWorkspaces } from '../../workspaces/workspaceHooks';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface CreateFolderPanelProps {
  onClose?: () => void;
  onSuccess?: (folderId: string, folderName: string) => void;
  initialWorkspaceId?: string;
}

const CreateFolderPanel: React.FC<CreateFolderPanelProps> = ({ onClose, onSuccess, initialWorkspaceId }) => {
  const [folderName, setFolderName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId || '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { workspaces } = useWorkspaces();

  // If no initialWorkspaceId and we fetch workspaces, select the first one by default
  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

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
  }, [onClose, folderName, selectedWorkspaceId]);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }
    
    if (!selectedWorkspaceId) {
      setError('Please select a workspace');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const data = await createFolder(selectedWorkspaceId, folderName.trim());
      if (onSuccess) {
        onSuccess(data.id, data.folderName);
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      setError(err?.message || 'Failed to create folder');
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
              className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(folderName || 'F')} text-base font-bold text-white shadow-md transition-colors duration-300`}
            >
              {getSingleInitial(folderName || 'F')}
            </div>
            <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Folder Details</h2>
          </div>

          <div className="flex flex-col gap-4 mb-4 w-full">
            <div className="relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-4 py-2.5 flex items-center">
              <input
                type="text"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                placeholder="Give your folder a name..."
                className="flex-1 text-sm font-medium text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0"
                autoFocus
              />
            </div>
            
            <div className="relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-4 py-2.5 flex items-center">
              <select
                value={selectedWorkspaceId}
                onChange={e => setSelectedWorkspaceId(e.target.value)}
                className="flex-1 text-sm font-medium text-black dark:text-white bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 cursor-pointer"
              >
                <option value="" disabled className="text-gray-500">Select workspace / space...</option>
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id} className="text-black dark:text-white bg-white dark:bg-[#1a1b1e]">
                    {workspace.workspaceName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--color-textError)] mt-2 font-semibold">{error}</p>}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-6 py-4 
                border-t border-[var(--color-borderDefault)]
                bg-[var(--color-hoverBg)] 
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
          disabled={isCreating || !folderName.trim() || !selectedWorkspaceId}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accentHover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md border-none cursor-pointer"
        >
          {isCreating ? 'Creating...' : 'Create'}
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-selectedBg)] text-[9px] font-bold">Alt+Enter</span>
        </button>
      </div>
    </div>
  );
};

export default CreateFolderPanel;

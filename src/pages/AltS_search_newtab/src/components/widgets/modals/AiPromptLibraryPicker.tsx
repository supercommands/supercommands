import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuFolder, LuSparkles, LuBot } from 'react-icons/lu';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import {
  useExcludedAiPromptModels,
  resolveEnabledAiPromptModels,
} from '../../../../../../allObjectFolder/src/createObject/aiPrompt';

interface AiPromptLibraryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPromptIds: string[]) => Promise<void> | void;
  initialSelectedIds?: string[];
  title?: string;
  isCreationMode?: boolean;
}

const EMPTY_SELECTED_IDS: readonly string[] = [];

const stripHtml = (html: string): string => {
  if (!html) return '';
  return String(html)
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const ModelFavicon: React.FC<{ host: string; explicitFaviconUrl?: string; size?: number }> = ({
  host,
  explicitFaviconUrl,
  size = 14,
}) => {
  const [hasError, setHasError] = useState(false);
  const iconSrc = !hasError
    ? explicitFaviconUrl || (host ? getFaviconUrl(`https://${host}`) : '')
    : '';

  if (!iconSrc || hasError) {
    return (
      <LuBot
        size={size}
        className="shrink-0 p-0.5 rounded-full border border-[var(--color-cardBg)] text-[var(--color-textMuted)] bg-[var(--color-inputBg)]"
      />
    );
  }

  return (
    <img
      src={iconSrc}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover shrink-0 border border-[var(--color-cardBg)]"
      onError={() => setHasError(true)}
    />
  );
};

export const AiPromptLibraryPicker: React.FC<AiPromptLibraryPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = EMPTY_SELECTED_IDS,
  title = 'Select Chat Agents',
  isCreationMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevIsOpenRef = useRef(false);

  const aiPrompts = useDbStore(state => state.aiPrompts);
  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);
  const { excludedModelIds, isLoading: isModelsLoading } = useExcludedAiPromptModels();

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSelectedIds(new Set(initialSelectedIds));
      setSearchTerm('');
      setIsSubmitting(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialSelectedIds]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validPrompts = aiPrompts.filter(prompt => prompt.deletedAt == null);

  const filteredPrompts = validPrompts.filter(promptRecord => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    const titleMatch = (promptRecord.title || '').toLowerCase().includes(term);
    const promptMatch = stripHtml(promptRecord.prompt || '').toLowerCase().includes(term);
    const rulesMatch = (promptRecord.rules || '').toLowerCase().includes(term);

    const workspace = getWorkspaceById(promptRecord.workspaceId);
    const folder = getFolderById(promptRecord.folderId);
    const workspaceMatch = (workspace?.workspaceName || '').toLowerCase().includes(term);
    const folderMatch = (folder?.folderName || '').toLowerCase().includes(term);

    const enabledModels = resolveEnabledAiPromptModels(promptRecord, excludedModelIds);
    const modelMatch = enabledModels.some(model => {
      const nameMatch = (model.name || '').toLowerCase().includes(term);
      const hostMatch = (model.host || '').toLowerCase().includes(term);
      const customUrl = promptRecord.modelUrls?.[model.id] || '';
      const urlMatch = customUrl.toLowerCase().includes(term);
      return nameMatch || hostMatch || urlMatch;
    });

    return titleMatch || promptMatch || rulesMatch || workspaceMatch || folderMatch || modelMatch;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredPrompts.forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (isCreationMode && selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(Array.from(selectedIds));
      onClose();
    } catch (error) {
      console.error('Failed to confirm AI prompt selection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled = isSubmitting || (isCreationMode && selectedIds.size === 0);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-auto animate-in fade-in duration-150 p-4 bg-black/40 backdrop-blur-xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        className="flex flex-col w-[460px] max-w-full max-h-[min(680px,85vh)] rounded-2xl border shadow-2xl overflow-hidden transition-colors"
        style={{
          backgroundColor: 'var(--color-editorBg)',
          borderColor: 'var(--color-borderDefault)',
          color: 'var(--color-textPrimary)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div className="flex items-center gap-2">
            <LuSparkles size={18} style={{ color: 'var(--color-iconDefault)' }} />
            <h3 className="text-sm font-bold tracking-wide" style={{ color: 'var(--color-textPrimary)' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--color-textMuted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-textPrimary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textMuted)')}>
            <LuX size={18} />
          </button>
        </div>

        {/* Search & Bulk Actions Bar */}
        <div className="p-4 border-b shrink-0 flex flex-col gap-2.5" style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
            style={{
              backgroundColor: 'var(--color-inputBg)',
              borderColor: 'var(--color-borderDefault)',
            }}>
            <LuSearch size={16} className="shrink-0" style={{ color: 'var(--color-textMuted)' }} />
            <input
              type="text"
              placeholder="Search Chat Agents, rules, models..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--color-textPrimary)' }}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-xs px-0.5">
            <span style={{ color: 'var(--color-textMuted)' }}>
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:underline text-[11px] font-medium cursor-pointer text-[var(--color-textSecondary)]">
                Select All
              </button>
              <span style={{ color: 'var(--color-borderDefault)' }}>|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="hover:underline text-[11px] font-medium cursor-pointer text-[var(--color-textSecondary)]">
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Prompts List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar min-h-0">
          {validPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              <LuSparkles size={24} className="mb-2 opacity-50" />
              <span>No Chat Agents found. Create a Chat Agent first.</span>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No Chat Agents match &quot;{searchTerm}&quot;.
            </div>
          ) : (
            filteredPrompts.map(promptRecord => {
              const isSelected = selectedIds.has(promptRecord.id);
              const workspace = getWorkspaceById(promptRecord.workspaceId);
              const folder = getFolderById(promptRecord.folderId);
              const locationText = [workspace?.workspaceName, folder?.folderName].filter(Boolean).join(' / ');

              const plainPromptPreview = stripHtml(promptRecord.prompt);
              const enabledModels = resolveEnabledAiPromptModels(promptRecord, excludedModelIds);

              return (
                <label
                  key={promptRecord.id}
                  onClick={e => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      toggleSelect(promptRecord.id);
                    }
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
                    isSelected ? 'ring-1' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--color-selectedBg, var(--color-cardBg))'
                      : 'var(--color-cardBg, var(--color-inputBg))',
                    borderColor: isSelected
                      ? 'var(--color-borderActive)'
                      : 'var(--color-borderDefault)',
                  }}>
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => {
                      e.stopPropagation();
                      toggleSelect(promptRecord.id);
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-400 accent-[var(--color-borderActive,#3b82f6)] shrink-0 cursor-pointer"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-textPrimary)' }}>
                        {promptRecord.title || 'Untitled Prompt'}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border"
                        style={{
                          borderColor: 'var(--color-borderDefault)',
                          backgroundColor: 'var(--color-bgSecondary, transparent)',
                          color: 'var(--color-textMuted)',
                        }}>
                        {enabledModels.length} {enabledModels.length === 1 ? 'model' : 'models'}
                      </span>
                    </div>

                    {/* Short Prompt Preview */}
                    {plainPromptPreview && (
                      <p className="text-[11px] line-clamp-2 leading-tight" style={{ color: 'var(--color-textSecondary)' }}>
                        {plainPromptPreview}
                      </p>
                    )}

                    {/* Models Favicon Stack */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isModelsLoading ? (
                        <span className="text-[10px] text-[var(--color-textMuted)]">Loading models...</span>
                      ) : enabledModels.length === 0 ? (
                        <span className="text-[10px] text-[var(--color-textMuted)]">No active models</span>
                      ) : (
                        <>
                          <div className="flex items-center -space-x-1 shrink-0">
                            {enabledModels.slice(0, 3).map((model, idx) => (
                              <ModelFavicon
                                key={model.id || idx}
                                host={model.host}
                                size={14}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] truncate text-[var(--color-textMuted)]">
                            {enabledModels.slice(0, 2).map(m => m.name).join(', ')}
                            {enabledModels.length > 2 ? ` +${enabledModels.length - 2}` : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Location */}
                    {locationText && (
                      <div className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: 'var(--color-textMuted)' }}>
                        <LuFolder size={10} />
                        <span className="truncate">{locationText}</span>
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-borderDefault)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--color-borderDefault)',
              color: 'var(--color-textSecondary)',
            }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-1.5 text-xs font-medium rounded-xl transition-colors shadow-sm ${
              isConfirmDisabled
                ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                : 'cursor-pointer bg-[var(--color-borderActive,#3b82f6)] text-white hover:opacity-90'
            }`}>
            Confirm ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AiPromptLibraryPicker;

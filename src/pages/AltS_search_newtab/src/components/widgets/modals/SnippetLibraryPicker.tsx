import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuFolder, LuTag } from 'react-icons/lu';
import { FaCode } from 'react-icons/fa';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { getSnippetPlainTextPreview } from '../items/snippetPreviewUtils';

interface SnippetLibraryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedSnippetIds: string[]) => Promise<void> | void;
  initialSelectedIds?: string[];
  title?: string;
  isCreationMode?: boolean;
}

const EMPTY_SELECTED_SNIPPET_IDS: readonly string[] = [];

export const SnippetLibraryPicker: React.FC<SnippetLibraryPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = EMPTY_SELECTED_SNIPPET_IDS,
  title = 'Select Text Expanders',
  isCreationMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prevIsOpenRef = useRef(false);

  const snippets = useDbStore(state => state.snippets);
  const tags = useDbStore(state => state.tags);
  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSelectedIds(new Set(initialSelectedIds));
      setSearchTerm('');
      setIsSubmitting(false);
      setErrorMessage(null);
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

  const validSnippets = snippets.filter(s => s.deletedAt == null);

  const tagMap = new Map(tags.map(t => [t.id, t.name]));

  const filteredSnippets = validSnippets.filter(snippetRecord => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    const titleMatch = (snippetRecord.title || '').toLowerCase().includes(term);
    const shortcutMatch = (snippetRecord.shortcut || '').toLowerCase().includes(term);
    const previewMatch = getSnippetPlainTextPreview(snippetRecord.config, 200).toLowerCase().includes(term);

    const workspace = getWorkspaceById(snippetRecord.workspaceId);
    const folder = getFolderById(snippetRecord.folderId);
    const workspaceMatch = (workspace?.workspaceName || '').toLowerCase().includes(term);
    const folderMatch = (folder?.folderName || '').toLowerCase().includes(term);

    const tagMatch = (snippetRecord.tagIds || []).some(tagId => {
      const tagName = tagMap.get(tagId);
      return tagName ? tagName.toLowerCase().includes(term) : false;
    });

    return titleMatch || shortcutMatch || previewMatch || workspaceMatch || folderMatch || tagMatch;
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
      filteredSnippets.forEach(s => next.add(s.id));
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
    setErrorMessage(null);
    try {
      await onConfirm(Array.from(selectedIds));
      onClose();
    } catch (error) {
      console.error('Failed to confirm text expander selection:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save widget configuration.');
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
        className="flex flex-col w-[480px] max-w-full max-h-[min(680px,85vh)] rounded-2xl border shadow-2xl overflow-hidden transition-colors"
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
            <FaCode size={18} style={{ color: 'var(--color-iconDefault)' }} />
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
              placeholder="Search title, shortcut, preview, tags..."
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

        {/* Error message banner */}
        {errorMessage && (
          <div className="px-4 py-2 text-xs bg-red-500/10 text-red-500 border-b border-red-500/20 shrink-0">
            {errorMessage}
          </div>
        )}

        {/* Snippets List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar min-h-0">
          {validSnippets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              <FaCode size={24} className="mb-2 opacity-50" />
              <span>No text expanders found. Create a text expander snippet first.</span>
            </div>
          ) : filteredSnippets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No text expanders match &quot;{searchTerm}&quot;.
            </div>
          ) : (
            filteredSnippets.map(snippetRecord => {
              const isSelected = selectedIds.has(snippetRecord.id);
              const workspace = getWorkspaceById(snippetRecord.workspaceId);
              const folder = getFolderById(snippetRecord.folderId);
              const locationText = [workspace?.workspaceName, folder?.folderName].filter(Boolean).join(' / ');
              const preview = getSnippetPlainTextPreview(snippetRecord.config, 100);

              const recordTags = (snippetRecord.tagIds || [])
                .map(tId => tagMap.get(tId))
                .filter((tName): tName is string => Boolean(tName));

              return (
                <div
                  key={snippetRecord.id}
                  tabIndex={0}
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={e => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      toggleSelect(snippetRecord.id);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelect(snippetRecord.id);
                    }
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-borderActive)] ${
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
                      toggleSelect(snippetRecord.id);
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-400 accent-[var(--color-borderActive,#3b82f6)] shrink-0 cursor-pointer"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--color-textPrimary)' }}>
                        <FaCode size={13} className="shrink-0 opacity-70" />
                        {snippetRecord.title || 'Untitled Snippet'}
                      </span>
                      {snippetRecord.shortcut && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 border"
                          style={{
                            borderColor: 'var(--color-borderDefault)',
                            backgroundColor: 'var(--color-bgSecondary, transparent)',
                            color: 'var(--color-textSecondary)',
                          }}>
                          {snippetRecord.shortcut}
                        </span>
                      )}
                    </div>

                    {/* Short Plain-Text Preview */}
                    {preview && (
                      <p className="text-[11px] line-clamp-2 leading-tight" style={{ color: 'var(--color-textSecondary)' }}>
                        {preview}
                      </p>
                    )}

                    {/* Tags and Location */}
                    <div className="flex items-center flex-wrap gap-2 text-[10px] mt-0.5" style={{ color: 'var(--color-textMuted)' }}>
                      {locationText && (
                        <div className="flex items-center gap-1">
                          <LuFolder size={10} />
                          <span className="truncate">{locationText}</span>
                        </div>
                      )}

                      {recordTags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <LuTag size={10} />
                          {recordTags.map(tName => (
                            <span
                              key={tName}
                              className="px-1 py-0.2 rounded border bg-[var(--color-inputBg)] text-[9.5px]"
                              style={{ borderColor: 'var(--color-borderDefault)' }}>
                              {tName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
            {isSubmitting ? 'Saving...' : `Confirm (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SnippetLibraryPicker;

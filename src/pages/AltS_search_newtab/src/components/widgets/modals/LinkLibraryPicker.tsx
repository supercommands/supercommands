import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuFolder, LuGlobe } from 'react-icons/lu';
import { FiGlobe } from 'react-icons/fi';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface LinkLibraryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => Promise<void> | void;
  initialSelectedIds?: string[];
  title?: string;
  isCreationMode?: boolean;
}

const EMPTY_SELECTED_IDS: string[] = [];

const getHostnameFromUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  try {
    const formatted = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.includes('://')
      ? rawUrl
      : `https://${rawUrl}`;
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

export const LinkLibraryPicker: React.FC<LinkLibraryPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = EMPTY_SELECTED_IDS,
  title = 'Select Links',
  isCreationMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevIsOpenRef = useRef(false);

  const links = useDbStore(state => state.links);
  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);

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

  const validLinks = links.filter(link => link.deletedAt == null);

  const filteredLinks = validLinks.filter(link => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = (link.title || '').toLowerCase().includes(term);
    const urlsMatch = (link.urls || []).some(item => {
      const nameMatch = (item.name || item.title || '').toLowerCase().includes(term);
      const urlMatch = (item.url || '').toLowerCase().includes(term);
      const hostMatch = getHostnameFromUrl(item.url || '').toLowerCase().includes(term);
      return nameMatch || urlMatch || hostMatch;
    });
    return titleMatch || urlsMatch;
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
      filteredLinks.forEach(l => next.add(l.id));
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
      console.error('Failed to confirm link selection:', error);
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
        className="flex flex-col w-[440px] max-w-full h-[540px] rounded-2xl border shadow-2xl overflow-hidden transition-colors"
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
            <FiGlobe size={18} style={{ color: 'var(--color-iconDefault)' }} />
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
              placeholder="Search link collections..."
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

        {/* Links List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar">
          {validLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              <LuGlobe size={24} className="mb-2 opacity-50" />
              <span>No link collections found. Create a link collection first.</span>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No link collections match &quot;{searchTerm}&quot;.
            </div>
          ) : (
            filteredLinks.map(link => {
              const isSelected = selectedIds.has(link.id);
              const workspace = getWorkspaceById(link.workspaceId);
              const folder = getFolderById(link.folderId);
              const locationText = [workspace?.workspaceName, folder?.folderName].filter(Boolean).join(' / ');
              const urlItems = link.urls || [];
              const previewItems = urlItems.slice(0, 2);

              return (
                <label
                  key={link.id}
                  onClick={e => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      toggleSelect(link.id);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
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
                  {/* Real Accessible Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => {
                      e.stopPropagation();
                      toggleSelect(link.id);
                    }}
                    className="w-4 h-4 rounded border-gray-400 accent-[var(--color-borderActive,#3b82f6)] shrink-0 cursor-pointer"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-textPrimary)' }}>
                        {link.title || 'Untitled Link Collection'}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border"
                        style={{
                          borderColor: 'var(--color-borderDefault)',
                          backgroundColor: 'var(--color-bgSecondary, transparent)',
                          color: 'var(--color-textMuted)',
                        }}>
                        {urlItems.length} {urlItems.length === 1 ? 'link' : 'links'}
                      </span>
                    </div>

                    {/* Stacked Favicons & Preview */}
                    <div className="flex items-center gap-2">
                      {previewItems.length > 0 && (
                        <div className="flex items-center -space-x-1 shrink-0">
                          {previewItems.map((item, idx) => {
                            const iconUrl = item.favIconUrl || (item.url ? getFaviconUrl(item.url) : '');
                            return iconUrl ? (
                              <img
                                key={item.id || idx}
                                src={iconUrl}
                                alt=""
                                className="w-3.5 h-3.5 rounded-full object-cover border"
                                style={{ borderColor: 'var(--color-cardBg)' }}
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <FiGlobe
                                key={item.id || idx}
                                size={12}
                                className="w-3.5 h-3.5 rounded-full border p-0.5"
                                style={{ borderColor: 'var(--color-cardBg)', color: 'var(--color-textMuted)' }}
                              />
                            );
                          })}
                        </div>
                      )}

                      <span className="text-[10.5px] truncate" style={{ color: 'var(--color-textSecondary)' }}>
                        {previewItems.map(item => item.title || item.name || getHostnameFromUrl(item.url)).join(', ')}
                        {urlItems.length > 2 ? ` +${urlItems.length - 2} more` : ''}
                      </span>
                    </div>

                    {/* Location */}
                    {locationText && (
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-textMuted)' }}>
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

export default LinkLibraryPicker;

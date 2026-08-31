import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuFolder, LuGlobe } from 'react-icons/lu';
import { FiGlobe } from 'react-icons/fi';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import type { LinkRecord } from '../../../../../../allObjectFolder/src/createObject/links/linkTypes';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface LinkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLink: (link: LinkRecord) => void;
}

const getHostnameFromUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

export const LinkPickerModal: React.FC<LinkPickerModalProps> = ({ isOpen, onClose, onSelectLink }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const links = useDbStore(state => state.links);
  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

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
      return nameMatch || urlMatch;
    });
    return titleMatch || urlsMatch;
  });

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-end pointer-events-auto animate-in fade-in duration-150 pr-[290px]"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        className="flex flex-col w-[320px] h-[460px] rounded-2xl border shadow-2xl overflow-hidden transition-colors"
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
              Select Link Collection
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

        {/* Search Bar Input */}
        <div className="p-4 border-b shrink-0" style={{ borderColor: 'var(--color-borderDefault)' }}>
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
        </div>

        {/* Links List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar">
          {validLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              <LuGlobe size={24} className="mb-2 opacity-50" />
              <span>No link collections found. Create a link collection first to add it as a widget.</span>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No link collections match &quot;{searchTerm}&quot;.
            </div>
          ) : (
            filteredLinks.map(link => {
              const workspace = getWorkspaceById(link.workspaceId);
              const folder = getFolderById(link.folderId);
              const locationText = [workspace?.workspaceName, folder?.folderName].filter(Boolean).join(' / ');
              const urlItems = link.urls || [];
              const previewItems = urlItems.slice(0, 3);

              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    onSelectLink(link);
                    onClose();
                  }}
                  className="flex flex-col gap-1.5 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer group"
                  style={{
                    backgroundColor: 'var(--color-cardBg, var(--color-inputBg))',
                    borderColor: 'var(--color-borderDefault)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-borderActive)';
                    e.currentTarget.style.backgroundColor = 'var(--color-selectedBg, var(--color-cardBg))';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-borderDefault)';
                    e.currentTarget.style.backgroundColor = 'var(--color-cardBg, var(--color-inputBg))';
                  }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-textPrimary)' }}>
                      {link.title || 'Untitled Link Collection'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border"
                      style={{
                        borderColor: 'var(--color-borderDefault)',
                        backgroundColor: 'var(--color-bgSecondary, transparent)',
                        color: 'var(--color-textMuted)',
                      }}>
                      {urlItems.length} {urlItems.length === 1 ? 'link' : 'links'}
                    </span>
                  </div>

                  {/* Location info */}
                  {locationText && (
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-textMuted)' }}>
                      <LuFolder size={10} />
                      <span className="truncate">{locationText}</span>
                    </div>
                  )}

                  {/* Favicons & Domain Preview */}
                  {previewItems.length > 0 && (
                    <div className="flex items-center gap-2 pt-0.5">
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

                      <span className="text-[10.5px] truncate" style={{ color: 'var(--color-textSecondary)' }}>
                        {previewItems.map(item => item.title || item.name || getHostnameFromUrl(item.url)).join(', ')}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LinkPickerModal;

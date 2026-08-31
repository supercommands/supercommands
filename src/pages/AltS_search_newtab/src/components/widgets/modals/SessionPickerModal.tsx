import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuLayers, LuFolder } from 'react-icons/lu';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import type { SessionRecord } from '../../../../../../allObjectFolder/src/createObject/session/sessionTypes';

interface SessionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (session: SessionRecord) => void;
  linkedSessionIds?: Set<string>;
}

export const SessionPickerModal: React.FC<SessionPickerModalProps> = ({ isOpen, onClose, onSelectSession, linkedSessionIds }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Pull existing sessions reactively from Dexie store
  const sessions = useDbStore(state => state.sessions);
  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);

  React.useEffect(() => {
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

  const filteredSessions = sessions.filter(session => {
    if (linkedSessionIds?.has(session.id)) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitle = session.title.toLowerCase().includes(term);
    const matchDesc = (session.description || '').toLowerCase().includes(term);
    const matchUrl = (session.urls || []).some(u => (u.title || u.url || '').toLowerCase().includes(term));
    return matchTitle || matchDesc || matchUrl;
  });

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-end pointer-events-auto animate-in fade-in duration-150 pr-[290px]"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        className="flex flex-col w-[340px] h-[480px] rounded-2xl border shadow-2xl overflow-hidden transition-colors"
        style={{
          backgroundColor: 'var(--color-editorBg)',
          borderColor: 'var(--color-borderDefault)',
          color: 'var(--color-textPrimary)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div className="flex items-center gap-2">
            <LuLayers size={20} style={{ color: 'var(--color-iconDefault)' }} />
            <h3 className="text-sm font-bold tracking-wide" style={{ color: 'var(--color-textPrimary)' }}>
              Select Session to add Widget
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--color-textMuted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-textPrimary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textMuted)')}>
            <LuX size={18} />
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
            style={{
              backgroundColor: 'var(--color-inputBg)',
              borderColor: 'var(--color-borderDefault)',
            }}>
            <LuSearch size={16} className="shrink-0" style={{ color: 'var(--color-textMuted)' }} />
            <input
              type="text"
              placeholder="Search tab sessions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--color-textPrimary)' }}
              autoFocus
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No sessions found. Create a session first to add it as a widget.
            </div>
          ) : (
            filteredSessions.map(session => {
              const workspace = getWorkspaceById(session.workspaceId);
              const folder = getFolderById(session.folderId);
              const locationText = [workspace?.workspaceName, folder?.folderName].filter(Boolean).join(' / ');
              const urlCount = session.urls?.length || 0;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className="flex flex-col gap-1 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer"
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
                      {session.title || 'Untitled Session'}
                    </span>
                    {locationText && (
                      <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--color-textMuted)' }}>
                        <LuFolder size={10} />
                        {locationText}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px]" style={{ color: 'var(--color-textSecondary)' }}>
                    <span>{urlCount} {urlCount === 1 ? 'link tab' : 'link tabs'}</span>
                    {session.sessionOpenSettings?.openMode && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                        {session.sessionOpenSettings.openMode.replace('_', ' ')}
                      </span>
                    )}
                  </div>
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

export default SessionPickerModal;

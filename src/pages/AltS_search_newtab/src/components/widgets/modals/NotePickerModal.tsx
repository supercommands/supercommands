import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { LuSearch, LuX, LuFileText, LuFolder } from 'react-icons/lu';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import { extractTextFromHTML } from '../../../../../../allObjectFolder/src/createObject/notes/noteHelpers';
interface NotePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectNote: (note: NoteRecord) => void;
}
export const NotePickerModal: React.FC<NotePickerModalProps> = ({ isOpen, onClose, onSelectNote }) => {
    const [searchTerm, setSearchTerm] = useState('');
    // Pull existing notes reactively from Dexie store
    const notes = useDbStore(state => state.notes);
    const getOrganisationById = useDbStore(state => state.getOrganisationById);
    React.useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const filteredNotes = notes.filter(note => {
        if (!searchTerm.trim())
            return true;
        const term = searchTerm.toLowerCase();
        const cleanBody = extractTextFromHTML(note.body || '').toLowerCase();
        return note.title.toLowerCase().includes(term) || cleanBody.includes(term);
    });
    return ReactDOM.createPortal(<div className="fixed inset-0 z-[999999] flex items-center justify-end pointer-events-auto animate-in fade-in duration-150 pr-[290px]" onClick={e => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
      <div className="flex flex-col w-[320px] h-[460px] rounded-2xl border shadow-2xl overflow-hidden transition-colors" style={{
            backgroundColor: 'var(--color-editorBg)',
            borderColor: 'var(--color-borderDefault)',
            color: 'var(--color-textPrimary)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div className="flex items-center gap-2">
            <LuFileText size={20} style={{ color: 'var(--color-noteLibraryIcon)' }}/>
            <h3 className="text-sm font-bold tracking-wide" style={{ color: 'var(--color-textPrimary)' }}>
              Select Note to add Widget
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--color-textMuted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-textPrimary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textMuted)')}>
            <LuX size={18}/>
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="p-3.5 border-b shrink-0" style={{ borderColor: 'var(--color-borderDefault)' }}>
          <div className="flex shrink-0 items-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,rgba(255,255,255,0.05))] px-3 py-2 transition-colors focus-within:border-[var(--color-borderActive)]">
            <LuSearch size={14} className="mr-2 shrink-0 text-[var(--color-textMuted)]"/>
            <input type="text" placeholder="Search notes..." aria-label="Search notes" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-xs min-w-0 flex-1 border-0 bg-transparent text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] focus:outline-none" autoFocus/>
            {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} aria-label="Clear note search" className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--color-textMuted)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
                <LuX size={13}/>
              </button>)}
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 clean-scrollbar">
          {filteredNotes.length === 0 ? (<div className="flex flex-col items-center justify-center h-full text-center text-xs p-6" style={{ color: 'var(--color-textMuted)' }}>
              No notes found. Create a note first to add it as a widget.
            </div>) : (filteredNotes.map(note => {
            const organisation = getOrganisationById(note.organisationId);
            const locationText = [organisation?.organisationName].filter(Boolean).join(' / ');
            const cleanBodyText = extractTextFromHTML(note.body || '');
            return (<button key={note.id} type="button" onClick={() => {
                    onSelectNote(note);
                    onClose();
                }} className="flex flex-col gap-1 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer" style={{
                    backgroundColor: 'var(--color-cardBg, var(--color-inputBg))',
                    borderColor: 'var(--color-borderDefault)',
                }} onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-borderActive)';
                    e.currentTarget.style.backgroundColor = 'var(--color-selectedBg, var(--color-cardBg))';
                }} onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-borderDefault)';
                    e.currentTarget.style.backgroundColor = 'var(--color-cardBg, var(--color-inputBg))';
                }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-textPrimary)' }}>
                      {note.title || 'Untitled Note'}
                    </span>
                    {locationText && (<span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--color-textMuted)' }}>
                        <LuFolder size={10}/>
                        {locationText}
                      </span>)}
                  </div>
                  {cleanBodyText && (<p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--color-textSecondary)' }}>
                      {cleanBodyText}
                    </p>)}
                </button>);
        }))}
        </div>
      </div>
    </div>, document.body);
};
export default NotePickerModal;

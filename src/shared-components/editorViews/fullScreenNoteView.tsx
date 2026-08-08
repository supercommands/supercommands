import * as React from 'react';
import { useEffect } from 'react';
import { NoteEditorView } from '../../allObjectFolder/src';
import { useUIStore } from '../uiStateManager';
import { useDbStore } from '../../storage/store/useDbStore';

interface FullScreenNoteViewProps {
  noteId?: string;
  onBack?: () => void;
}

const FullScreenNoteView: React.FC<FullScreenNoteViewProps> = ({ noteId, onBack }) => {
  const isTempNewNote = Boolean(noteId && noteId.startsWith('temp-'));

  useEffect(() => {
    useDbStore.getState().initDbSync();
  }, [isTempNewNote]);

  useEffect(() => {
    useUIStore.getState().toggleFocusMode(true);

    return () => {
      useUIStore.getState().toggleFocusMode(false);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100002] bg-[var(--color-editorBg)] overflow-hidden">
      <NoteEditorView
        noteId={isTempNewNote ? null : noteId ?? null}
        onBack={onBack}
        isFullScreenMode={true}
      />
    </div>
  );
};

export default FullScreenNoteView;

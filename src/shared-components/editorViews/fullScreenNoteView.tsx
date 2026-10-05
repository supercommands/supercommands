import * as React from 'react';
import { useEffect } from 'react';
import { NoteEditorView } from '../../allObjectFolder/src/createObject/notes';
import { useUIStore } from '../uiStateManager';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE } from '../editorContainer/functionalEditorSurfaceStyle';
interface FullScreenNoteViewProps {
    onNavigationGuardReady?: (guard: (() => Promise<boolean>) | null) => void;
    noteId?: string;
    onBack?: () => void;
}
const FullScreenNoteView: React.FC<FullScreenNoteViewProps> = ({ noteId, onBack, onNavigationGuardReady }) => {
    useEffect(() => {
        const previousFocusMode = useUIStore.getState().isFocusMode;
        useUIStore.getState().toggleFocusMode(true);
        return () => {
            useUIStore.getState().toggleFocusMode(previousFocusMode);
        };
    }, []);
    return (<div className="fixed inset-0 z-[100002] bg-[var(--color-editorBg)] overflow-hidden" style={FUNCTIONAL_EDITOR_SURFACE_STYLE}>
      <NoteEditorView noteId={noteId ?? null} onBack={onBack} onNavigationGuardReady={onNavigationGuardReady} isFullScreenMode={true} appearanceTokens={FUNCTIONAL_EDITOR_SURFACE_STYLE}/>
    </div>);
};
export default FullScreenNoteView;

import { EditorBackButton } from '../editorContainer/EditorBackButton';
import { useUIStore } from '../uiStateManager';

export function CollectionSheetBackButton() {
    const handleBackToHome = () => {
        const store = useUIStore.getState();
        store.closeEditor();
        store.returnToHome();
    };

    return <div className="flex shrink-0 justify-start 2xl:absolute 2xl:right-full 2xl:top-4 2xl:mr-3 2xl:z-10">
      <EditorBackButton onClick={handleBackToHome} label="Back to Home"/>
    </div>;
}

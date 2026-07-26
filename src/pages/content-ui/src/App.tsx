import { useEffect, useState, useCallback } from 'react';
import AutomationStatusOverlay from './components/AutomationStatusOverlay';
import { GlobalAltCPopup } from '../../../allObjectFolder/src/altcPopup/globalAltCPopup';
import { SnippetPopupIframeWindow } from './snippet-popup/SnippetPopupIframeWindow';

type CreatorType = 'createlinks' | 'createsession' | 'createnotes' | 'createsnippet' | 'createtodo';

export default function App() {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [activeCreatorType, setActiveCreatorType] = useState<CreatorType>('createnotes');

  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'tasklabs:open-create-menu') {
        if (message.creatorType) {
          setActiveCreatorType(message.creatorType);
          setIsCreatorOpen(true);
        } else {
          setIsCreateMenuOpen(true);
        }
        if (sendResponse) sendResponse({ success: true });
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handleCommandSelect = useCallback((commandId: string) => {
    console.log('[ContentUI] handleCommandSelect:', commandId);
    const dataTypes = ['createlinks', 'createsession', 'createnotes', 'createsnippet', 'createtodo'];
    if (dataTypes.includes(commandId)) {
      console.log('[ContentUI] Matching data type found. Opening creator iframe.');
      setActiveCreatorType(commandId as CreatorType);
      setIsCreatorOpen(true);
    } else {
      console.log('[ContentUI] Non-data type. Forwarding to background script.');
      // Send message to background script to execute automation/agent actions in new tab
      chrome.runtime.sendMessage({
        type: 'tasklabs:execute-create-action',
        action: commandId,
      });
    }
  }, []);

  return (
    <>
      <AutomationStatusOverlay />
      <GlobalAltCPopup
        isOpen={isCreateMenuOpen}
        onClose={() => setIsCreateMenuOpen(false)}
        onCommandSelect={handleCommandSelect}
      />
      <SnippetPopupIframeWindow
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        type={activeCreatorType}
      />
    </>
  );
}

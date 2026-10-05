import * as React from 'react';
import SpreadsheetMainContainer from '../spreadsheetUi/ui/spreadsheetMainContainer';
import { useUIStore } from '../uiStateManager';
import type { ExplorerMode } from './ExplorerModeSwitcher';
import { KnowledgeGraphView } from './KnowledgeGraphView';
interface KnowledgeExplorerViewProps {
    savedAgents?: Array<Record<string, unknown>>;
    onOrganizationSettings?: (orgId: string, orgName: string) => void;
    onBoardViewRedirect?: () => void;
}
const KnowledgeExplorerView: React.FC<KnowledgeExplorerViewProps> = props => {
    const mode = useUIStore(state => state.knowledgeExplorerMode);
    const changeMode = React.useCallback((nextMode: ExplorerMode) => {
        useUIStore.getState().setKnowledgeExplorerMode(nextMode);
    }, []);
    const closeExplorer = React.useCallback(() => {
        useUIStore.getState().setView({ type: 'home' });
    }, []);
    return (<div className="relative h-full w-full min-h-0 overflow-hidden">
      <div className={mode === 'graph' ? 'absolute inset-0' : 'hidden'}>
        <KnowledgeGraphView explorerMode={mode} onExplorerModeChange={changeMode} onClose={closeExplorer}/>
      </div>

      {mode === 'spreadsheet' && (<div className={mode === 'spreadsheet' ? 'absolute inset-0' : 'hidden'}>
          <SpreadsheetMainContainer {...props} onClose={closeExplorer} explorerMode={mode} onExplorerModeChange={changeMode}/>
        </div>)}
    </div>);
};
export default KnowledgeExplorerView;

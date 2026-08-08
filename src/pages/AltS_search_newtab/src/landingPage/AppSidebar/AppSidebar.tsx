import type * as React from 'react';
import { useUIStore, useIsLinkEditModalOpen } from '../../../../../shared-components/uiStateManager';
import { EditorItemsPanel } from './EditorItemsPanel';
import { FavoritesPanel } from '../../../../../shared-components/favorites';

interface AppSidebarProps {
  onOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: any) => void;
  searchbarRef?: React.RefObject<any>;
  reload?: () => void;
  isSidebar?: boolean;
  onCommandSelect?: (id: string) => void;
  onSelectSavedAgent?: (agent: any) => void;
  onAutomationSelect?: (automation: any) => void;
  onNavigateToListView?: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  openSpreadsheetView?: (section?: string) => void;
  hideCreatePanelItems?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = props => {
  const activeEditor = useUIStore(state => state.activeEditor);
  const isLinkEditModalOpen = useIsLinkEditModalOpen();

  let forceMode: 'links' | 'notes' | 'favorites' | 'snippets' = 'favorites';

  // We no longer force the sidebar mode based on the active editor.
  // The left sidebar will always remain in its default (favorites) state.
  // The specific lists for the open editors are instead accessible via the RightSideItemsPanel.


  // If there is an active editor OR link modal, we might want EditorItemsPanel
  // but FavoritesPanel already handles forceMode!
  // Wait, if EditorItemsPanel was added for a reason, maybe we should render both?
  // Let's just render FavoritesPanel as it was the original fully featured sidebar.

  return <FavoritesPanel {...(props as any)} searchbarRef={props.searchbarRef} forceMode={forceMode} />;
};

export default AppSidebar;

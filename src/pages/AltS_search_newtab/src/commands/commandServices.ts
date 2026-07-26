import { useUIStore } from '../../../../shared-components/uiStateManager';
import { CMDOS_DOCS_URL } from '../../../../storage/API/core/apiConfig';
import { CMDOS_DASHBOARD_URL, CMDOS_PROFILE_URL } from '../../../../storage/API/core/api';
import type { CommandContext } from '../../../../shared-components/commands';
export function getCommandServices(
  state: any,
  baseServices: {
    toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    navigation: (view: any) => void;
    reload: () => void;
  },
): CommandContext['services'] {
  return {
    ...baseServices,

    // UI state actions
    clearDraftAutomation: () => useUIStore.getState().clearDraftAutomation(),
    navigateToView: (view: any) => useUIStore.getState().setView(view),
    setPendingAgent: (agent: any) => useUIStore.getState().setPendingAgent(agent),
    setSelectedWorkspace: (workspace: any) =>
      useUIStore.getState().setSelectedWorkspaceId(workspace?.workspace_id ?? workspace?.id ?? null),
    setSelectedFolder: (folder: any) =>
      useUIStore.getState().setSelectedFolderId(folder?.folder_id ?? folder?.id ?? null),
    setSelectedSnippet: (snippet: any) =>
      useUIStore.getState().setSelectedSnippetId(snippet?.id ?? snippet?.snippet_id ?? null),

    setIsAutoExpandMode: (isAutoExpand: boolean) => useUIStore.getState().setIsAutoExpandMode(isAutoExpand),

    // Data actions

    // URLs
    urls: {
      dashboard: CMDOS_DASHBOARD_URL,
      docs: CMDOS_DOCS_URL,
      profile: CMDOS_PROFILE_URL,
    },
  };
}

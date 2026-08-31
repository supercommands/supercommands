export interface WorkspaceData {
  id: string;
  workspaceName: string;
  createdAt: number;
  updatedAt: number;
}

export const WORKSPACE_COMPARISON_FIELDS = ['id', 'workspaceName'] as const satisfies readonly (keyof WorkspaceData)[];

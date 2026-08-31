export interface FolderData {
  id: string;
  workspaceId: string;
  folderName: string;
  createdAt: number;
  updatedAt: number;
}

export const FOLDER_COMPARISON_FIELDS = ['id', 'workspaceId', 'folderName'] as const satisfies readonly (keyof FolderData)[];

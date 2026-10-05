import type { LinkItem } from '../links/linkTypes';
import type { SessionOpenSettings } from './sessionSettings';

export interface WorkspaceRecord {
  id: string;
  organisationId: string;
  workspaceName: string;
  urls: LinkItem[];
  workspaceOpenSettings: SessionOpenSettings;
  createdAt: number;
  updatedAt: number;
}
export interface CreateWorkspaceInput {
  id?: string;
  organisationId?: string;
  workspaceName: string;
  urls?: LinkItem[];
  workspaceOpenSettings?: Partial<SessionOpenSettings>;
}
export type UpdateWorkspaceInput = Partial<Omit<WorkspaceRecord, 'id' | 'createdAt'>> & {expectedUpdatedAt?: number};
export const WORKSPACE_COMPARISON_FIELDS = ['id', 'organisationId', 'workspaceName', 'urls', 'workspaceOpenSettings'] as const;

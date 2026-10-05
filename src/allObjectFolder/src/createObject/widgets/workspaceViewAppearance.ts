import { db } from '../../../../storage/indexDB/dbConfig';

const appearanceKey = (workspaceId: string) => `workspace-view-appearance:${workspaceId}`;
export type WorkspaceViewAppearance = { viewIconId?: string; isCustomIconSelected?: boolean };

/** Sidebar presentation belongs in metadata, outside the minimal Workspace record. */
export async function saveWorkspaceViewAppearance(workspaceId: string, options?: WorkspaceViewAppearance): Promise<void> {
  if (!options || (options.viewIconId === undefined && options.isCustomIconSelected === undefined)) return;
  await db.transaction('rw', [db.workspaces, db.migrationMetadata], async () => {
    if (!await db.workspaces.get(workspaceId)) throw new Error('This Workspace no longer exists.');
    await db.migrationMetadata.put({
      id: appearanceKey(workspaceId), idMap: {}, viewIconId: options.viewIconId,
      isCustomIconSelected: options.isCustomIconSelected,
    } as any);
  });
}

export async function getWorkspaceViewAppearances(workspaceIds: string[]): Promise<Map<string, WorkspaceViewAppearance>> {
  const rows = await db.migrationMetadata.bulkGet(workspaceIds.map(appearanceKey));
  return new Map(rows.flatMap((row, index) => row
    ? [[workspaceIds[index], {viewIconId: (row as any).viewIconId, isCustomIconSelected: (row as any).isCustomIconSelected}] as const]
    : []));
}

export async function deleteWorkspaceViewAppearance(workspaceId: string): Promise<void> {
  await db.migrationMetadata.delete(appearanceKey(workspaceId));
}

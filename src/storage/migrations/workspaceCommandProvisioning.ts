import Dexie from 'dexie';
import { getRoleTemplates } from '../../welcomeGuide/DashboardviewTemplates';
import type { ShortcutAssignmentCheck } from '../../shared-components/shortcuts/core/shortcutAssignmentTypes';

/** One attempt per provisioned organisation, including intentionally empty/conflicting defaults. */
export async function provisionWorkspaceCommands(database: any,
  check: (value: string, referenceId: string) => Promise<ShortcutAssignmentCheck>,
  save: (referenceId: string, value: string, type: 'collection') => Promise<unknown>,
  organisationId: string, role = 'founder', overrides?: Record<string, string>) {
  const key = `workspace-default-commands-v1:${organisationId}`;
  if (await database.migrationMetadata.get(key)) return;
  // Seed prefix settings before entering the transaction. The guarded writer rechecks owners.
  await check('main', 'workspace-default-command-provisioning');
  const tables = ['workspaces', 'migrationMetadata', 'userShortcuts', 'commands', 'prefixSettings',
    'notes', 'links', 'snippets', 'todos', 'aiPrompts', 'chatAgents'].map(name => database.table(name));
  await database.transaction('rw', tables, async () => {
    if (await database.migrationMetadata.get(key)) return;
    const provisioned = await database.migrationMetadata.get(`workspace-provisioning:${organisationId}`);
    if (!provisioned) return;
    const skipped: string[] = [];
    for (const template of getRoleTemplates(role as any)) {
      const id = provisioned.templateIds?.[template.id];
      if (!id || !await database.workspaces.get(id)) continue;
      const rows = await database.userShortcuts.toArray();
      if (rows.some((row: any) => row.referenceId === id || row.referenceId?.endsWith(`-${id}`))) continue;
      // An explicit empty value disables the default; absence uses the original template command.
      const value = (overrides?.[template.id] ?? template.defaultShortcut).trim().toLowerCase();
      if (!value) continue;
      if ((await Dexie.waitFor(check(value, id))).status !== 'available') { skipped.push(id); continue; }
      await Dexie.waitFor(save(id, value, 'collection'));
    }
    await database.migrationMetadata.put({id: key, idMap: {}, completed: true, skipped} as any);
  });
}

/** Repair only profiles with recorded migration provenance; never manufacture Workspaces. */
export async function repairMigratedWorkspaceCommands(database: any,
  check: Parameters<typeof provisionWorkspaceCommands>[1], save: Parameters<typeof provisionWorkspaceCommands>[2]) {
  if (!await database.migrationMetadata.get('workspace-platform-v32')) return;
  for (const organisation of await database.organisations.toArray()) {
    await provisionWorkspaceCommands(database, check, save, organisation.id);
  }
}

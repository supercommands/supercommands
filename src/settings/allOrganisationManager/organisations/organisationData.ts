import { generateEntityId } from '../../../shared-components/utils';
import type { OrganisationData } from './organisationTypes';
import { db } from '../../../storage/indexDB/dbConfig';
import { cleanupReleasedCollectionAssets } from '../../../allObjectFolder/src/createObject/collections/collectionData';
import { deleteWebCollectionAssignments } from '../../../allObjectFolder/src/createObject/collections/collectionAssignmentData';
/**
 * Creates a new Workspace and saves it to the local Dexie store.
 */
export async function createOrganisation(name: string): Promise<OrganisationData> {
    try {
        const newOrganisation = {
            id: generateEntityId('organisation'),
            organisationName: name,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        // Save to Dexie store
        await db.organisations.put(newOrganisation);
        return newOrganisation;
    }
    catch (error: any) {
        console.error('[organisationData.createOrganisation] Error:', error);
        throw new Error(error?.message || 'An error occurred while creating organisation.');
    }
}
/**
 * Retrieves all Workspaces from the local Dexie store.
 */
export async function getAllOrganisations(): Promise<OrganisationData[]> {
    try {
        // Returns all workspaces sorted by updatedAt (descending so newest is first)
        return await db.organisations.orderBy('updatedAt').reverse().toArray();
    }
    catch (error: any) {
        console.error('[organisationData.getAllOrganisations] Error:', error);
        return [];
    }
}
/**
 * Retrieves a single Workspace by its ID.
 */
export async function getOrganisation(id: string): Promise<OrganisationData | undefined> {
    try {
        return await db.organisations.get(id);
    }
    catch (error: any) {
        console.error(`[organisationData.getOrganisation] Error for id ${id}:`, error);
        return undefined;
    }
}
/**
 * Updates an existing Workspace with partial data.
 */
export async function updateOrganisation(id: string, updates: Partial<OrganisationData>): Promise<void> {
    try {
        const changes = {
            ...updates,
            updatedAt: Date.now() // Always bump updatedAt when a change is made
        };
        await db.organisations.update(id, changes);
    }
    catch (error: any) {
        console.error(`[organisationData.updateOrganisation] Error for id ${id}:`, error);
        throw new Error('An error occurred while updating organisation.');
    }
}
/**
 * Deletes a Workspace and all its associated items (cascade delete) from the local Dexie store.
 */
export async function deleteOrganisation(id: string): Promise<void> {
    try {
        await db.transaction('rw', db.tables, async () => {
          const collections = await db.collections.where('organisationId').equals(id).toArray();
          await deleteWebCollectionAssignments(collections.map(collection => collection.id));
          await Promise.all([
            db.collections.where('organisationId').equals(id).delete(),
            db.collectionItems.where('organisationId').equals(id).delete(),
            db.collectionElementSnapshots.where('organisationId').equals(id).delete(),
            db.notes.where({ organisationId: id }).delete(),
            db.links.where({ organisationId: id }).delete(),
            db.snippets.where({ organisationId: id }).delete(),
            db.chatAgents.where({ organisationId: id }).delete(),
            db.aiPrompts.where({ organisationId: id }).delete(),
            db.widgetDashboards.where({ organisationId: id }).delete(),
            db.widgets.where({ organisationId: id }).delete(),
            db.widgetLayouts.where({ organisationId: id }).delete(),
            db.workspaces.where({ organisationId: id }).delete(),
            db.organisations.delete(id)
          ]);
        });
        await cleanupReleasedCollectionAssets();
    }
    catch (error: any) {
        console.error(`[organisationData.deleteOrganisation] Error for id ${id}:`, error);
        throw new Error('An error occurred while deleting organisation.');
    }
}

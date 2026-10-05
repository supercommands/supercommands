import { db } from '../indexDB/dbConfig';
import type { OrganisationData } from '../../settings/allOrganisationManager/organisations/organisationTypes';
import { StorageManager } from './storageManager';
export const LAST_USED_ORGANISATION_KEY = 'lastUsedOrganisationId';
/**
 * Saves the given workspace ID using StorageManager.
 */
export const setLastUsedOrganisationId = async (organisationId: string): Promise<void> => {
    await StorageManager.setItem(LAST_USED_ORGANISATION_KEY, organisationId);
};
/**
 * Smartly retrieves the best workspace to use for new notes.
 * 1. Tries to get the last explicitly used workspace from local storage for maximum speed.
 * 2. If it doesn't exist, queries Dexie for the most recently updated workspace.
 * 3. Returns the WorkspaceData object.
 */
export async function getSmartDefaultOrganisation(): Promise<OrganisationData | undefined> {
    try {
        await db.open();
        let lastUsedId = await StorageManager.getItem(LAST_USED_ORGANISATION_KEY);
        // If we have a saved ID, quickly grab it from Dexie
        if (lastUsedId) {
            const organisation = await db.organisations.get(lastUsedId);
            if (organisation)
                return organisation;
        }
        // 2. FALLBACK LOOKUP
        // If no saved ID (or the saved workspace was deleted),
        // grab the most recently updated workspace from Dexie.
        const allOrganisations = await db.organisations.orderBy('updatedAt').reverse().toArray();
        if (allOrganisations.length > 0) {
            const fallbackOrganisation = allOrganisations[0];
            // Automatically cache it so we don't have to query the full list next time
            await setLastUsedOrganisationId(fallbackOrganisation.id);
            return fallbackOrganisation;
        }
        // No workspaces exist at all
        return undefined;
    }
    catch (error) {
        console.error('[lastUsedOrganisation] Error fetching smart default workspace:', error);
        return undefined;
    }
}

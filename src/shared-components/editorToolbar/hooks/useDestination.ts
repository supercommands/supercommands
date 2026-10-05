import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../storage/indexDB/dbConfig';
import type { OrganisationData } from '../../../settings/allOrganisationManager/organisations/organisationTypes';
export interface DestinationGroup { organisation: OrganisationData; }
export function useDestination() {
  const destinations = useLiveQuery(async () => {
    const organisations = await db.organisations.orderBy('updatedAt').reverse().toArray();
    return organisations.map(organisation => ({organisation}));
  }, [], []);
  return {destinations: destinations || []};
}

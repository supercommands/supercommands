import type { OrganisationData } from '../settings/allOrganisationManager/organisations/organisationTypes';
export type OrganisationIconType = 'lock' | 'globe' | 'users' | 'personal';
export interface PathDetails { iconType: OrganisationIconType; pathText: string; }
export const getDestinationPathDetails = (organisations: OrganisationData[] | null, organisationId: string | null): PathDetails => ({
  iconType: 'lock',
  pathText: organisations?.find(organisation => organisation.id === organisationId)?.organisationName || 'Select Destination',
});
export const formatSaveDestinationPath = (organisations: OrganisationData[] | null, organisationId: string | null): string => getDestinationPathDetails(organisations, organisationId).pathText;

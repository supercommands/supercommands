export interface OrganisationData {
    id: string;
    organisationName: string;
    createdAt: number;
    updatedAt: number;
}
export const ORGANISATION_COMPARISON_FIELDS = ['id', 'organisationName'] as const satisfies readonly (keyof OrganisationData)[];

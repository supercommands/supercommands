export const getDefaultSettingsView = (): {
    type: 'settings';
    section?: 'usage' | 'appearance' | 'searchView' | 'todoSettings' | 'allOrganisations' | 'organisationSettings' | 'generalSettings' | 'googleDriveBackup';
} => {
    return { type: 'settings', section: 'appearance' };
};

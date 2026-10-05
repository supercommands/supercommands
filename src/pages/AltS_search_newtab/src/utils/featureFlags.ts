/**
 * Optional Google Drive backup integration flag.
 */
export const FEATURE_FLAGS = {
    // Google Drive Backup — disabled by default; set VITE_ENABLE_GOOGLE_DRIVE_BACKUP=true in .env to enable
    ENABLE_GOOGLE_DRIVE_BACKUP: (import.meta as any).env?.VITE_ENABLE_GOOGLE_DRIVE_BACKUP === 'true',
};

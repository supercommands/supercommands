import { db } from '../indexDB/dbConfig';
import { StorageManager } from './storageManager';
import { BRAND } from '../../shared-components/brandingConfig';
const TUTORIAL_WATCHED_KEY = 'tutorial_watched';
const ONBOARDING_CORE_SETUP_COMPLETED_KEY = BRAND.storageKeys.onboardingCoreSetupCompleted;
const LEGACY_ONBOARDING_CORE_SETUP_COMPLETED_KEY = BRAND.legacyStorageKeys.onboardingCoreSetupCompleted;
const ONBOARDING_COMPLETED_HINT_KEY = BRAND.storageKeys.onboardingCompletedHint;
const LEGACY_ONBOARDING_COMPLETED_HINT_KEY = BRAND.legacyStorageKeys.onboardingCompletedHint;
export function hasOnboardingCompletedHint(): boolean {
    try {
        if (typeof window === 'undefined')
            return false;
        return (window.localStorage.getItem(ONBOARDING_COMPLETED_HINT_KEY) === 'true' ||
            window.localStorage.getItem(LEGACY_ONBOARDING_COMPLETED_HINT_KEY) === 'true');
    }
    catch {
        return false;
    }
}
export function setOnboardingCompletedHint(completed: boolean): void {
    try {
        if (typeof window === 'undefined')
            return;
        if (completed) {
            window.localStorage.setItem(ONBOARDING_COMPLETED_HINT_KEY, 'true');
            return;
        }
        window.localStorage.removeItem(ONBOARDING_COMPLETED_HINT_KEY);
        window.localStorage.removeItem(LEGACY_ONBOARDING_COMPLETED_HINT_KEY);
    }
    catch {
        // localStorage can be unavailable in restricted contexts; the async source of truth still works.
    }
}
export async function markOnboardingCoreSetupCompleted(organisationId?: string | null): Promise<void> {
    const completedAt = Date.now();
    await StorageManager.setItem(ONBOARDING_CORE_SETUP_COMPLETED_KEY, {
        completed: true,
        organisationId: organisationId,
        completedAt,
    });
    setOnboardingCompletedHint(true);
}
/**
 * Checks if the onboarding is completed.
 * Onboarding is completed if:
 * 1. Card 2 has already created the workspace and installed onboarding views, or the tutorial was closed.
 * 2. At least one workspace exists in IndexedDB (db.workspaces).
 */
export async function isOnboardingCompleted(): Promise<boolean> {
    try {
        const data = await StorageManager.getItem([
            TUTORIAL_WATCHED_KEY,
            ONBOARDING_CORE_SETUP_COMPLETED_KEY,
            LEGACY_ONBOARDING_CORE_SETUP_COMPLETED_KEY
        ]);
        const tutorialWatched = !!data?.[TUTORIAL_WATCHED_KEY];
        const coreSetupCompleted = !!data?.[ONBOARDING_CORE_SETUP_COMPLETED_KEY]?.completed ||
            !!data?.[LEGACY_ONBOARDING_CORE_SETUP_COMPLETED_KEY]?.completed;
        if (tutorialWatched || coreSetupCompleted) {
            const organisationsCount = await db.organisations.count();
            const completed = organisationsCount > 0;
            setOnboardingCompletedHint(completed);
            return completed;
        }
        const organisationsCount = await db.organisations.count();
        if (organisationsCount === 0) {
            setOnboardingCompletedHint(false);
            return false;
        }
        const onboardingView = await db.migrationMetadata.filter(row => row.id.startsWith('workspace-provisioning:')).first();
        const completed = !!onboardingView;
        if (completed) {
            await markOnboardingCoreSetupCompleted(onboardingView.organisationId);
        }
        setOnboardingCompletedHint(completed);
        return completed;
    }
    catch (error) {
        console.error('[onboardingStorage] Error checking onboarding status:', error);
        setOnboardingCompletedHint(false);
        return false;
    }
}

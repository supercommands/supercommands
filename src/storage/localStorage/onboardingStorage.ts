import { db } from '../indexDB/dbConfig';
import { StorageManager } from './storageManager';

const TUTORIAL_WATCHED_KEY = 'tutorial_watched';
const ONBOARDING_CORE_SETUP_COMPLETED_KEY = 'cmdos_onboarding_core_setup_completed';
const ONBOARDING_COMPLETED_HINT_KEY = 'cmdos_onboarding_completed_hint';

export function hasOnboardingCompletedHint(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDING_COMPLETED_HINT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompletedHint(completed: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (completed) {
      window.localStorage.setItem(ONBOARDING_COMPLETED_HINT_KEY, 'true');
      return;
    }
    window.localStorage.removeItem(ONBOARDING_COMPLETED_HINT_KEY);
  } catch {
    // localStorage can be unavailable in restricted contexts; the async source of truth still works.
  }
}

export async function markOnboardingCoreSetupCompleted(workspaceId?: string | null): Promise<void> {
  const completedAt = Date.now();

  await StorageManager.setItem(ONBOARDING_CORE_SETUP_COMPLETED_KEY, {
    completed: true,
    workspaceId: workspaceId || null,
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
    const data = await StorageManager.getItem([TUTORIAL_WATCHED_KEY, ONBOARDING_CORE_SETUP_COMPLETED_KEY]);
    const tutorialWatched = !!data?.[TUTORIAL_WATCHED_KEY];
    const coreSetupCompleted = !!data?.[ONBOARDING_CORE_SETUP_COMPLETED_KEY]?.completed;

    if (tutorialWatched || coreSetupCompleted) {
      const workspacesCount = await db.workspaces.count();
      const completed = workspacesCount > 0;

      setOnboardingCompletedHint(completed);
      return completed;
    }

    const workspacesCount = await db.workspaces.count();
    if (workspacesCount === 0) {
      setOnboardingCompletedHint(false);
      return false;
    }

    const onboardingView = await db.widgetViews
      .filter(view => view.settings?.source === 'onboarding')
      .first();
    const completed = !!onboardingView;

    if (completed) {
      await markOnboardingCoreSetupCompleted(onboardingView.workspaceId);
    }

    setOnboardingCompletedHint(completed);
    return completed;
  } catch (error) {
    console.error('[onboardingStorage] Error checking onboarding status:', error);
    setOnboardingCompletedHint(false);
    return false;
  }
}

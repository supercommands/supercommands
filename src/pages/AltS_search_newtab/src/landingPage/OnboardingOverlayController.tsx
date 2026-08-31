import type * as React from 'react';
import { useCallback } from 'react';
import OnboardingCards from '../../../../welcomeGuide/OnboardingCards';
import { setOnboardingCompletedHint } from '../../../../storage/localStorage/onboardingStorage';

interface OnboardingOverlayControllerProps {
  show: boolean;
  isLoggedIn: boolean;
  onboardingCompleted: boolean;
  onClose: () => void;
  onMarkCompleted: () => void;
  reload: () => void;
}

export const OnboardingOverlayController: React.FC<OnboardingOverlayControllerProps> = ({
  show,
  isLoggedIn,
  onboardingCompleted,
  onClose,
  onMarkCompleted,
  reload,
}) => {
  const handleClose = useCallback(async () => {
    onClose();

    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
      chromeAny.storage.local.set({ tutorial_watched: true });
    }

    setOnboardingCompletedHint(true);
    onMarkCompleted();
    await (reload() as any);

    try {
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('user_fav_sync_trigger', (res: any) => {
          const val = res.user_fav_sync_trigger || 0;
          chromeAny.storage.local.set({ user_fav_sync_trigger: val + 1 });
        });
      }
    } catch (error) {
      console.error('[OnboardingOverlayController] Failed to trigger favorites sync:', error);
    }
  }, [onClose, onMarkCompleted, reload]);

  if (!show) return null;

  return (
    <OnboardingCards
      onClose={handleClose}
      isLoggedIn={isLoggedIn}
      isReturningUser={onboardingCompleted}
      initialStep={onboardingCompleted ? 'presentation' : 'dashboard_views'}
    />
  );
};

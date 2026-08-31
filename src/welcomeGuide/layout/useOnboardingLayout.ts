import * as React from 'react';

import {
  getOnboardingDashboardViewsLayout,
  getOnboardingThemeLayout,
  type OnboardingDashboardViewsLayout,
  type OnboardingThemeLayout,
  type OnboardingViewport,
} from './onboardingLayoutSchema';

const DEFAULT_ONBOARDING_VIEWPORT: OnboardingViewport = {
  width: 1366,
  height: 900,
};

const readOnboardingViewport = (): OnboardingViewport => {
  if (typeof window === 'undefined') return DEFAULT_ONBOARDING_VIEWPORT;

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const readElementViewport = (element: HTMLElement | null): OnboardingViewport => {
  if (!element) return readOnboardingViewport();

  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width || readOnboardingViewport().width),
    height: Math.round(rect.height || readOnboardingViewport().height),
  };
};

export const useOnboardingViewport = (
  targetRef?: React.RefObject<HTMLElement | null>,
): OnboardingViewport => {
  const [viewport, setViewport] = React.useState<OnboardingViewport>(() =>
    readElementViewport(targetRef?.current ?? null),
  );
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const updateViewport = () => {
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setViewport(readElementViewport(targetRef?.current ?? null));
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);

    const observedElement = targetRef?.current ?? null;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && observedElement
        ? new ResizeObserver(updateViewport)
        : null;

    if (resizeObserver && observedElement) {
      resizeObserver.observe(observedElement);
    }

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      resizeObserver?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [targetRef]);

  return viewport;
};

export const useOnboardingDashboardViewsLayout = (
  targetRef?: React.RefObject<HTMLElement | null>,
): OnboardingDashboardViewsLayout => {
  const viewport = useOnboardingViewport(targetRef);

  return React.useMemo(() => getOnboardingDashboardViewsLayout(viewport), [viewport]);
};

export const useOnboardingThemeLayout = (
  targetRef?: React.RefObject<HTMLElement | null>,
): OnboardingThemeLayout => {
  const viewport = useOnboardingViewport(targetRef);

  return React.useMemo(() => getOnboardingThemeLayout(viewport), [viewport]);
};

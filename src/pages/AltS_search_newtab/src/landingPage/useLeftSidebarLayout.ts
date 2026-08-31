import * as React from 'react';

export type SidebarWidthMode = 'belowMinimum' | 'minimumDesktop' | 'intermediateDesktop' | 'standardDesktop' | 'wideDesktop';

export interface SidebarViewport {
  width: number;
  height: number;
}

const DEFAULT_VIEWPORT: SidebarViewport = {
  width: 1366,
  height: 900,
};

const BREAKPOINTS = {
  minimumDesktop: 1200,
  standardDesktop: 1366,
  intermediateDesktop: 1500,
  wideDesktop: 1600,
};

const getViewport = (): SidebarViewport => {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT;
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

export const getSidebarWidthMode = (width: number): SidebarWidthMode => {
  if (width < BREAKPOINTS.minimumDesktop) return 'belowMinimum';
  if (width < BREAKPOINTS.standardDesktop) return 'minimumDesktop';
  if (width < BREAKPOINTS.intermediateDesktop) return 'intermediateDesktop';
  if (width < BREAKPOINTS.wideDesktop) return 'standardDesktop';
  return 'wideDesktop';
};

export const useLeftSidebarLayout = () => {
  const [viewport, setViewport] = React.useState<SidebarViewport>(getViewport);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const updateViewport = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setViewport(getViewport());
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  const widthMode = getSidebarWidthMode(viewport.width);
  
  let width = 280;
  if (widthMode === 'minimumDesktop') {
    width = 220;
  } else if (widthMode === 'belowMinimum') {
    width = 180;
  }

  return {
    widthMode,
    width,
  };
};

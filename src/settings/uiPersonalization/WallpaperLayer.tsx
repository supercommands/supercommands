import * as React from 'react';
import { useId } from 'react';
import { useAppearance } from '@extension/ui';

/**
 * Shared scattered-dot/star overlay for all dark themes.
 * Uses a unique pattern ID (via useId) to prevent SVG pattern ID collisions
 * if this component is ever mounted in multiple locations simultaneously.
 */
const ScatteredDotsPattern: React.FC = () => {
  const uid = useId().replace(/:/g, '_');
  const patternId = `scattered-dots-tile-${uid}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-60"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width="720" height="720" patternUnits="userSpaceOnUse">
          {/* Sparse, small, low-opacity dots — decorative only */}
          <circle cx="85"  cy="92"  r="1.1" fill="#FFFFFF" opacity="0.22" />
          <circle cx="270" cy="48"  r="1.5" fill="#E2F1FF" opacity="0.52" />
          <circle cx="490" cy="140" r="0.8" fill="#FFFFFF" opacity="0.18" />
          <circle cx="630" cy="75"  r="1.3" fill="#FFFFFF" opacity="0.38" />
          <circle cx="160" cy="310" r="1.0" fill="#E2F1FF" opacity="0.26" />
          <circle cx="380" cy="275" r="1.6" fill="#FFFFFF" opacity="0.55" />
          <circle cx="560" cy="390" r="0.9" fill="#FFFFFF" opacity="0.22" />
          <circle cx="95"  cy="520" r="1.4" fill="#FFFFFF" opacity="0.34" />
          <circle cx="310" cy="460" r="0.7" fill="#E2F1FF" opacity="0.16" />
          <circle cx="460" cy="580" r="1.2" fill="#FFFFFF" opacity="0.28" />
          <circle cx="680" cy="490" r="1.0" fill="#FFFFFF" opacity="0.22" />
          <circle cx="220" cy="650" r="1.3" fill="#E2F1FF" opacity="0.40" />
          <circle cx="410" cy="690" r="0.9" fill="#FFFFFF" opacity="0.18" />
          <circle cx="610" cy="630" r="1.5" fill="#FFFFFF" opacity="0.48" />
          <circle cx="340" cy="180" r="0.8" fill="#FFFFFF" opacity="0.20" />
          <circle cx="555" cy="245" r="1.1" fill="#E2F1FF" opacity="0.30" />
          <circle cx="700" cy="340" r="0.9" fill="#FFFFFF" opacity="0.16" />
          <circle cx="40"  cy="410" r="1.0" fill="#E2F1FF" opacity="0.24" />
          <circle cx="145" cy="600" r="0.7" fill="#FFFFFF" opacity="0.18" />
          <circle cx="540" cy="540" r="1.2" fill="#FFFFFF" opacity="0.26" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

const WallpaperLayer: React.FC = () => {
  const { theme, wallpaperId } = useAppearance();

  const wallpaper = theme?.wallpaper;
  const bgGradient = theme?.tokens?.backgroundGradient;
  // Render dots only when the selected theme profile explicitly requests them
  const hasScatteredDots = theme?.isDark === true && theme?.pattern === 'scattered-dots';

  if (!wallpaper || !wallpaper.src) {
    if (bgGradient || hasScatteredDots) {
      return (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000"
          style={{
            background: bgGradient || 'transparent',
          }}
        >
          {hasScatteredDots && <ScatteredDotsPattern />}
        </div>
      );
    }
    return null;
  }

  // Strip leading slash if present for chrome.runtime.getURL
  const isCustom = wallpaperId === 'custom';
  // Normalize legacy filename mismatch: 'Car Race.png' was renamed to 'car-race.png' on disk
  const normalizedSrc = wallpaper.src.replace('Car Race.png', 'car-race.png');
  const srcPath = !isCustom && normalizedSrc.startsWith('/') ? normalizedSrc.slice(1) : normalizedSrc;
  const resolvedUrl = isCustom
    ? wallpaper.src
    : (typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL(srcPath)
        : normalizedSrc);

  const blurFilter = wallpaper.blur ? `blur(${wallpaper.blur})` : '';
  const combinedFilter = blurFilter || 'none';

  return (
    <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${resolvedUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: wallpaper.opacity ?? 0.15,
          mixBlendMode: (wallpaper.blendMode as any) || 'normal',
          filter: combinedFilter,
        }}
      />
    </div>
  );
};

export default WallpaperLayer;

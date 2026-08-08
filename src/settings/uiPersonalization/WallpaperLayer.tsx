import * as React from 'react';
import { useAppearance } from '@extension/ui';

const StarPattern: React.FC = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-60"
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: 'absolute', width: '100%', height: '100%' }}
    aria-hidden="true"
  >
    <defs>
      <pattern id="star-pattern-tile" width="720" height="720" patternUnits="userSpaceOnUse">
        <circle cx="85" cy="92" r="1.1" fill="#FFFFFF" opacity="0.22" />
        <circle cx="270" cy="48" r="1.5" fill="#E2F1FF" opacity="0.58" />
        <circle cx="490" cy="140" r="0.8" fill="#FFFFFF" opacity="0.18" />
        <circle cx="630" cy="75" r="1.3" fill="#FFFFFF" opacity="0.42" />
        <circle cx="160" cy="310" r="1.0" fill="#E2F1FF" opacity="0.28" />
        <circle cx="380" cy="275" r="1.6" fill="#FFFFFF" opacity="0.60" />
        <circle cx="560" cy="390" r="0.9" fill="#FFFFFF" opacity="0.25" />
        <circle cx="95" cy="520" r="1.4" fill="#FFFFFF" opacity="0.38" />
        <circle cx="310" cy="460" r="0.7" fill="#E2F1FF" opacity="0.16" />
        <circle cx="460" cy="580" r="1.2" fill="#FFFFFF" opacity="0.30" />
        <circle cx="680" cy="490" r="1.0" fill="#FFFFFF" opacity="0.24" />
        <circle cx="220" cy="650" r="1.3" fill="#E2F1FF" opacity="0.45" />
        <circle cx="410" cy="690" r="0.9" fill="#FFFFFF" opacity="0.20" />
        <circle cx="610" cy="630" r="1.5" fill="#FFFFFF" opacity="0.55" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#star-pattern-tile)" />
  </svg>
);

const MoonlitOceanStarPattern: React.FC = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-65"
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: 'absolute', width: '100%', height: '100%' }}
    aria-hidden="true"
  >
    <defs>
      <pattern id="moonlit-ocean-star-tile" width="800" height="800" patternUnits="userSpaceOnUse">
        <circle cx="110" cy="45" r="1.2" fill="#F4F7FA" opacity="0.38" />
        <circle cx="280" cy="80" r="0.8" fill="#E5EDF7" opacity="0.28" />
        <circle cx="450" cy="30" r="1.3" fill="#FFFFFF" opacity="0.42" />
        <circle cx="620" cy="65" r="0.7" fill="#FFFFFF" opacity="0.24" />
        <circle cx="730" cy="110" r="1.0" fill="#F4F7FA" opacity="0.32" />
        <circle cx="190" cy="160" r="0.6" fill="#FFFFFF" opacity="0.20" />
        <circle cx="370" cy="130" r="1.1" fill="#E5EDF7" opacity="0.36" />
        <circle cx="530" cy="190" r="0.9" fill="#F4F7FA" opacity="0.26" />
        <circle cx="670" cy="220" r="0.7" fill="#FFFFFF" opacity="0.16" />
        <circle cx="85" cy="270" r="1.0" fill="#E5EDF7" opacity="0.30" />
        <circle cx="310" cy="240" r="0.6" fill="#F4F7FA" opacity="0.16" />
        <circle cx="490" cy="310" r="1.2" fill="#FFFFFF" opacity="0.38" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#moonlit-ocean-star-tile)" />
  </svg>
);

const WallpaperLayer: React.FC = () => {
  const { theme, wallpaperId } = useAppearance();

  const wallpaper = theme?.wallpaper;
  const bgGradient = theme?.tokens?.backgroundGradient;
  const isMidnightStars = theme?.pattern === 'midnight-stars';
  const isMoonlitOcean = theme?.pattern === 'moonlit-ocean-stars';

  if (!wallpaper || !wallpaper.src) {
    if (bgGradient || isMidnightStars || isMoonlitOcean) {
      return (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000"
          style={{
            background: bgGradient || 'transparent',
          }}
        >
          {isMidnightStars && <StarPattern />}
          {isMoonlitOcean && <MoonlitOceanStarPattern />}
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
          filter: wallpaper.blur ? `blur(${wallpaper.blur})` : 'none',
        }}
      />
    </div>
  );
};

export default WallpaperLayer;


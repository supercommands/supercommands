import React from 'react';
import { useAppearance } from '@extension/ui';

const WallpaperLayer: React.FC = () => {
  const { theme, wallpaperId } = useAppearance();

  const wallpaper = theme?.wallpaper;
  

  if (!wallpaper || !wallpaper.src) {
    
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
    <div
      className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000"
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
  );
};

export default WallpaperLayer;

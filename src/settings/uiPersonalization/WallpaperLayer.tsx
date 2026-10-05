import * as React from 'react';
import ScatteredDotsPattern from './ScatteredDotsPattern';
import { useAppearance } from '@extension/ui';
const WallpaperLayer: React.FC = () => {
    const { theme, wallpaperId } = useAppearance();
    const wallpaper = theme?.wallpaper;
    const bgGradient = theme?.tokens?.backgroundGradient;
    // Render dots only when the selected theme profile explicitly requests them
    const hasScatteredDots = theme?.isDark === true && theme?.pattern === 'scattered-dots';
    if (!wallpaper || !wallpaper.src) {
        if (bgGradient || hasScatteredDots) {
            return (<div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000" style={{
                    background: bgGradient || 'transparent',
                }}>
          {hasScatteredDots && <ScatteredDotsPattern />}
        </div>);
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
    return (<div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000">
      <div className="absolute inset-0" style={{
            backgroundImage: `url('${resolvedUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: wallpaper.opacity ?? 0.15,
            mixBlendMode: (wallpaper.blendMode as any) || 'normal',
            filter: combinedFilter,
        }}/>
    </div>);
};
export default WallpaperLayer;

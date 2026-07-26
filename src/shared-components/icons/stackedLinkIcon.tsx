import React from 'react';
import { FaLink, FaLayerGroup } from 'react-icons/fa';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';

export interface StackedLinkIconProps {
  urls?: string[];
  size?: number;
  className?: string;
  maxIcons?: number;
  fallback?: 'link' | 'tabgroup' | 'session';
}

/**
 * Renders a stack of favicons for a list of URLs.
 * Used for Sessions and Link snippets.
 */
export const StackedLinkIcon: React.FC<StackedLinkIconProps> = ({
  urls = [],
  size = 16,
  className = '',
  maxIcons = 3,
  fallback = 'session',
}) => {
  if (!urls || urls.length === 0) {
    if (fallback === 'tabgroup' || fallback === 'session') {
      return <FaLayerGroup size={size} className={`text-[var(--color-iconDefault)] ${className}`} />;
    }
    return <FaLink size={size} className={`text-[var(--color-iconDefault)] ${className}`} />;
  }

  // Single URL - just show one favicon
  if (urls.length === 1) {
    return (
      <img
        src={getFaviconUrl(urls[0])}
        alt=""
        className={`shrink-0 object-contain rounded-sm ${className}`}
        style={{ width: size, height: size }}
        onError={e => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // Multiple URLs - Stacked layout
  const visibleUrls = urls.slice(0, maxIcons);
  const offset = size * 0.4; // 50% overlap - each icon shows half

  return (
    <div
      className={`relative flex items-center ${className}`}
      style={{
        width: size + (visibleUrls.length - 1) * offset,
        height: size,
      }}>
      {visibleUrls.map((url, index) => (
        <div
          key={`${url}-${index}`}
          className="absolute rounded-full bg-white ring-1 ring-white dark:ring-neutral-800 overflow-hidden shadow-sm flex items-center justify-center transition-transform hover:z-10"
          style={{
            width: size,
            height: size,
            left: index * offset,
            zIndex: visibleUrls.length - index,
            border: '0.5px solid rgba(0,0,0,0.05)',
          }}>
          <img
            src={getFaviconUrl(url)}
            alt=""
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default StackedLinkIcon;

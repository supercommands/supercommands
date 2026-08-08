import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { motion } from 'framer-motion';
import { FiCheck, FiUpload } from 'react-icons/fi';
import { getCustomWallpaperBase64, setCustomWallpaperBase64 } from '../../storage/localStorage/uiCustomizationStorage';
import { StorageManager } from '../../storage/localStorage/storageManager';
const toTitleCase = (str: string) => {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
};

// Wallpaper generation moved to a static list to avoid duplicate build-time bundling
const ThemeSettings: React.FC = () => {
  const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper } = useAppearance();
  const [customWallpaperPreview, setCustomWallpaperPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCustomWallpaperBase64().then(base64 => {
      if (base64) {
        setCustomWallpaperPreview(base64);
      }
    });
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setCustomWallpaperPreview(base64);
        StorageManager.setItem('wallpaper-id', 'custom');
        await setCustomWallpaperBase64(base64);
        await setWallpaper('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const wallpapers = [
    { id: 'none', label: 'None', src: '' },
    ...(customWallpaperPreview ? [{ id: 'custom', label: 'Custom Image', src: customWallpaperPreview }] : []),
    ...['car-race.png', 'Evermist.png', 'sky.png'].map(filename => {
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      return {
        id: filename,
        label: filename === 'car-race.png' ? 'Car Race' : toTitleCase(nameWithoutExt),
        src: `AltS_search_newtab/images/wallappear/${filename}`,
      };
    }).sort((a, b) => {
      if (a.label === 'Default Wallpaper') return -1;
      if (b.label === 'Default Wallpaper') return 1;
      return a.label.localeCompare(b.label);
    })
  ];

  const getWallpaperUrl = (wall: typeof wallpapers[number]) => {
    if (wall.id === 'custom') return wall.src;
    if (!wall.src) return '';
    return typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(wall.src)
      : '/' + wall.src;
  };

  return (
    <div className="space-y-6">
      {/* DARK THEMES SECTION */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
          DARK THEMES
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Theme Card 1: Moonlit Ocean */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Select Moonlit Ocean theme"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setThemeProfile('ocean-blue')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setThemeProfile('ocean-blue');
              }
            }}
            style={{
              background:
                'linear-gradient(155deg, #070B14 0%, #090E1A 30%, #0D1625 62%, #17243A 100%)',
            }}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${themeId === 'ocean-blue'
              ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none" />

            {/* Mini Moonlit Ocean Star pattern illustration */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="22" cy="15" r="0.9" fill="#FFF" opacity="0.45" />
              <circle cx="75" cy="12" r="1.1" fill="#F4F7FA" opacity="0.55" />
              <circle cx="125" cy="22" r="0.8" fill="#FFF" opacity="0.35" />
              <circle cx="45" cy="48" r="1.0" fill="#E5EDF7" opacity="0.35" />
              <circle cx="105" cy="55" r="0.7" fill="#FFF" opacity="0.35" />
            </svg>

            {/* Active Indicator Checkmark */}
            {themeId === 'ocean-blue' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
              <span className="text-[10px] font-bold text-white tracking-wide">Moonlit Ocean</span>
            </div>
          </motion.div>

          {/* Theme Card 4: Midnight Stars */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Select Midnight Stars theme"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setThemeProfile('midnight-stars');
              setWallpaper('none');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setThemeProfile('midnight-stars');
                setWallpaper('none');
              }
            }}
            style={{ background: 'linear-gradient(180deg, #19202A 0%, #343A43 100%)' }}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${themeId === 'midnight-stars'
              ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

            {/* Mini Star pattern illustration */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" xmlns="http://www.w3.org/2000/svg">
              <circle cx="25" cy="20" r="0.9" fill="#FFF" opacity="0.3" />
              <circle cx="85" cy="15" r="1.1" fill="#FFF" opacity="0.6" />
              <circle cx="135" cy="35" r="0.8" fill="#FFF" opacity="0.2" />
              <circle cx="45" cy="65" r="1.2" fill="#FFF" opacity="0.4" />
              <circle cx="105" cy="70" r="0.9" fill="#FFF" opacity="0.3" />
            </svg>

            {/* Active Indicator Checkmark */}
            {themeId === 'midnight-stars' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
              <span className="text-[10px] font-bold text-white tracking-wide">Midnight Stars</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* LIGHT THEMES SECTION */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
          LIGHT THEMES
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Theme Card 3: Cherry Blossom */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Select Cherry Blossom theme"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setThemeProfile('cherry-blossom');
              setWallpaper('none');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setThemeProfile('cherry-blossom');
                setWallpaper('none');
              }
            }}
            style={{ background: 'linear-gradient(180deg, #DCBDE5 0%, #E9D1E1 48%, #F6E8DA 100%)' }}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${themeId === 'cherry-blossom'
              ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />

            {/* Active Indicator Checkmark */}
            {themeId === 'cherry-blossom' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-white/70 backdrop-blur-md rounded-md border border-black/10 z-10 select-none">
              <span className="text-[10px] font-bold text-[#4A464A] tracking-wide">Cherry Blossom</span>
            </div>
          </motion.div>

          {/* Theme Card 5: Coastal Mint / Reflect */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Select Coastal Mint theme"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setThemeProfile('coastal-mint');
              setWallpaper('none');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setThemeProfile('coastal-mint');
                setWallpaper('none');
              }
            }}
            style={{ background: 'linear-gradient(180deg, #A5C8D1 0%, #BED6D4 50%, #D5E2D5 100%)' }}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${(themeId === 'coastal-mint' || themeId === 'reflect-gradient')
              ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />

            {/* Active Indicator Checkmark */}
            {(themeId === 'coastal-mint' || themeId === 'reflect-gradient') && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-white/70 backdrop-blur-md rounded-md border border-black/10 z-10 select-none">
              <span className="text-[10px] font-bold text-[#263538] tracking-wide">Coastal Mint</span>
            </div>
          </motion.div>

          {/* Theme Card 6: Periwinkle Mist */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Select Periwinkle Mist theme"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setThemeProfile('periwinkle-mist');
              setWallpaper('none');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setThemeProfile('periwinkle-mist');
                setWallpaper('none');
              }
            }}
            style={{ background: 'linear-gradient(180deg, #BBC6DE 0%, #C4CFE3 25%, #CCD8E7 50%, #D6E1EC 75%, #DFEAF0 100%)' }}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[#607AAA] ${themeId === 'periwinkle-mist'
              ? 'border-[#607AAA] ring-1 ring-[#607AAA] shadow-[0_0_14px_rgba(96,122,170,0.22)]'
              : 'border-[var(--color-borderDefault)] hover:border-[#607AAA] hover:shadow-[0_0_14px_rgba(96,122,170,0.22)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />

            {/* Active Indicator Checkmark */}
            {themeId === 'periwinkle-mist' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#607AAA] flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-white/70 backdrop-blur-md rounded-md border border-black/10 z-10 select-none">
              <span className="text-[10px] font-bold text-[#273445] tracking-wide">Periwinkle Mist</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* WALLPAPER SELECTION SECTION */}
      <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
          WALLPAPER (NOT RECOMMENDED)
        </h3>
        <div className="flex flex-wrap gap-4">
          {wallpapers.map(wall => {
            const isActive = wallpaperId === wall.id;
            const bgStyle = wall.id === 'none' ? { backgroundColor: '#121212' } : {
              backgroundImage: `url('${getWallpaperUrl(wall)}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            };

            return (
              <motion.div
                key={wall.id}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setWallpaper(wall.id)}
                style={bgStyle}
                className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${isActive
                  ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
                  : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                  }`}
              >
                {/* Subtle inner border for contrast */}
                <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                {/* Active Indicator Checkmark */}
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                    <FiCheck size={11} className="stroke-[3]" />
                  </div>
                )}

                {/* Name Pill (Bottom Left Overlay) */}
                {wall.label && (
                  <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                    <span className="text-[10px] font-bold text-white tracking-wide">{wall.label}</span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Upload Custom Card */}
          <motion.div
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUploadClick}
            className="cursor-pointer border border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/20 rounded-xl w-[160px] h-[95px] transition-all relative flex flex-col items-center justify-center gap-1.5 shadow-md"
          >
            <FiUpload className="text-neutral-400" size={18} />
            <span className="text-[10px] font-bold text-neutral-400 tracking-wide">Upload Custom</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;

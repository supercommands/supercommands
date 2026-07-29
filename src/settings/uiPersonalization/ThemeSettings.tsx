import React, { useState, useEffect, useRef } from 'react';
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
      {/* THEME SELECTION SECTION */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
          Select Theme
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Theme Card 1: Default Dark */}
          <motion.div
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setThemeProfile('default-dark')}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-gradient-to-br from-[#121212] to-[#1e1e1e] transition-all relative overflow-hidden shadow-md ${themeId === 'default-dark'
              ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

            {/* Active Indicator Checkmark */}
            {themeId === 'default-dark' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
              <span className="text-[10px] font-bold text-white tracking-wide">Dark</span>
            </div>
          </motion.div>

          {/* Theme Card 2: Ocean Blue */}
          <motion.div
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setThemeProfile('ocean-blue')}
            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-gradient-to-br from-[#090e1a] via-[#0f172a] to-[#1e293b] transition-all relative overflow-hidden shadow-md ${themeId === 'ocean-blue'
              ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
              : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
              }`}
          >
            {/* Subtle inner border for contrast */}
            <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

            {/* Active Indicator Checkmark */}
            {themeId === 'ocean-blue' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                <FiCheck size={11} className="stroke-[3]" />
              </div>
            )}

            {/* Name Pill (Bottom Left Overlay) */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
              <span className="text-[10px] font-bold text-white tracking-wide">Ocean Blue</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* WALLPAPER SELECTION SECTION */}
      <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
          Select Wallpaper
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
                  ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                  : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                  }`}
              >
                {/* Subtle inner border for contrast */}
                <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                {/* Active Indicator Checkmark */}
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
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

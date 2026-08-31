import * as React from 'react';
import { useState, useEffect, useRef, useId } from 'react';
import { useAppearance, THEME_FAMILIES } from '@extension/ui';
import { motion } from 'framer-motion';
import { FiCheck, FiUpload, FiSun, FiRotateCcw } from 'react-icons/fi';
import { getCustomWallpaperBase64, setCustomWallpaperBase64 } from '../../storage/localStorage/uiCustomizationStorage';
import { StorageManager } from '../../storage/localStorage/storageManager';

const toTitleCase = (str: string) => {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared mini scattered-dots SVG for dark card previews
// ─────────────────────────────────────────────────────────────────────────────
const CardDotOverlay: React.FC = () => {
  const uid = useId().replace(/:/g, '_');
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`card-dots-${uid}`} width="160" height="95" patternUnits="userSpaceOnUse">
          <circle cx="22"  cy="15"  r="0.9" fill="#FFF" opacity="0.45" />
          <circle cx="75"  cy="12"  r="1.1" fill="#F4F7FA" opacity="0.55" />
          <circle cx="125" cy="22"  r="0.8" fill="#FFF" opacity="0.35" />
          <circle cx="45"  cy="48"  r="1.0" fill="#E5EDF7" opacity="0.35" />
          <circle cx="105" cy="55"  r="0.7" fill="#FFF" opacity="0.35" />
          <circle cx="140" cy="70"  r="1.0" fill="#FFF" opacity="0.28" />
          <circle cx="15"  cy="75"  r="0.8" fill="#E2F1FF" opacity="0.30" />
          <circle cx="85"  cy="82"  r="0.9" fill="#FFF" opacity="0.40" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#card-dots-${uid})`} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable theme preview card
// ─────────────────────────────────────────────────────────────────────────────
interface ThemePreviewCardProps {
  id: string;
  name: string;
  gradient: string;
  isDark: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({
  id,
  name,
  gradient,
  isDark,
  isSelected,
  onSelect,
}) => {
  const ariaLabel = `Select ${name} ${isDark ? 'dark' : 'light'} theme`;

  const selectedClass = isSelected
    ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
    : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]';

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${selectedClass}`}
    >
      {/* The appearance root applies brightness uniformly to this preview and the rest of the UI. */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Subtle inner border for depth */}
      <div
        className={`absolute inset-0 border rounded-xl pointer-events-none ${
          isDark ? 'border-white/10' : 'border-black/5'
        }`}
      />

      {/* Scattered dots overlay — dark themes only */}
      {isDark && <CardDotOverlay />}

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
          <FiCheck size={11} className="stroke-[3]" />
        </div>
      )}

      {/* Name pill */}
      {isDark ? (
        <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
          <span className="text-[10px] font-bold text-white tracking-wide">{name}</span>
        </div>
      ) : (
        <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-white/70 backdrop-blur-md rounded-md border border-black/10 z-10 select-none">
          <span className="text-[10px] font-bold text-[#1e2a3a] tracking-wide">{name}</span>
        </div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main ThemeSettings component
// ─────────────────────────────────────────────────────────────────────────────
const ThemeSettings: React.FC = () => {
  const {
    themeId,
    setTheme: setThemeProfile,
    wallpaperId,
    setWallpaper,
    brightness,
    setBrightness,
    resetBrightness,
    warmTintEnabled,
    setWarmTintEnabled,
    warmTintStrength,
    setWarmTintStrength,
    resetWarmTintStrength,
  } = useAppearance();
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

  /**
   * Select a gradient theme variant: applies the theme and resets wallpaper to 'none'
   * so the gradient background is always visible after selection.
   */
  const handleSelectTheme = async (id: string) => {
    await setThemeProfile(id);
    await setWallpaper('none');
  };

  const trackFillPercent = brightness;

  return (
    <div className="space-y-6">
      {/* ── THEMES SECTION ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-textPrimary)] tracking-wider">
          Themes
        </h2>

        {/* ── DARK THEMES ─────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-[var(--color-textMuted)] tracking-wider">
            Dark
          </h3>
          <div className="flex flex-wrap gap-4">
            {THEME_FAMILIES.map(family => (
              <ThemePreviewCard
                key={family.darkId}
                id={family.darkId}
                name={family.name}
                gradient={family.darkGradient}
                isDark={true}
                isSelected={themeId === family.darkId}
                onSelect={() => handleSelectTheme(family.darkId)}
              />
            ))}
          </div>
        </div>

        {/* ── LIGHT THEMES ────────────────────────────────────────────── */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-xs font-semibold text-[var(--color-textMuted)] tracking-wider">
            Light
          </h3>
          <div className="flex flex-wrap gap-4">
            {THEME_FAMILIES.filter(family => family.hasLightVariant !== false && family.lightId).map(family => (
              <ThemePreviewCard
                key={family.lightId!}
                id={family.lightId!}
                name={family.name}
                gradient={family.lightGradient!}
                isDark={false}
                isSelected={themeId === family.lightId}
                onSelect={() => handleSelectTheme(family.lightId!)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── WALLPAPER SELECTION ──────────────────────────────────────── */}
      <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider">
          Wallpaper 
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

      {/* ── BRIGHTNESS SECTION ───────────────────────────────────────── */}
      <div className="space-y-2.5 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider">
          Brightness
        </h3>
        <div className="w-full max-w-[420px] p-2.5 px-3 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] flex items-center gap-3">
          <FiSun size={14} className="text-[var(--color-textMuted)] shrink-0 opacity-70" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={brightness}
            onChange={e => setBrightness(Number(e.target.value))}
            aria-label="Theme brightness"
            aria-valuetext={`${brightness}%`}
            style={{
              background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${trackFillPercent}%, var(--color-borderDefault) ${trackFillPercent}%, var(--color-borderDefault) 100%)`,
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
          />
          <FiSun size={18} className="text-[var(--color-textSecondary)] shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-[var(--color-textSecondary)] w-10 text-right shrink-0 select-none">
            {brightness}%
          </span>
          <button
            type="button"
            onClick={resetBrightness}
            disabled={brightness === 70}
            title="Reset brightness to 70%"
            aria-label="Reset brightness to 70%"
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              brightness === 70
                ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--color-textMuted)]'
                : 'border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
            }`}
          >
            <FiRotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── WARM SCREEN TINT SECTION ─────────────────────────────────── */}
      <div className="space-y-2.5 pt-6 border-t border-[var(--color-borderDefault)]">
        <div>
          <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider">
            Warm Screen Tint
          </h3>
          <p className="text-[11px] text-[var(--color-textMuted)] mt-0.5 opacity-80">
            Adds a gentle warm tone across the new-tab screen.
          </p>
        </div>
        <div className="w-full max-w-[420px] p-2.5 px-3 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] flex items-center gap-3">
          <FiSun size={14} className="text-[var(--color-textMuted)] shrink-0 opacity-70" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={warmTintStrength}
            onChange={e => setWarmTintStrength(Number(e.target.value))}
            aria-label="Warm screen tint strength"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={warmTintStrength}
            aria-valuetext={`${warmTintStrength}%`}
            style={{
              background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${warmTintStrength}%, var(--color-borderDefault) ${warmTintStrength}%, var(--color-borderDefault) 100%)`,
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
          />
          <span className="text-xs font-mono font-bold w-10 text-right shrink-0 select-none text-[var(--color-textSecondary)]">
            {warmTintStrength}%
          </span>
          <button
            type="button"
            onClick={resetWarmTintStrength}
            disabled={warmTintStrength === 10}
            title="Reset tint strength to 10%"
            aria-label="Reset warm screen tint strength to 10%"
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shrink-0 ${
              warmTintStrength === 10
                ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--color-textMuted)]'
                : 'cursor-pointer border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
            }`}
          >
            <FiRotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;

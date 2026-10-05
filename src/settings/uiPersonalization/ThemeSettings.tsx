import * as React from 'react';
import { useId } from 'react';
import { useAppearance, THEME_FAMILIES } from '@extension/ui';
import { motion } from 'framer-motion';
import { FiCheck, FiSun, FiRotateCcw } from 'react-icons/fi';
import WallpaperChoices from './WallpaperChoices';
// ─────────────────────────────────────────────────────────────────────────────
// Shared mini scattered-dots SVG for dark card previews
// ─────────────────────────────────────────────────────────────────────────────
const CardDotOverlay: React.FC = () => {
    const uid = useId().replace(/:/g, '_');
    return (<svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id={`card-dots-${uid}`} width="160" height="95" patternUnits="userSpaceOnUse">
          <circle cx="22" cy="15" r="0.9" fill="#FFF" opacity="0.45"/>
          <circle cx="75" cy="12" r="1.1" fill="#F4F7FA" opacity="0.55"/>
          <circle cx="125" cy="22" r="0.8" fill="#FFF" opacity="0.35"/>
          <circle cx="45" cy="48" r="1.0" fill="#E5EDF7" opacity="0.35"/>
          <circle cx="105" cy="55" r="0.7" fill="#FFF" opacity="0.35"/>
          <circle cx="140" cy="70" r="1.0" fill="#FFF" opacity="0.28"/>
          <circle cx="15" cy="75" r="0.8" fill="#E2F1FF" opacity="0.30"/>
          <circle cx="85" cy="82" r="0.9" fill="#FFF" opacity="0.40"/>
          <circle cx="30" cy="34" r="0.7" fill="#FFF" opacity="0.28"/>
          <circle cx="118" cy="84" r="0.8" fill="#E2F1FF" opacity="0.32"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#card-dots-${uid})`}/>
    </svg>);
};
// ─────────────────────────────────────────────────────────────────────────────
// Reusable theme preview card
// ─────────────────────────────────────────────────────────────────────────────
interface ThemePreviewCardProps {
    name: string;
    gradient: string;
    isRecommended?: boolean;
    isSelected: boolean;
    onSelect: () => void;
}
const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({ name, gradient, isRecommended = false, isSelected, onSelect, }) => {
    const ariaLabel = `Select ${name} dark theme`;
    const selectedClass = isSelected
        ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
        : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]';
    return (<motion.div role="button" tabIndex={0} aria-label={ariaLabel} aria-pressed={isSelected} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} onClick={onSelect} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
            }
        }} className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${selectedClass}`}>
      {/* The appearance root applies brightness uniformly to this preview and the rest of the UI. */}
      <div className="absolute inset-0" style={{ background: gradient }}/>

      {/* Subtle inner border for depth */}
      <div className="absolute inset-0 border rounded-xl pointer-events-none border-white/10"/>

      {/* Scattered dots overlay — dark themes only */}
      <CardDotOverlay />

      {/* Selection checkmark */}
      {isSelected && (<div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
          <FiCheck size={11} className="stroke-[3]"/>
        </div>)}

      {isRecommended && (<div className="absolute top-2.5 left-2.5 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-textPrimary)] z-10 select-none">
          Recommended
        </div>)}

      {/* Name pill */}
      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
        <span className="text-[10px] font-bold text-white tracking-wide">{name}</span>
      </div>
    </motion.div>);
};
// ─────────────────────────────────────────────────────────────────────────────
// Main ThemeSettings component
// ─────────────────────────────────────────────────────────────────────────────
const ThemeSettings: React.FC = () => {
    const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper, brightness, setBrightness, resetBrightness, warmTintEnabled, setWarmTintEnabled, warmTintStrength, setWarmTintStrength, resetWarmTintStrength, } = useAppearance();
    /**
     * Select a gradient theme variant: applies the theme and resets wallpaper to 'none'
     * so the gradient background is always visible after selection.
     */
    const handleSelectTheme = async (id: string) => {
        await setWallpaper('none');
        await setThemeProfile(id);
    };
    const trackFillPercent = brightness;
    return (<div className="space-y-6">
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
            {THEME_FAMILIES.map(family => (<ThemePreviewCard key={family.darkId} name={family.name} gradient={family.darkGradient} isRecommended={family.recommended} isSelected={wallpaperId === 'none' && themeId === family.darkId} onSelect={() => handleSelectTheme(family.darkId)}/>))}
          </div>
        </div>

      </div>

      {/* ── WALLPAPER SELECTION ──────────────────────────────────────── */}
      <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider">Wallpaper</h3>
        <WallpaperChoices />
      </div>

      {/* ── BRIGHTNESS SECTION ───────────────────────────────────────── */}
      <div className="space-y-2.5 pt-6 border-t border-[var(--color-borderDefault)]">
        <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider">
          Brightness
        </h3>
        <div className="w-full max-w-[420px] p-2.5 px-3 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] flex items-center gap-3">
          <FiSun size={14} className="text-[var(--color-textMuted)] shrink-0 opacity-70" aria-hidden="true"/>
          <input type="range" min={0} max={100} step={1} value={brightness} onChange={e => setBrightness(Number(e.target.value))} aria-label="Theme brightness" aria-valuetext={`${brightness}%`} style={{
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${trackFillPercent}%, var(--color-borderDefault) ${trackFillPercent}%, var(--color-borderDefault) 100%)`,
        }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
          <FiSun size={18} className="text-[var(--color-textSecondary)] shrink-0" aria-hidden="true"/>
          <span className="text-xs font-mono font-bold text-[var(--color-textSecondary)] w-10 text-right shrink-0 select-none">
            {brightness}%
          </span>
          <button type="button" onClick={resetBrightness} disabled={brightness === 70} title="Reset brightness to 70%" aria-label="Reset brightness to 70%" className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${brightness === 70
            ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--color-textMuted)]'
            : 'border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'}`}>
            <FiRotateCcw size={14}/>
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
          <FiSun size={14} className="text-[var(--color-textMuted)] shrink-0 opacity-70" aria-hidden="true"/>
          <input type="range" min={0} max={100} step={1} value={warmTintStrength} onChange={e => setWarmTintStrength(Number(e.target.value))} aria-label="Warm screen tint strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={warmTintStrength} aria-valuetext={`${warmTintStrength}%`} style={{
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${warmTintStrength}%, var(--color-borderDefault) ${warmTintStrength}%, var(--color-borderDefault) 100%)`,
        }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
          <span className="text-xs font-mono font-bold w-10 text-right shrink-0 select-none text-[var(--color-textSecondary)]">
            {warmTintStrength}%
          </span>
          <button type="button" onClick={resetWarmTintStrength} disabled={warmTintStrength === 10} title="Reset tint strength to 10%" aria-label="Reset warm screen tint strength to 10%" className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shrink-0 ${warmTintStrength === 10
            ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--color-textMuted)]'
            : 'cursor-pointer border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'}`}>
            <FiRotateCcw size={14}/>
          </button>
        </div>
      </div>
    </div>);
};
export default ThemeSettings;

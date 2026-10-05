import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiUpload } from 'react-icons/fi';
import { useAppearance } from '@extension/ui';
import { getCustomWallpaperBase64, setCustomWallpaperBase64 } from '../../storage/localStorage/uiCustomizationStorage';
interface WallpaperChoicesProps {
    className?: string;
    style?: React.CSSProperties;
    cardStyle?: React.CSSProperties;
}
const packagedWallpapers = [
    { id: 'car-race.png', label: 'Car Race' },
    { id: 'Evermist.png', label: 'Evermist' },
    { id: 'sky.png', label: 'Sky' }
];
const WallpaperChoices: React.FC<WallpaperChoicesProps> = ({ className = 'flex flex-wrap gap-4', style, cardStyle, }) => {
    const { wallpaperId, setWallpaper } = useAppearance();
    const [customPreview, setCustomPreview] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        void getCustomWallpaperBase64().then(setCustomPreview);
    }, []);
    const wallpapers = [
        ...(customPreview ? [{ id: 'custom', label: 'Custom Image', src: customPreview }] : []),
        ...packagedWallpapers.map(wall => ({
            ...wall,
            src: typeof chrome !== 'undefined' && chrome.runtime?.getURL
                ? chrome.runtime.getURL(`AltS_search_newtab/images/wallappear/${wall.id}`)
                : `/AltS_search_newtab/images/wallappear/${wall.id}`,
        }))
    ];
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }
        setError('');
        const reader = new FileReader();
        reader.onerror = () => setError('Could not read this image. Please try another file.');
        reader.onload = async () => {
            const base64 = reader.result;
            if (typeof base64 !== 'string') {
                setError('Could not read this image. Please try another file.');
                return;
            }
            try {
                await setCustomWallpaperBase64(base64);
                await setWallpaper('custom');
                setCustomPreview(base64);
            }
            catch {
                setError('Could not save this image. Please try another file.');
            }
        };
        reader.readAsDataURL(file);
    };
    return (<div>
      <div className={className} style={style}>
        {wallpapers.map(wall => {
            const isActive = wallpaperId === wall.id;
            return (<motion.button key={wall.id} type="button" aria-label={`Select ${wall.label} wallpaper`} aria-pressed={isActive} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => void setWallpaper(wall.id)} style={{ ...cardStyle, backgroundImage: `url('${wall.src}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)] ${isActive
                    ? 'border-[var(--color-borderSelected)] ring-1 ring-[var(--color-borderSelected)]'
                    : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'}`}>
              <span className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none"/>
              {isActive && (<span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md z-10">
                  <FiCheck size={11} className="stroke-[3]"/>
                </span>)}
              <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 text-[10px] font-bold text-white tracking-wide">
                {wall.label}
              </span>
            </motion.button>);
        })}

        <motion.button type="button" aria-label="Upload custom wallpaper" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()} style={cardStyle} className="cursor-pointer border border-dashed border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] bg-[var(--color-cardBg)] rounded-xl w-[160px] h-[95px] transition-all relative flex flex-col items-center justify-center gap-1.5 shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]">
          <FiUpload className="text-[var(--color-textSecondary)]" size={18}/>
          <span className="text-[10px] font-bold text-[var(--color-textSecondary)] tracking-wide">Upload Custom</span>
        </motion.button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" aria-label="Choose a custom wallpaper image"/>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[var(--color-textError)]">{error}</p>}
    </div>);
};
export default WallpaperChoices;

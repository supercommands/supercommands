import * as React from 'react';
import logoUrl from './assets/supercommands_logo.png';
import { useUIStore } from './uiStateManager';
interface BrandingProps {
    className?: string;
    onClick?: () => void;
    showAvatar?: boolean;
    showText?: boolean;
    textColor?: string;
}
const Branding: React.FC<BrandingProps> = ({ className = '', onClick, showText = true, textColor = 'text-[var(--color-textPrimary)]', }) => {
    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick();
        }
        const store = useUIStore.getState();
        if (store.isSheetOpen) {
            store.closeSheet();
        }
        if (store.activeEditor) {
            store.closeEditor();
        }
        store.returnToHome();
    };
    return (<div className={`flex items-center z-50 ${className}`}>
      {logoUrl ? (<img src={logoUrl} className={`h-7 w-7 object-contain rounded cursor-pointer select-none ${showText ? 'mr-2' : ''}`} onClick={handleClick} alt="SuperCommands"/>) : null}
      {showText && (<span className={`text-sm ${textColor} font-comfortaa cursor-pointer select-none tracking-tight truncate`} onClick={handleClick}>
          SuperCommands
        </span>)}
    </div>);
};
export default Branding;

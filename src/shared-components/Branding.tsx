import * as React from 'react';
import logoUrl from './assets/cmdOS_logo.png';

interface BrandingProps {
  className?: string;
  onClick?: () => void;
  showAvatar?: boolean;
  textColor?: string;
}

const Branding: React.FC<BrandingProps> = ({
  className = '',
  onClick,
  textColor = 'text-[var(--color-textPrimary)]',
}) => {
  return (
    <div className={`flex items-center  z-50 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          className="h-7 w-7 object-contain rounded cursor-pointer select-none mr-2"
          onClick={onClick}
          alt="cmdOS"
        />
      ) : null}
      <span className={`text-lg ${textColor} font-comfortaa cursor-pointer select-none`} onClick={onClick}>
        cmdOS
      </span>
    </div>
  );
};

export default Branding;

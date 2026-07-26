import React from 'react';
import logoUrl from './assets/tasklabs_logo.png'

interface BrandingProps {
  className?: string;
  onClick?: () => void;
  showAvatar?: boolean;
  textColor?: string;
}

const Branding: React.FC<BrandingProps> = ({ className = '', onClick, textColor }) => {



  return (
    <div className={`flex items-center  z-50 ${className}`}>

      {logoUrl ? (
        <img
          src={logoUrl}
          className="h-9 w-9 object-contain rounded cursor-pointer select-none"
          onClick={onClick}
          alt="cmdOS"
        />
      ) : null}
      <span
        className={`text-lg ${textColor } font-comfortaa cursor-pointer select-none`}
        onClick={onClick}>
        cmdOS
      </span>
    </div>
  );
};

export default Branding;

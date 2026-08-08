import * as React from 'react';

interface NotesIconProps {
  size?: number | string;
  className?: string;
}

export default function NotesIcon({ size = 24, className = '' }: NotesIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Dark background */}
      <rect x="2.5" y="3" width="19" height="18" rx="3.2" fill="#2B2B2B" />

      {/* Paper body */}
      <rect x="3.5" y="4" width="17" height="16" rx="2.8" fill="#FFFFFF" />

      {/* Strong bottom gold highlight */}
      <rect x="3.5" y="18.4" width="17" height="1.6" rx="0.8" fill="#FFD84D" />

      {/* Paper lines (thicker & darker for small size) */}
      <path
        d="
          M7 8.6 H17
          M7 10.8 H16
          M7 13 H15
          M7 15.2 H14
          M7 17.4 H13
        "
        stroke="#BDBDBD"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Folded corner – shadow */}
      <path
        d="
          M14.5 20
          C17.6 18.1 19.2 16.6 20.8 14.5
          L20.8 20
          Z
        "
        fill="#E6C98A"
      />

      {/* Folded corner – mid layer */}
      <path
        d="
          M15.2 20
          C17.4 18.4 18.6 17.2 20.4 15.2
          L20.4 20
          Z
        "
        fill="#E0E0E0"
      />

      {/* Folded corner – top paper */}
      <path
        d="
          M16 20
          C17.8 18.7 18.8 17.8 20 16
          L20 20
          Z
        "
        fill="#FFFFFF"
      />

      {/* Gold rings – brighter, thicker */}
      <path d="M7 4 C7 2.6 9 2.6 9 4 V5.6 C9 7 7 7 7 5.6 Z" fill="#FFD84D" stroke="#3A3A3A" strokeWidth="0.9" />
      <path d="M11 4 C11 2.6 13 2.6 13 4 V5.6 C13 7 11 7 11 5.6 Z" fill="#FFD84D" stroke="#3A3A3A" strokeWidth="0.9" />
      <path d="M15 4 C15 2.6 17 2.6 17 4 V5.6 C17 7 15 7 15 5.6 Z" fill="#FFD84D" stroke="#3A3A3A" strokeWidth="0.9" />
    </svg>
  );
}

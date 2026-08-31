import * as React from 'react';
import { useMemo } from 'react';

interface CUnderscoreIconProps {
  size?: number;
  className?: string;
}

export const CUnderscoreIcon: React.FC<CUnderscoreIconProps> = ({ size = 16, className }) => {
  const maskId = useMemo(() => `c-underscore-mask-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 2 16 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}>
      <mask id={maskId} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x={0} y={0} width={16} height={16}>
        <rect width="16" height="16" fill="#D9D9D9" />
      </mask>
      <g mask={`url(#${maskId})`} transform="translate(0.5, 0)">
        {/* The 'C' shape */}
        <path
          d="M1.35997 11.1646C1.59995 11.3882 1.89731 11.5 2.25206 11.5H6.00825C6.363 11.5 6.66036 11.3882 6.90034 11.1646C7.14032 10.941 7.26031 10.6639 7.26031 10.3333V9.16667H5.38222V9.75H2.87809V6.25H5.38222V6.83333H7.26031V5.66667C7.26031 5.33611 7.14032 5.05903 6.90034 4.83542C6.66036 4.61181 6.363 4.5 6.00825 4.5H2.25206C1.89731 4.5 1.59995 4.61181 1.35997 4.83542C1.11999 5.05903 1 5.33611 1 5.66667V10.3333C1 10.6639 1.11999 10.941 1.35997 11.1646Z"
          fill="currentColor"
        />
        {/* The Underscore '_' shape */}
        <rect x="9" y="10" width="6" height="1.5" rx="0.5" fill="currentColor" />
      </g>
    </svg>
  );
};

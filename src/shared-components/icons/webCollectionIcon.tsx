import { useId } from 'react';

interface WebCollectionIconProps {
    size?: number;
    className?: string;
}

export default function WebCollectionIcon({ size = 16, className = '' }: WebCollectionIconProps) {
    const prefix = `web-collection-${useId().replace(/:/g, '')}`;
    const id = (name: string) => `${prefix}-${name}`;
    const url = (name: string) => `url(#${id(name)})`;
    return <svg width={size} height={size} viewBox="104 121 236 243" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={id('globeMetal')} x1="145" y1="145" x2="300" y2="340" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF"/><stop offset="0.20" stopColor="#F2F3F8"/><stop offset="0.43" stopColor="#C8CAD6"/><stop offset="0.62" stopColor="#9699B2"/><stop offset="0.80" stopColor="#686D9D"/><stop offset="1" stopColor="#3F477F"/>
        </linearGradient>
        <linearGradient id={id('bookmarkFill')} x1="258" y1="258" x2="330" y2="354" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF"/><stop offset="0.24" stopColor="#F2F3F8"/><stop offset="0.56" stopColor="#C8CAD6"/><stop offset="1" stopColor="#C8CAD6"/>
        </linearGradient>
        <linearGradient id={id('bookmarkEdge')} x1="255" y1="256" x2="330" y2="355" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.60"/><stop offset="0.42" stopColor="#F2F3F8" stopOpacity="0.24"/><stop offset="1" stopColor="#C8CAD6" stopOpacity="0.16"/>
        </linearGradient>
        <clipPath id={id('globeClip')}><circle cx="222" cy="239" r="103.5"/></clipPath>
        <filter id={id('globeGlow')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" result="blur"/><feFlood floodColor="#5E65A9" floodOpacity="0.18"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={id('bookmarkGlow')} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="3.2" result="blur"/><feFlood floodColor="#C8CAD6" floodOpacity="0.24"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter={url('globeGlow')}>
        <g clipPath={url('globeClip')} stroke={url('globeMetal')} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
          <path d="M210.5 137.5C189.5 160.5 177 198.5 177 239C177 281.5 189.5 319.5 210.5 340.5"/>
          <path d="M233.5 137.5C254.5 160.5 267 198.5 267 239C267 281.5 254.5 319.5 233.5 340.5"/>
          <path d="M121.5 201H322.5"/><path d="M121.5 278H322.5"/>
        </g>
        <circle cx="222" cy="239" r="103.5" stroke={url('globeMetal')} strokeWidth="14"/>
      </g>
      <path d="M272 256.5H312.7C323.2 256.5 330 263.8 330 274.4V344.7C330 349.5 327.8 352.9 324.2 354.2C321.5 355.2 318.9 354.4 316.4 352.5L296.1 337.7C293.8 336 291.3 336 288.9 337.8L268.3 352.8C265.5 354.9 262.4 355.5 259.6 354C256.2 352.1 254.5 349 254.5 344.7V274C254.5 263.8 261.8 256.5 272 256.5Z" fill={url('bookmarkFill')} stroke={url('bookmarkEdge')} strokeWidth="1.2" filter={url('bookmarkGlow')}/>
      <path d="M272 258.2H312.2C321.6 258.2 328.2 264.7 328.2 274.2V280C311.8 267.7 286.5 263.3 260 272.4V274.2C260 265.1 264.7 258.2 272 258.2Z" fill="#FFFFFF" opacity="0.07"/>
    </svg>;
}

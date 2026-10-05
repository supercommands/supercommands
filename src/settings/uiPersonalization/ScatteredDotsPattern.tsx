import * as React from 'react';
import { useId } from 'react';
/**
 * Shared scattered-dot/star overlay for all dark themes.
 * Uses a unique pattern ID (via useId) to prevent SVG pattern ID collisions
 * if this component is ever mounted in multiple locations simultaneously.
 */
const ScatteredDotsPattern: React.FC = () => {
    const uid = useId().replace(/:/g, '_');
    const patternId = `scattered-dots-tile-${uid}`;
    return (<svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-60" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', width: '100%', height: '100%' }} aria-hidden="true">
      <defs>
        <pattern id={patternId} width="720" height="720" patternUnits="userSpaceOnUse">
          {/* Sparse, small, low-opacity dots — decorative only */}
          <circle cx="85" cy="92" r="1.1" fill="#FFFFFF" opacity="0.22"/>
          <circle cx="270" cy="48" r="1.5" fill="#E2F1FF" opacity="0.52"/>
          <circle cx="490" cy="140" r="0.8" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="630" cy="75" r="1.3" fill="#FFFFFF" opacity="0.38"/>
          <circle cx="160" cy="310" r="1.0" fill="#E2F1FF" opacity="0.26"/>
          <circle cx="380" cy="275" r="1.6" fill="#FFFFFF" opacity="0.55"/>
          <circle cx="560" cy="390" r="0.9" fill="#FFFFFF" opacity="0.22"/>
          <circle cx="95" cy="520" r="1.4" fill="#FFFFFF" opacity="0.34"/>
          <circle cx="310" cy="460" r="0.7" fill="#E2F1FF" opacity="0.16"/>
          <circle cx="460" cy="580" r="1.2" fill="#FFFFFF" opacity="0.28"/>
          <circle cx="680" cy="490" r="1.0" fill="#FFFFFF" opacity="0.22"/>
          <circle cx="220" cy="650" r="1.3" fill="#E2F1FF" opacity="0.40"/>
          <circle cx="410" cy="690" r="0.9" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="610" cy="630" r="1.5" fill="#FFFFFF" opacity="0.48"/>
          <circle cx="340" cy="180" r="0.8" fill="#FFFFFF" opacity="0.20"/>
          <circle cx="555" cy="245" r="1.1" fill="#E2F1FF" opacity="0.30"/>
          <circle cx="700" cy="340" r="0.9" fill="#FFFFFF" opacity="0.16"/>
          <circle cx="40" cy="410" r="1.0" fill="#E2F1FF" opacity="0.24"/>
          <circle cx="145" cy="600" r="0.7" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="540" cy="540" r="1.2" fill="#FFFFFF" opacity="0.26"/>
          <circle cx="28" cy="185" r="0.8" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="205" cy="118" r="1.0" fill="#E2F1FF" opacity="0.30"/>
          <circle cx="435" cy="42" r="0.7" fill="#FFFFFF" opacity="0.20"/>
          <circle cx="655" cy="220" r="1.0" fill="#E2F1FF" opacity="0.24"/>
          <circle cx="250" cy="385" r="0.8" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="705" cy="675" r="1.1" fill="#FFFFFF" opacity="0.28"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`}/>
    </svg>);
};
export default ScatteredDotsPattern;

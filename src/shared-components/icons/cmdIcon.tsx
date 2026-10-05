export default function CommandTileIcon({ size = 64, height = 36, fontSize = 18, className = 'text-neutral-500', }: {
    size?: number;
    height?: number;
    fontSize?: number;
    className?: string;
}) {
    return (<svg width={size} height={height} viewBox="0 0 64 36">
      {/* Outer glow */}
      <rect x="0.5" y="0.5" width="63" height="35" rx="8" fill="none" stroke="#3A3A3A" strokeWidth="1" opacity="0.6"/>

      {/* Main body */}
      <rect x="2" y="2" width="60" height="32" rx="7"/>

      {/* Inner border */}
      <rect x="3" y="3" width="58" height="30" rx="6" fill="none" stroke="#4A4A4A" strokeWidth="1" opacity="0.7"/>

      {/* Text: C:\ */}
      <text x="18" y="24" fill="#FFFFFF" fontSize={fontSize} fontWeight="700" fontFamily="system-ui, -apple-system, Segoe UI, sans-serif" letterSpacing="0.5">
        C:\
      </text>
    </svg>);
}

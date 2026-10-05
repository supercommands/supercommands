import { clsx } from 'clsx';
export const VisualKeyDisplay = ({ hotkey, size = 'sm', variant = 'default', }: {
    hotkey: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'black' | 'text';
}) => {
    const isMac = typeof navigator !== 'undefined' &&
        (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
    if (!hotkey || typeof hotkey !== 'string')
        return null;
    const keys = hotkey.replace(/\+/g, ' + ').split(' ');
    if (variant === 'text') {
        return (<div className={clsx("flex items-center gap-1 font-medium text-[11px] tracking-tight text-[var(--color-textSecondary)]")}>
        {keys.map((k, i) => {
                if (k === '+')
                    return <span key={i}>+</span>;
                let displayKey = k;
                if (isMac) {
                    if (k === 'Meta' || k === 'Command' || k === 'Cmd')
                        displayKey = '⌘';
                    if (k === 'Control' || k === 'Ctrl')
                        displayKey = '⌃';
                    if (k === 'Alt' || k === 'Option')
                        displayKey = '⌥';
                    if (k === 'Shift')
                        displayKey = '⇧';
                }
                return <span key={i}>{displayKey}</span>;
            })}
      </div>);
    }
    const sizeClasses = {
        sm: { kbd: 'text-[10px] px-1.5 py-0.5 min-w-[20px]', plus: 'text-[10px]' },
        md: { kbd: 'text-xs px-2 py-1 min-w-[24px]', plus: 'text-xs' },
        lg: { kbd: 'text-sm px-2.5 py-1 min-w-[28px]', plus: 'text-sm' },
    };
    const currentSize = sizeClasses[size];
    return (<div className="flex items-center gap-1 pointer-events-none select-none">
      {keys.map((k, i) => {
            if (k === '+')
                return (<span key={i} className={`text-[var(--color-textSecondary)] ${currentSize.plus}`}>
              +
            </span>);
            let displayKey = k;
            if (isMac) {
                if (k === 'Meta' || k === 'Command' || k === 'Cmd')
                    displayKey = '⌘';
                if (k === 'Control' || k === 'Ctrl')
                    displayKey = '⌃';
                if (k === 'Alt' || k === 'Option')
                    displayKey = '⌥';
                if (k === 'Shift')
                    displayKey = '⇧';
            }
            const colorClasses = variant === 'black'
                ? 'bg-[#222] border-none text-[var(--color-textPrimary)] shadow-md'
                : 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-[var(--color-textPrimary)]';
            return (<kbd key={i} className={`${currentSize.kbd} ${colorClasses} ${variant === 'black' ? '' : 'border-b-2'} rounded font-mono text-center shadow-sm`}>
            {displayKey}
          </kbd>);
        })}
    </div>);
};

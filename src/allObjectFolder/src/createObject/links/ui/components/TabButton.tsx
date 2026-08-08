import * as React from 'react';
import { clsx } from 'clsx';

// Tab button component (from BuildView)
const TabButton = ({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 text-sm font-semibold transition-all relative focus:outline-none focus:ring-0 border-none outline-none flex items-center gap-2 ${
      active
        ? 'text-[#333333] dark:text-neutral-200 font-bold'
        : 'text-[#93a1a1] hover:text-[#586e75] dark:text-neutral-400 dark:hover:text-neutral-200'
    }`}>
    {Icon && (
      <Icon
        size={14}
        className={active ? 'text-[#333333] dark:text-neutral-200' : 'text-[#93a1a1] dark:text-neutral-400'}
      />
    )}
    <span>{label}</span>
    {active && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#333333] dark:bg-neutral-200 rounded-t-full shadow-[0_-1px_4px_rgba(0,0,0,0.1)]" />
    )}
  </button>
);

export { TabButton };

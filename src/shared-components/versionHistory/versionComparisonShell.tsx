import React from 'react';

export interface VersionComparisonShellProps {
  children?: React.ReactNode;
  previousHeading?: string;
  currentHeading?: string;
  className?: string;
}

export const VersionComparisonShell: React.FC<VersionComparisonShellProps> = ({
  children,
  previousHeading = 'PREVIOUS VERSION',
  currentHeading = 'CURRENT VERSION',
  className = '',
}) => {
  return (
    <div className={`flex-1 flex flex-col min-h-0 border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-xl overflow-hidden bg-[var(--color-editorBg,#171821)] ${className}`}>
      {/* Universal 2-Column Heading Header */}
      <div className="px-4 py-2.5 bg-[var(--color-panelBg,#0c0c0c)] border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))] grid grid-cols-2 gap-4 text-xs font-semibold text-[var(--color-textMuted,#737373)] uppercase tracking-wider shrink-0 select-none">
        <div className="flex items-center gap-1.5">{previousHeading}</div>
        <div className="flex items-center gap-1.5">{currentHeading}</div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

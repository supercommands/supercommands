import React from 'react';
import { FiPlus, FiMinus, FiArrowUpRight, FiCheck } from 'react-icons/fi';

export interface VersionChangeColorGuideProps {
  className?: string;
  showMoved?: boolean;
}

export const VersionChangeColorGuide: React.FC<VersionChangeColorGuideProps> = ({ className = '', showMoved = true }) => {
  return (
    <div className={`flex items-center gap-3 text-xs font-medium select-none ${className}`}>
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-diffAddedBorder,rgba(16,185,129,0.3))] bg-[var(--color-diffAddedBg,rgba(16,185,129,0.15))] text-[var(--color-diffAddedText,#34D399)]">
        <FiPlus className="stroke-[3]" size={12} />
        <span>Added</span>
      </span>

      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-diffRemovedBorder,rgba(239,68,68,0.3))] bg-[var(--color-diffRemovedBg,rgba(239,68,68,0.15))] text-[var(--color-diffRemovedText,#F87171)]">
        <FiMinus className="stroke-[3]" size={12} />
        <span>Removed</span>
      </span>

      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-diffModifiedBorder,rgba(245,158,11,0.3))] bg-[var(--color-diffModifiedBg,rgba(245,158,11,0.15))] text-[var(--color-diffModifiedText,#FBBF24)]">
        <span className="font-bold text-[11px]">Δ</span>
        <span>Changed</span>
      </span>

      {showMoved && (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-diffMovedBorder,rgba(59,130,246,0.3))] bg-[var(--color-diffMovedBg,rgba(59,130,246,0.15))] text-[var(--color-diffMovedText,#60A5FA)]">
          <FiArrowUpRight size={12} />
          <span>Moved</span>
        </span>
      )}

      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] bg-[var(--color-inputBg,rgba(255,255,255,0.03))] text-[var(--color-textMuted,#737373)]">
        <FiCheck size={12} />
        <span>Unchanged</span>
      </span>
    </div>
  );
};

export const DiffLegend = VersionChangeColorGuide;
export type DiffLegendProps = VersionChangeColorGuideProps;

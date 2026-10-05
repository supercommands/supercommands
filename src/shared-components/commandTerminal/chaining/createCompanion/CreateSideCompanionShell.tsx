import * as React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
export type CreateSideCompanionShellProps = {
    altsTone?: string;
    altsPaletteStyle?: React.CSSProperties;
    className?: string;
    title?: string;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    onSave?: () => void;
    onSaveAndCreateAnother?: () => void;
    onCancel?: () => void;
    children: React.ReactNode;
};
export const CreateSideCompanionShell: React.FC<CreateSideCompanionShellProps> = ({ altsTone, altsPaletteStyle, className, title = 'Config', primaryActionLabel, secondaryActionLabel, onSave, onSaveAndCreateAnother, onCancel, children, }) => (<motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15, ease: 'easeOut' }} data-create-side-companion-shell data-alts-tone={altsTone} onKeyDownCapture={event => {
        if (event.key !== 'Enter' || event.altKey || !(event.ctrlKey || event.metaKey))
            return;
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        if (event.shiftKey) {
            onSaveAndCreateAnother?.();
            return;
        }
        onSave?.();
    }} className={clsx('z-[2] flex flex-col absolute left-full top-0 bottom-0 w-[336px] overflow-hidden border border-l-0 border-[var(--alts-border-color)] rounded-r-[12px] rounded-l-none shadow-none bg-[var(--alts-glass-popup-bg)] transition-all duration-200', className)} style={{
        ...altsPaletteStyle,
        backgroundColor: 'var(--alts-glass-popup-bg)',
        color: 'var(--alts-text-primary)',
        boxShadow: 'var(--alts-popup-shadow)',
        backdropFilter: 'var(--glass-blur, blur(12px) saturate(1.5))',
        WebkitBackdropFilter: 'var(--glass-blur, blur(12px) saturate(1.5))',
    }}>
    <div className="h-[54px] shrink-0 flex items-center px-4 border-b border-[var(--alts-divider-color)] bg-[var(--alts-glass-search-bg)]">
      <span className="text-[13px] font-[650] leading-none text-[var(--alts-text-primary)]">
        {title}
      </span>
    </div>
    <div className="alts-companion-scroll custom-scrollbar flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3.5 gap-4" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--alts-scrollbar-thumb) var(--alts-scrollbar-track)',
        overscrollBehavior: 'contain',
    }}>
      {children}
    </div>
    {(primaryActionLabel || secondaryActionLabel || onCancel) ? (<div className="shrink-0 flex items-center justify-end gap-2 border-t border-[var(--alts-divider-color)] bg-[var(--alts-glass-search-bg)] px-4 py-3">
        {secondaryActionLabel || onCancel ? (<button type="button" onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onCancel?.();
            }} className="inline-flex h-8 items-center justify-center rounded-[7px] border border-[var(--alts-border-color)] bg-transparent px-3 text-[12px] font-[600] text-[var(--alts-text-secondary)] transition-colors hover:bg-[var(--alts-row-hover-bg)] hover:text-[var(--alts-text-primary)]">
            {secondaryActionLabel || 'Cancel'}
          </button>) : null}
        {primaryActionLabel ? (<button type="button" onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onSave?.();
            }} className="inline-flex h-8 items-center justify-center rounded-[7px] border border-[var(--alts-focus-color,var(--color-primary))] bg-[var(--alts-focus-color,var(--color-primary))] px-3 text-[12px] font-[650] text-[var(--alts-popup-bg)] transition-opacity hover:opacity-90">
            {primaryActionLabel}
          </button>) : null}
      </div>) : null}
  </motion.div>);

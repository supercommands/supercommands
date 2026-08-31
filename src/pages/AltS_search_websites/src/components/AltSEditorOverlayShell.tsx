import type * as React from 'react';

type AltSEditorOverlayShellProps = {
  ariaLabel: string;
  children: React.ReactNode;
  onClose: () => void;
  appearanceTokens?: React.CSSProperties;
  width?: string;
  height?: string;
  padding?: string;
  className?: string;
};

export const AltSEditorOverlayShell: React.FC<AltSEditorOverlayShellProps> = ({
  ariaLabel,
  children,
  onClose,
  appearanceTokens,
  width = 'min(760px, calc(100vw - 32px))',
  height = 'calc(64px + min(400px, calc(100vh - 144px)))',
  padding = '1rem',
  className = '',
}) => (
  <>
    <button
      type="button"
      aria-label={ariaLabel}
      className="fixed inset-0 z-0 h-full w-full appearance-none border-0 p-0"
      style={{ backgroundColor: 'color-mix(in srgb, var(--alts-popup-bg) 42%, transparent)' }}
      onClick={onClose}
    />
    <div
      className={`alts-popup-root relative z-[1] flex flex-col overflow-hidden rounded-[8px] border bg-[var(--alts-popup-bg)] font-['Inter',_sans-serif] text-[14px] leading-normal text-left text-[var(--color-textPrimary)] antialiased box-border m-0 ${className}`}
      style={{
        ...appearanceTokens,
        width,
        height,
        padding,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: height,
        backgroundColor: 'var(--alts-popup-bg)',
        borderColor: 'color-mix(in srgb, var(--alts-border-color) 30%, transparent)',
        boxShadow: 'var(--alts-popup-shadow)',
      }}
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  </>
);

export default AltSEditorOverlayShell;

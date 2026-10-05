import type { CSSProperties } from 'react';

/** Shared screenshot/DOM outline; callers own coordinates and selection semantics. */
export function PageSelectionOutline({ style, hovering = false }: { style: CSSProperties; hovering?: boolean }) {
  return <div className="website-popup-screenshot-selection__rect" aria-hidden="true" style={{
    ...style,
    ...(hovering ? { outlineColor: 'var(--color-altsFocusColor)' } : {}),
  }}/>;
}

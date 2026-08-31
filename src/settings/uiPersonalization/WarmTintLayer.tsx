import * as React from 'react';
import { useEffect } from 'react';
import { useAppearance, calculateWarmTintOpacity } from '@extension/ui';

export const WarmTintLayer: React.FC = () => {
  const { theme, warmTintStrength } = useAppearance();

  const color = theme?.warmTint?.color || '#FFD98A';
  const registeredMaxOpacity = theme?.warmTint?.opacity ?? 0.10;
  const effectiveOpacity = calculateWarmTintOpacity(registeredMaxOpacity, warmTintStrength);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    root.style.setProperty('--appearance-warm-tint-color', color);
    root.style.setProperty('--appearance-warm-tint-opacity', String(effectiveOpacity));
    root.dataset.warmTint = 'enabled';
  }, [color, effectiveOpacity]);

  return null;
};

export default WarmTintLayer;


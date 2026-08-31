import type { WidgetInstance } from '../widgetDashboard.types';

export type WidgetWidthTier = 'narrow' | 'medium' | 'wide';
export type WidgetHeightTier = 'short' | 'tall' | 'extraTall';

export interface WidgetLayoutInfo {
  widthTier: WidgetWidthTier;
  heightTier: WidgetHeightTier;
  gridWidth: number;
  gridHeight: number;
  isCustomSize: boolean;
  isNarrow: boolean;
  isMediumWidth: boolean;
  isWide: boolean;
  isShort: boolean;
  isTall: boolean;
  isExtraTall: boolean;
}

export function getWidgetLayoutInfo(
  gridWidth: number = 4,
  gridHeight: number = 5,
  isCustomSize: boolean = false,
): WidgetLayoutInfo {
  const widthTier: WidgetWidthTier = gridWidth <= 4 ? 'narrow' : gridWidth <= 8 ? 'medium' : 'wide';
  const heightTier: WidgetHeightTier = gridHeight <= 5 ? 'short' : gridHeight <= 10 ? 'tall' : 'extraTall';

  return {
    widthTier,
    heightTier,
    gridWidth,
    gridHeight,
    isCustomSize,
    isNarrow: widthTier === 'narrow',
    isMediumWidth: widthTier === 'medium',
    isWide: widthTier === 'wide',
    isShort: heightTier === 'short',
    isTall: heightTier === 'tall',
    isExtraTall: heightTier === 'extraTall',
  };
}

export function deriveLayoutInfoFromWidget(
  widget: WidgetInstance,
  gridPos?: { w?: number; h?: number },
): WidgetLayoutInfo {
  const w = gridPos?.w ?? widget.customSize?.w ?? (widget.sizePreset === 'large' ? 12 : widget.sizePreset === 'medium' ? 8 : 4);
  const h = gridPos?.h ?? widget.customSize?.h ?? 5;
  const isCustomSize = Boolean(widget.customSize);
  return getWidgetLayoutInfo(w, h, isCustomSize);
}

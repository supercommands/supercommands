export const MIN_WARM_TINT_STRENGTH = 0;
export const DEFAULT_WARM_TINT_STRENGTH = 10;
export const MAX_WARM_TINT_STRENGTH = 100;

export function normalizeWarmTintStrength(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return DEFAULT_WARM_TINT_STRENGTH;
  }
  const rounded = Math.round(value);
  return Math.min(MAX_WARM_TINT_STRENGTH, Math.max(MIN_WARM_TINT_STRENGTH, rounded));
}

export function calculateWarmTintOpacity(registeredMaximumOpacity: unknown, strengthInput: unknown): number {
  if (
    typeof registeredMaximumOpacity !== 'number' ||
    !Number.isFinite(registeredMaximumOpacity) ||
    Number.isNaN(registeredMaximumOpacity) ||
    registeredMaximumOpacity < 0
  ) {
    return 0;
  }

  const validMaxOpacity = Math.min(1, registeredMaximumOpacity);
  const normalizedStrength = normalizeWarmTintStrength(strengthInput);

  const rawOpacity = (validMaxOpacity * normalizedStrength) / 100;
  if (!Number.isFinite(rawOpacity) || Number.isNaN(rawOpacity)) {
    return 0;
  }

  return Math.min(validMaxOpacity, Math.max(0, rawOpacity));
}

import type { UsageLevel } from '../types';

export function getUsageLevel(total: number): UsageLevel {
  if (total <= 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  if (total <= 10) return 3;
  return 4;
}

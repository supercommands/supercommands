export type SessionLaunchPacing = {
  immediateCount: number;
  batchSize: number;
  delayMs: number;
};

export function getSessionLaunchPacing(totalUrls: number): SessionLaunchPacing {
  if (totalUrls < 12) {
    return { immediateCount: totalUrls, batchSize: totalUrls || 1, delayMs: 0 };
  }
  if (totalUrls <= 20) return { immediateCount: 6, batchSize: 4, delayMs: 450 };
  if (totalUrls <= 30) return { immediateCount: 6, batchSize: 4, delayMs: 600 };
  if (totalUrls <= 40) return { immediateCount: 5, batchSize: 4, delayMs: 750 };
  return { immediateCount: 5, batchSize: 3, delayMs: 900 };
}

export function getDelayBeforeSessionTabCreate(nextIndex: number, pacing: SessionLaunchPacing): number {
  if (pacing.delayMs <= 0 || nextIndex < pacing.immediateCount) return 0;
  const remainingIndex = nextIndex - pacing.immediateCount;
  return remainingIndex % pacing.batchSize === 0 ? pacing.delayMs : 0;
}

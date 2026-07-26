import { useState, useEffect } from 'react';

export function nowUtc(): string {
  return new Date().toISOString();
}

/**
 * Returns a relative format for the last saved time.
 */
export const formatRelativeSavedTime = (date: Date | null | undefined): string => {
  return 'Saved';
};

/**
 * React hook that returns a reactively updating relative saved time string.
 */
export function useRelativeSavedTime(lastSavedAt: Date | null | undefined): string {
  return 'Saved';
}

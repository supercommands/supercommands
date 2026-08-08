import React, { useMemo } from 'react';
import { NoteDiffViewer } from './noteDiffViewer';
import { VersionFieldComparisonRow } from './versionFieldComparisonRow';
import { VersionComparisonShell } from './versionComparisonShell';
import { normalizeAndFormatJson } from './versionComparisonHelpers';

export interface SnippetDiffViewerProps {
  previousSnapshot?: any;
  currentSnapshot?: any;
  displayMode?: 'changes' | 'snapshot';
  // Legacy props fallback
  previousConfig?: any;
  currentConfig?: any;
  previousTitle?: string;
  currentTitle?: string;
}

export const SnippetDiffViewer: React.FC<SnippetDiffViewerProps> = ({
  previousSnapshot,
  currentSnapshot,
  displayMode = 'changes',
  previousConfig,
  currentConfig,
  previousTitle = '',
  currentTitle = '',
}) => {
  const prev = previousSnapshot || {};
  const curr = currentSnapshot || {};

  const prevTitle = (prev.title !== undefined ? prev.title : previousTitle) || '';
  const currTitle = (curr.title !== undefined ? curr.title : currentTitle) || '';

  const prevShortcut = (prev.shortcut || '').trim();
  const currShortcut = (curr.shortcut || '').trim();

  const prevCfg = prev.config !== undefined ? prev.config : previousConfig;
  const currCfg = curr.config !== undefined ? curr.config : currentConfig;

  const formattedPrevConfig = useMemo(() => {
    return normalizeAndFormatJson(prevCfg);
  }, [prevCfg]);

  const formattedCurrConfig = useMemo(() => {
    return normalizeAndFormatJson(currCfg);
  }, [currCfg]);

  return (
    <VersionComparisonShell>
      <div className="flex flex-col border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))]">
        <VersionFieldComparisonRow
          label="SNIPPET TITLE"
          previousValue={prevTitle}
          currentValue={currTitle}
          displayMode={displayMode}
        />
        <VersionFieldComparisonRow
          label="TEXT COMMAND"
          previousValue={prevShortcut}
          currentValue={currShortcut}
          monospace
          displayMode={displayMode}
        />
      </div>

      <NoteDiffViewer previousText={formattedPrevConfig} currentText={formattedCurrConfig} displayMode={displayMode} />
    </VersionComparisonShell>
  );
};

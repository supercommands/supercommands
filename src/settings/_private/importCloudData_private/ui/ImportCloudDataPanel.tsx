import * as React from 'react';

export const ImportCloudDataPanel: React.FC = () => {
  return (
    <div className="space-y-6 px-6 pb-6 text-[var(--color-textPrimary)] select-none">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Import Cloud Data</h2>
        <p className="text-xs text-[var(--color-textSecondary)]">
          Cloud database import features are not available in the open-source version.
        </p>
      </div>
    </div>
  );
};

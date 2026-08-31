import React, { useState } from 'react';
import { LuBot } from 'react-icons/lu';
import { getFaviconUrl } from '../searchBarMain/utilityFunctions/utils';
import type { AiModelTarget } from '../../allObjectFolder/src/createObject/aiPrompt';

const SingleFavicon: React.FC<{ host: string; size?: number }> = ({ host, size = 28 }) => {
  const [hasError, setHasError] = useState(false);
  const iconSrc = !hasError && host ? getFaviconUrl(`https://${host}`) : '';

  if (!iconSrc || hasError) {
    return <LuBot size={size * 0.75} className="shrink-0 text-[var(--color-textMuted)]" />;
  }

  return (
    <img
      src={iconSrc}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-contain"
      onError={() => setHasError(true)}
    />
  );
};

type StackConfig = {
  iconSize: number;
  step: number;
};

const DEFAULT_STACK_CONFIG: Record<number, StackConfig> = {
  2: { iconSize: 22, step: 13 },
  3: { iconSize: 19, step: 9.5 },
  4: { iconSize: 17, step: 7.5 },
};

const COMPACT_STACK_CONFIG: Record<number, StackConfig> = {
  2: { iconSize: 18, step: 11 },
  3: { iconSize: 16, step: 9 },
  4: { iconSize: 15, step: 8 },
};

const SIZE_CONFIG = {
  default: { containerWidth: 40, containerHeight: 40, botSize: 24 },
  compact: { containerWidth: 40, containerHeight: 28, botSize: 20 },
};

const CircularModelStackIcon: React.FC<{
  models: AiModelTarget[];
  isLoading?: boolean;
  variant?: 'default' | 'compact';
  maxVisible?: number;
}> = ({ models, isLoading = false, variant = 'default', maxVisible }) => {
  const sizeConfig = SIZE_CONFIG[variant];

  if (isLoading) {
    return <LuBot size={sizeConfig.botSize} className="text-[var(--color-textMuted)] opacity-50" />;
  }

  if (models.length === 0) {
    return <LuBot size={sizeConfig.botSize} className="text-[var(--color-textMuted)]" />;
  }

  if (models.length === 1) {
    return <SingleFavicon host={models[0].host} size={variant === 'compact' ? 20 : 28} />;
  }

  const limit = maxVisible ?? (variant === 'compact' ? 3 : 4);
  const visibleModels = models.slice(0, limit);
  const count = visibleModels.length;
  const remainingCount = Math.max(0, models.length - limit);
  const configs = variant === 'compact' ? COMPACT_STACK_CONFIG : DEFAULT_STACK_CONFIG;
  const config = configs[count] || configs[limit] || configs[3];
  const totalWidth = config.iconSize + config.step * (count - 1);
  const startLeft = (sizeConfig.containerWidth - totalWidth) / 2;
  const top = (sizeConfig.containerHeight - config.iconSize) / 2;
  const containerClasses =
    variant === 'compact'
      ? 'relative flex h-7 w-10 shrink-0 items-center overflow-visible'
      : 'relative flex h-full w-full items-center justify-center overflow-visible';

  return (
    <div className={containerClasses}>
      {visibleModels.map((model, idx) => {
        const left = startLeft + idx * config.step;
        return (
          <div
            key={model.id || idx}
            className="absolute flex shrink-0 items-center justify-center rounded-full bg-[var(--color-inputBg,#18181b)] border border-white/20 ring-1 ring-black/50 shadow-md"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${config.iconSize}px`,
              height: `${config.iconSize}px`,
              zIndex: idx + 1,
            }}>
            <SingleFavicon host={model.host} size={Math.max(10, config.iconSize - 2)} />
          </div>
        );
      })}
      {remainingCount > 0 && (
        <span
          className={
            variant === 'compact'
              ? 'absolute -right-1 -top-1 z-20 rounded-full border border-white/20 bg-neutral-800 px-0.5 text-[7px] font-bold tabular-nums text-white shadow-xs'
              : 'absolute right-0 top-0 z-20 rounded-full border border-white/20 bg-neutral-800 px-1 text-[8px] font-bold tabular-nums text-white shadow-xs'
          }>
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

export default CircularModelStackIcon;

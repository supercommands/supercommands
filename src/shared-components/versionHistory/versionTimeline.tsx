import React, { useMemo } from 'react';
import { FiClock } from 'react-icons/fi';

export interface TimelineVersionItem {
  id: string;
  label: string;
  savedAt?: number;
  isCurrent?: boolean;
}

export interface VersionTimelineProps {
  items: TimelineVersionItem[];
  selectedId: string;
  onSelectVersion: (id: string) => void;
  isDraftUnsaved?: boolean;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
  items,
  selectedId,
  onSelectVersion,
  isDraftUnsaved = false,
}) => {
  const historicalItems = useMemo(() => items.filter(i => !i.isCurrent), [items]);

  const groupedVersions = useMemo(() => {
    const groups: Array<{ groupLabel: string; items: TimelineVersionItem[] }> = [];

    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groupMap = new Map<string, TimelineVersionItem[]>();

    historicalItems.forEach(item => {
      let groupName = 'Today';
      if (item.savedAt) {
        const itemDateStr = new Date(item.savedAt).toDateString();
        if (itemDateStr === todayStr) {
          groupName = 'Today';
        } else if (itemDateStr === yesterdayStr) {
          groupName = 'Yesterday';
        } else {
          groupName = new Date(item.savedAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      }

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(item);
    });

    groupMap.forEach((groupItems, groupLabel) => {
      groups.push({ groupLabel, items: groupItems });
    });

    return groups;
  }, [historicalItems]);

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectVersion(id);
    }
  };

  const isCurrentSelected = selectedId === 'current';

  return (
    <aside className="w-[280px] shrink-0 border-l border-[var(--color-borderDefault,rgba(255,255,255,0.1))] bg-[var(--color-sidebarBg,#080808)] flex flex-col min-h-0 select-none">
      <div className="px-4 py-3 border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))] text-xs font-bold text-[var(--color-textMuted,#737373)] uppercase tracking-wider flex items-center justify-between">
        <span>TIMELINE</span>
        <span className="text-[10px] font-normal text-[var(--color-textMuted,#737373)]">
          {historicalItems.length} {historicalItems.length === 1 ? 'checkpoint' : 'checkpoints'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4">
        {/* Fixed Current Comparison Baseline Card */}
        <div className="flex flex-col gap-1.5">
          <div className="px-2 text-[10px] font-bold text-[var(--color-textMuted,#737373)] uppercase tracking-wider">
            Baseline
          </div>
          <button
            type="button"
            onClick={() => onSelectVersion('current')}
            onKeyDown={e => handleKeyDown(e, 'current')}
            tabIndex={0}
            className={`w-full text-left p-3 rounded-lg border text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
              isCurrentSelected
                ? 'border-[var(--color-borderDefault,rgba(255,255,255,0.3))] bg-[var(--color-inputBg,rgba(255,255,255,0.06))] text-[var(--color-textPrimary,#FFFFFF)] font-semibold'
                : 'border-transparent bg-transparent text-[var(--color-textSecondary,#D4D4D4)] hover:bg-[var(--color-hoverBg,rgba(255,255,255,0.05))]'
            } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive,#3b82f6)]`}>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-textPrimary,#FFFFFF)]">
              <FiClock size={13} className={isCurrentSelected ? 'text-[var(--color-textPrimary,#FFFFFF)]' : 'text-[var(--color-textMuted,#737373)]'} />
              <span>{isDraftUnsaved ? 'Current Draft' : 'Current Version'}</span>
            </div>
            <div className="text-[11px] text-[var(--color-textMuted,#737373)] pl-5 font-normal">Current baseline</div>
          </button>
        </div>

        {/* Historical Checkpoints */}
        {historicalItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-textMuted,#737373)]">No saved checkpoints recorded yet</div>
        ) : (
          groupedVersions.map(group => (
            <div key={group.groupLabel} className="flex flex-col gap-1.5">
              <div className="px-2 text-[10px] font-bold text-[var(--color-textMuted,#737373)] uppercase tracking-wider">
                {group.groupLabel}
              </div>

              {group.items.map(item => {
                const isSelected = selectedId === item.id;

                const timeStr = item.savedAt
                  ? new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : undefined;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectVersion(item.id)}
                    onKeyDown={e => handleKeyDown(e, item.id)}
                    tabIndex={0}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-colors cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-[var(--color-borderDefault,rgba(255,255,255,0.3))] bg-[var(--color-inputBg,rgba(255,255,255,0.06))] text-[var(--color-textPrimary,#FFFFFF)] font-semibold'
                        : 'border-transparent bg-transparent text-[var(--color-textSecondary,#D4D4D4)] hover:bg-[var(--color-hoverBg,rgba(255,255,255,0.05))]'
                    } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive,#3b82f6)]`}>
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--color-textPrimary,#FFFFFF)]">
                      <FiClock size={13} className={isSelected ? 'text-[var(--color-textPrimary,#FFFFFF)]' : 'text-[var(--color-textMuted,#737373)]'} />
                      <span>{item.label}</span>
                    </div>

                    {timeStr && (
                      <div className="text-[11px] text-[var(--color-textMuted,#737373)] pl-5 font-normal">
                        {timeStr}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

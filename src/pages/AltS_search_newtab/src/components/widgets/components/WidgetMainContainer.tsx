import { useRef } from 'react';
import type * as React from 'react';
import 'react-grid-layout/css/styles.css';
import WidgetDashboard from './WidgetDashboard';
import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

/**
 * Placeholder for the future isolated widget main container.
 *
 * Current contract:
 * - It must remain a sibling of existing main views, never a wrapper around them.
 * - It must not wrap or alter BoardView, SpreadsheetMainContainer, Searchbar, editors, popups, or modals.
 * - Future rendering must be guarded so it is hidden whenever board view, sheet view, editors, prompts,
 *   links, notes, AI/agent panels, settings, tutorial, embedded mode, or search suggestions are active.
 */
interface WidgetMainContainerProps {
  isEditMode?: boolean;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const WidgetMainContainer: React.FC<WidgetMainContainerProps> = ({ isEditMode = false, onQuickCommandSelect }) => {
  const scrollContainerRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={scrollContainerRef}
      className="w-full h-full min-h-0 max-h-full flex flex-col relative box-border overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar dark-scrollbar"
      data-widget-main-container="true">
      <WidgetDashboard scrollContainerRef={scrollContainerRef} isEditMode={isEditMode} onQuickCommandSelect={onQuickCommandSelect} />
    </section>
  );
};

export default WidgetMainContainer;

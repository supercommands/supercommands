import * as React from 'react';
import { useState } from 'react';
import { EditorContainer } from './EditorContainer';
import { EditorHeader } from './EditorHeader';
import DeleteConfirmation from '../modals/deleteDialog';
import UnsavedChangesDialog from '../modals/unsavedChangesDialog';
import { useUIStore } from '../uiStateManager';

export interface WorkspaceEditorLayoutProps {
  // Title & Header Information
  title: string;
  isDirty?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'success';
  lastSavedAt?: Date | null;
  activeId?: string | null;
  isDuplicateTitle?: boolean;
  headerActions?: React.ReactNode;

  // Actions
  onSave?: () => Promise<boolean> | boolean;
  onDiscard?: () => void;
  onCloseCallback?: () => void;

  // Render Slots
  children: React.ReactNode; // Left side workspace main content
  rightColumnContent?: React.ReactNode; // Right side properties toolbar
  rightColumnHeaderExtra?: React.ReactNode; // Extra controls in right column header
  
  // Bottom List Search & Content
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  searchPlaceholder?: string;
  bottomListContent?: React.ReactNode;

  // Modals & Dialogs props
  deleteModalProps?: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
  };

  // Layout View Flags
  isFocusMode?: boolean;
  showAutoSaveStatus?: boolean;
  showConfigureHeader?: boolean;
  hideRightColumnBorder?: boolean;
  headerRightPaddingClass?: string;
  rightColumnWidthClass?: string;
  containerMaxWidthClass?: string;
  allowMainContentOverflow?: boolean;
  // Optional Right Sibling Panel (Full height column next to main container)
  rightSiblingPanel?: React.ReactNode;
  isRightSiblingExpanded?: boolean;
}

export const WorkspaceEditorLayout: React.FC<WorkspaceEditorLayoutProps> = ({
  title,
  isDirty = false,
  saveStatus = 'idle',
  lastSavedAt,
  activeId,
  isDuplicateTitle = false,
  headerActions,
  onSave,
  onDiscard,
  onCloseCallback,
  children,
  rightColumnContent,
  rightColumnHeaderExtra,
  searchQuery,
  setSearchQuery,
  searchPlaceholder = 'Search...',
  bottomListContent,
  deleteModalProps,
  isFocusMode = false,
  showAutoSaveStatus = true,
  showConfigureHeader = false,
  hideRightColumnBorder = false,
  headerRightPaddingClass = '',
  rightColumnWidthClass = 'w-[260px]',
  containerMaxWidthClass = 'max-w-[1200px]',
  allowMainContentOverflow = false,
  rightSiblingPanel,
  isRightSiblingExpanded = false,
}) => {
  const [isUnsavedChangesOpen, setIsUnsavedChangesOpen] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);

  const handleClose = () => {
    if (isDirty) {
      setIsUnsavedChangesOpen(true);
    } else {
      triggerClose();
    }
  };

  const triggerClose = () => {
    useUIStore.getState().closeEditor();
    if (onCloseCallback) {
      onCloseCallback();
    }
  };

  const renderedBottomListContent = React.useMemo(() => {
    if (React.isValidElement(bottomListContent)) {
      const origCallback = (bottomListContent.props as any)?.onCollapseStateChange;
      return React.cloneElement(bottomListContent as React.ReactElement<any>, {
        searchQuery,
        setSearchQuery,
        searchPlaceholder,
        onCollapseStateChange: (collapsed: boolean) => {
          setIsTableCollapsed(collapsed);
          if (origCallback) origCallback(collapsed);
        },
      });
    }
    return bottomListContent;
  }, [bottomListContent, searchQuery, setSearchQuery, searchPlaceholder]);

  const renderedRightSiblingPanel = React.useMemo(() => {
    if (React.isValidElement(rightSiblingPanel)) {
      const existingOnClose = (rightSiblingPanel.props as any)?.onCloseClick;
      return React.cloneElement(rightSiblingPanel as React.ReactElement<any>, {
        onCloseClick: existingOnClose || handleClose,
      });
    }
    return rightSiblingPanel;
  }, [rightSiblingPanel, handleClose]);

  if (rightSiblingPanel) {
    return (
      <EditorContainer
        className="w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-6 md:px-12 lg:px-24 py-4"
        innerClassName="flex flex-col relative bg-[var(--color-editorBg)] mx-auto rounded-xl min-h-[450px] h-auto max-h-[860px] max-h-[90vh] overflow-hidden border border-[var(--color-borderDefault)] w-[calc(100%-20px)] max-w-[1800px]"
      >
        <div className="flex-1 flex flex-row items-stretch min-h-0 relative w-full overflow-hidden">
          {/* Column 1: Left Workspace (Header + Title + Content) */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            <EditorHeader
              title={title}
              isDirty={isDirty}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              activeId={activeId}
              isDuplicateTitle={isDuplicateTitle}
              onCloseClick={handleClose}
              showCloseButton={false}
              headerActions={headerActions}
              showAutoSaveStatus={showAutoSaveStatus}
              headerRightPaddingClass={headerRightPaddingClass}
            />
            <div className="flex-1 flex flex-col min-h-0 relative px-3 pt-0.5 pb-2 overflow-hidden">
              <div className="flex-1 flex flex-col min-h-0 relative">
                {children}
              </div>
            </div>
          </div>

          {/* Column 2: Middle Column (Configure Toolbar / Conversational Models Links) */}
          {rightColumnContent && !isRightSiblingExpanded && (
            <div className={`${rightColumnWidthClass} h-full max-h-full flex-shrink-0 flex-col bg-transparent overflow-y-auto custom-scrollbar transition-all duration-300 hidden lg:flex pl-4 pt-2 pb-4 pr-1 ${hideRightColumnBorder ? '' : 'border-l border-[var(--color-borderDefault)]'}`}>
              {showConfigureHeader && (
                <div className="flex items-center justify-between pb-1 shrink-0 px-2">
                  <h3 className="text-xs font-normal text-[var(--color-textSecondary)] opacity-95 flex items-center gap-2">
                    <span className="whitespace-nowrap">Configure</span>
                  </h3>
                  {rightColumnHeaderExtra}
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-visible flex flex-col gap-3 mt-1 pr-1">
                {rightColumnContent}
              </div>
            </div>
          )}

          {/* Column 3: Right Side Items Panel (Attached directly without gap/border wrapper) */}
          {renderedRightSiblingPanel}
        </div>

        {/* standard modal dialogs */}
        {deleteModalProps && deleteModalProps.isOpen && (
          <DeleteConfirmation
            isOpen={deleteModalProps.isOpen}
            onClose={deleteModalProps.onClose}
            onConfirm={deleteModalProps.onConfirm}
            title={deleteModalProps.title || 'Delete this item?'}
            description={deleteModalProps.description || 'Are you sure you want to delete this item? This action cannot be undone.'}
            zIndex={100005}
          />
        )}

        {isUnsavedChangesOpen && (
          <UnsavedChangesDialog
            isOpen={isUnsavedChangesOpen}
            onClose={() => setIsUnsavedChangesOpen(false)}
            onSave={async () => {
              if (onSave) {
                const saved = await onSave();
                if (saved) {
                  setIsUnsavedChangesOpen(false);
                  triggerClose();
                }
                return saved;
              }
              return false;
            }}
            onDiscard={() => {
              setIsUnsavedChangesOpen(false);
              if (onDiscard) {
                onDiscard();
              }
              triggerClose();
            }}
            zIndex={9999}
          />
        )}
      </EditorContainer>
    );
  }

  return (
    <EditorContainer
      className="w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-6 md:px-12 lg:px-24 py-4"
      innerClassName={`flex flex-col relative w-[calc(100%-100px)] bg-[var(--color-editorBg)] ${containerMaxWidthClass} mx-auto rounded-xl ${isTableCollapsed ? 'h-auto max-h-[520px]' : 'h-[860px] max-h-[90vh]'} overflow-hidden transition-all duration-300 ${isFocusMode ? 'border-none' : 'border border-[var(--color-borderDefault)]'}`}
    >
      {/* Main Columns System */}
      <div className={`shrink-0 flex-none flex flex-col ${allowMainContentOverflow ? 'h-auto min-h-[440px] pb-[260px] overflow-visible' : 'h-[440px] overflow-hidden'}`}>
        <div className={`flex-1 flex flex-col text-[var(--color-textPrimary)] relative bg-transparent border-none min-h-0 ${allowMainContentOverflow ? 'overflow-visible' : 'overflow-hidden'}`}>
          
          {/* Standard Header Row */}
          <EditorHeader
            title={title}
            isDirty={isDirty}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            activeId={activeId}
            isDuplicateTitle={isDuplicateTitle}
            onCloseClick={handleClose}
            headerActions={headerActions}
            showAutoSaveStatus={showAutoSaveStatus}
            headerRightPaddingClass={headerRightPaddingClass}
          />

          {/* Split Panel Area */}
          <div className="flex-1 flex min-h-0 relative h-full max-h-full">
            {/* Left Column Workspace */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
              {children}
            </div>

            {/* Right Column Properties Panel */}
            {rightColumnContent && (
              <div className={`${rightColumnWidthClass} h-full max-h-full flex-shrink-0 flex-col bg-transparent overflow-visible hidden lg:flex pl-4 pt-2 pb-4 pr-1 ${hideRightColumnBorder ? '' : 'border-l border-[var(--color-borderDefault)]'}`}>
                {showConfigureHeader && (
                  <div className="flex items-center justify-between pb-1 shrink-0 px-2">
                    <h3 className="text-xs font-normal text-[var(--color-textSecondary)] opacity-70 flex items-center gap-2">
                      <span className="whitespace-nowrap">Configure</span>
                    </h3>
                    {rightColumnHeaderExtra}
                  </div>
                )}
                <div className="flex-1 min-h-0 overflow-visible flex flex-col gap-3 mt-1 pr-1">
                  {rightColumnContent}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Hoisted Bottom list container */}
      {bottomListContent && (
        <>
          {/* Horizontal Divider to fix overlap */}
          <div className="h-px w-full bg-white/10 shrink-0 my-1" />

          {/* Table Wrapper */}
          <div className={`transition-all duration-300 flex flex-col overflow-hidden pt-1 ${isTableCollapsed ? 'flex-none h-auto shrink-0 pb-2' : 'flex-1 basis-[45%] min-h-0'}`}>
            <div className={isTableCollapsed ? 'h-auto shrink-0 relative pb-2' : 'flex-1 min-h-0 flex flex-col relative'}>
              {renderedBottomListContent}
            </div>
          </div>
        </>
      )}

      {/* standard modal dialogs */}
      {deleteModalProps && deleteModalProps.isOpen && (
        <DeleteConfirmation
          isOpen={deleteModalProps.isOpen}
          onClose={deleteModalProps.onClose}
          onConfirm={deleteModalProps.onConfirm}
          title={deleteModalProps.title || 'Delete this item?'}
          description={deleteModalProps.description || 'Are you sure you want to delete this item? This action cannot be undone.'}
          zIndex={50}
        />
      )}

      {isUnsavedChangesOpen && (
        <UnsavedChangesDialog
          isOpen={isUnsavedChangesOpen}
          onClose={() => setIsUnsavedChangesOpen(false)}
          onSave={async () => {
            if (onSave) {
              const saved = await onSave();
              if (saved) {
                setIsUnsavedChangesOpen(false);
                triggerClose();
              }
              return saved;
            }
            return false;
          }}
          onDiscard={() => {
            setIsUnsavedChangesOpen(false);
            if (onDiscard) {
              onDiscard();
            }
            triggerClose();
          }}
          zIndex={9999}
        />
      )}
    </EditorContainer>
  );
};

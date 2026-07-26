import type React from 'react';
import type { Header } from '@tanstack/react-table';
import { clsx } from 'clsx';
import type { RowData, AutomationModuleRow } from '../types/spreadsheetTypes';

interface ResizerProps {
  header: Header<RowData | AutomationModuleRow, unknown>;
}

const Resizer: React.FC<ResizerProps> = ({ header }) => {
  return (
    <div
      {...{
        onMouseDown: header.getResizeHandler(),
        onTouchStart: header.getResizeHandler(),
        className: clsx(
          'resizer absolute right-0 top-[15px] bottom-0 w-[2px] cursor-col-resize select-none touch-none bg-blue-400 opacity-0 group-hover:opacity-100 transition-all z-[40]',
          header.column.getIsResizing() ? 'bg-blue-600 opacity-100 w-[3px]' : 'hover:w-[4px] hover:bg-blue-500',
        ),
      }}
    />
  );
};

export default Resizer;

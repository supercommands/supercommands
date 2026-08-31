import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { RowData, AutomationModuleRow } from '../types/spreadsheetTypes';

export const columns: ColumnDef<RowData | AutomationModuleRow>[] = [
  {
    header: '#',
    id: 'rowNumber',
    accessorKey: 'rowNumber' as any,
    size: 40,
    enableSorting: false,
  },
  {
    header: 'Type',
    id: 'type',
    accessorKey: 'category',
    size: 125,
  },
  {
    header: 'Title',
    id: 'name',
    accessorKey: 'name',
    size: 450,
  },
  {
    header: 'Description',
    id: 'url',
    accessorKey: 'url',
    size: 270,
  },
  {
    header: 'Command short',
    id: 'command',
    accessorKey: 'command',
    size: 150,
  },
  {
    header: 'Hotkey short',
    id: 'key',
    accessorKey: 'key',
    size: 110,
  },
  {
    header: 'Tags',
    id: 'tags',
    accessorKey: 'tags',
    size: 115,
  },
  {
    header: 'Actions',
    id: 'actions',
    accessorKey: 'id',
    size: 85,
    enableSorting: false,
  },
];

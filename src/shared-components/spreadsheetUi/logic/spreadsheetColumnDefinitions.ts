import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FaStar } from 'react-icons/fa';
import type { RowData, AutomationModuleRow } from '../types/spreadsheetTypes';

export const columns: ColumnDef<RowData | AutomationModuleRow>[] = [
  {
    header: 'Title',
    accessorKey: 'name',
    size: 150,
  },
  // {
  //   header: 'Edit / URL',
  //   accessorKey: 'url',
  //   size: 200,
  // },
  {
    header: 'Command',
    accessorKey: 'command',
    size: 135,
  },
  {
    header: 'Folder',
    accessorKey: 'folder',
    size: 70,
  },
  {
    header: 'Tags',
    accessorKey: 'tags',
    size: 100,
  },
  {
    header: 'Keyboard',
    accessorKey: 'key',
    size: 70,
  },
  {
    header: 'Favs',
    accessorKey: 'fav',
    id: 'fav',
    size: 70,
    enableSorting: false,
    sortingFn: 'basic',
  },
  {
    header: '',
    accessorKey: 'id',
    size: 35,
    enableSorting: false,
  },
];

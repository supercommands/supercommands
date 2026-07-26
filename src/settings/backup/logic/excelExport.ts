import * as XLSX from 'xlsx';
import { BackupData } from './extractData';

// Helper to strip HTML tags from a string
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  if (typeof html !== 'string') return String(html);
  // Basic regex to strip HTML tags
  return html.replace(/<[^>]*>?/gm, '').trim();
};

// Helper to auto-fit columns
const getColumnWidths = (headers: string[], dataRows: any[][]) => {
  const minWidth = 10;
  const widths = headers.map((h) => Math.max(minWidth, h.length));
  
  dataRows.forEach((row) => {
    row.forEach((cell, i) => {
      const cellString = cell !== null && cell !== undefined ? String(cell) : '';
      // limit max width to prevent excessively wide columns
      widths[i] = Math.min(100, Math.max(widths[i], cellString.length));
    });
  });

  return widths.map((w) => ({ wch: w + 2 })); // Add slight padding
};

export const generateExcelBackup = async (dbData: BackupData): Promise<Blob> => {
  const wb = XLSX.utils.book_new();

  for (const tableName of Object.keys(dbData.tables)) {
    const tableRecords = dbData.tables[tableName] || [];
    
    if (tableRecords.length === 0) {
      // Add an empty sheet with a dummy header if no data
      const ws = XLSX.utils.aoa_to_sheet([['No Data']]);
      XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31)); // Sheet names max 31 chars
      continue;
    }

    // Extract headers from the first record (assuming all records in a table have similar structure)
    // To be safe, let's collect all unique keys across all records in this table
    const headerSet = new Set<string>();
    tableRecords.forEach((record: any) => {
      if (typeof record === 'object' && record !== null) {
        Object.keys(record).forEach(k => headerSet.add(k));
      }
    });
    const headers = Array.from(headerSet);

    // Build data rows
    const dataRows = tableRecords.map((record: any) => {
      return headers.map((header) => {
        let val = record[header];
        
        // Convert objects/arrays to JSON string for representation
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }

        // Specific stripping for notes content
        if (tableName === 'notes' && (header === 'content' || header === 'description' || header === 'htmlContent')) {
          val = stripHtml(val);
        }

        return val;
      });
    });

    // Create worksheet
    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-fit columns
    ws['!cols'] = getColumnWidths(headers, dataRows);

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

    XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31));
  }

  // Write workbook
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  return blob;
};

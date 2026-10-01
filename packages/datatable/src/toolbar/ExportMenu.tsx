import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import {ListItemIcon, ListItemText, MenuItem} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import {useState} from 'react';

import {AnchoredMenu} from '../AnchoredMenu';
import {createDataRow, createHeaderRow, writeExcelFile} from '../export/excel';
import {useLabels} from '../i18n';
import {ToolbarIconButton} from '../ToolbarIconButton';
import type {DataTableColumnDef, ExportFormat, RowData} from '../types';

interface ExportMenuProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly formats?: readonly ExportFormat[];
  readonly fileName?: string;
  readonly onExport?: (format: ExportFormat, data: TData[]) => void | Promise<void>;
  readonly onExportStart?: (format: ExportFormat) => void;
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

export function ExportMenu<TData extends RowData>({
  table,
  formats = ['csv'],
  fileName = 'export',
  onExport,
  onExportStart,
  onExportComplete,
}: Readonly<ExportMenuProps<TData>>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setAnchorEl(null);
    onExportStart?.(format);
    let succeeded = true;
    try {
      await runExport(format);
    } catch (error) {
      // The click handler does not await this, so a throw from here would be a rejection
      // nobody is listening for. The consumer hears about it through `onExportComplete`.
      console.error(`Failed to export the table as "${format}":`, error);
      succeeded = false;
    }
    onExportComplete?.(format, succeeded);
  };

  const runExport = async (format: ExportFormat) => {
    // The sorted model is the filtered one put in the order on screen, across every page.
    const rows = leafRows(table.getSortedRowModel().rows).map((row) => row.original);

    if (onExport) {
      await onExport(format, rows);
      return;
    }

    // Default export implementations
    const columns = table
      .getAllLeafColumns()
      .filter((col) => col.id !== 'select' && col.id !== 'actions' && col.getIsVisible())
      .map((col) => ({
        id: col.id,
        columnDef: col.columnDef as DataTableColumnDef<TData>,
      }));

    switch (format) {
      case 'csv':
        exportToCsv(rows, columns, fileName);
        break;
      case 'xlsx':
        await exportToXlsx(rows, columns, fileName);
        break;
      case 'json':
        exportToJson(rows, fileName);
        break;
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return <DescriptionIcon fontSize="small" />;
      case 'xlsx':
        return <TableChartIcon fontSize="small" />;
      case 'json':
        return <CodeIcon fontSize="small" />;
      default:
        return <FileDownloadIcon fontSize="small" />;
    }
  };

  // `t()` returns the key itself when a translation is missing, never null, so `??` can
  // never fire. The fallback has to be `defaultValue` or a locale with a gap in it
  // offers a menu of raw key strings.
  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return labels.exportCsv;
      case 'xlsx':
        return labels.exportExcel;
      case 'json':
        return labels.exportJson;
    }
  };

  return (
    <>
      <ToolbarIconButton label={labels.exportLabel} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <FileDownloadIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
      </ToolbarIconButton>

      <AnchoredMenu anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        {formats.map((format) => (
          <MenuItem key={format} onClick={() => handleExport(format)}>
            <ListItemIcon>{getFormatIcon(format)}</ListItemIcon>
            <ListItemText>{getFormatLabel(format)}</ListItemText>
          </MenuItem>
        ))}
      </AnchoredMenu>
    </>
  );
}

/** A group row is a heading over the rows it holds, so a grouped table exports what is inside. */
function leafRows<TData extends RowData>(rows: readonly Row<TData>[]): Row<TData>[] {
  return rows.flatMap((row) => (row.getIsGrouped() ? leafRows(row.subRows) : [row]));
}

function toExportString(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(toExportString).join(', ');
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'object') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function getColumnValue<TData extends RowData>(
  columnDef: DataTableColumnDef<TData>,
  row: TData,
  index: number,
): string {
  if (columnDef.accessorFn) return toExportString(columnDef.accessorFn(row, index));
  if (columnDef.accessorKey) return toExportString(row[columnDef.accessorKey]);
  return '';
}

// Helper functions for default export implementations
function columnHeaders<TData extends RowData>(
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
): string[] {
  return columns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === 'string' ? header : col.id;
  });
}

function columnValues<TData extends RowData>(
  data: TData[],
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
): string[][] {
  return data.map((row, rowIndex) => columns.map((col) => getColumnValue(col.columnDef, row, rowIndex)));
}

function toCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function exportToCsv<TData extends RowData>(
  data: TData[],
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
  fileName: string,
) {
  // Headings are cells too: one with a comma in it would shift every column under it.
  const lines = [columnHeaders(columns), ...columnValues(data, columns)].map((values) =>
    values.map(toCsvCell).join(','),
  );

  const csvContent = lines.join('\n');
  downloadFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
}

async function exportToXlsx<TData extends RowData>(
  data: TData[],
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
  fileName: string,
) {
  const headers = columnHeaders(columns);
  const rowValues = columnValues(data, columns);
  const rows = rowValues.map((values) => createDataRow(values));

  const colWidths = headers.map((header, i) => {
    // v8 ignore start: every row holds one value per header, so `row[i]` is always a string
    const maxDataLen = rowValues.reduce((max, row) => Math.max(max, row[i]?.length ?? 0), 0);
    // v8 ignore stop
    return {width: Math.min(Math.max(header.length, maxDataLen) + 2, 50)};
  });

  await writeExcelFile([createHeaderRow(headers), ...rows], {fileName: `${fileName}.xlsx`, columns: colWidths});
}

function exportToJson<TData>(data: TData[], fileName: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${fileName}.json`, 'application/json');
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // The anchor only exists to be clicked. Left visible it is a link with no text sitting in
  // the tab order until the cleanup below removes it, which axe flags and a keyboard user
  // would actually land on. `display: none` keeps it out of both; a programmatic `click()`
  // does not care that it is hidden.
  link.style.display = 'none';
  link.setAttribute('aria-hidden', 'true');
  document.body.appendChild(link);
  link.click();
  // Defer cleanup so the browser has time to start the download
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

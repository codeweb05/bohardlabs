import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import {IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip} from '@mui/material';
import type {Table} from '@tanstack/react-table';
import {useState} from 'react';

import {createDataRow, createHeaderRow, writeExcelFile} from '../export/excel';
import {useLabels} from '../i18n';
import type {DataTableColumnDef, ExportFormat, RowData} from '../types';

interface ExportMenuProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly formats?: readonly ExportFormat[];
  readonly fileName?: string;
  readonly onExport?: (format: ExportFormat, data: TData[]) => void;
}

export function ExportMenu<TData extends RowData>({
  table,
  formats = ['csv'],
  fileName = 'export',
  onExport,
}: Readonly<ExportMenuProps<TData>>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setAnchorEl(null);

    const rows = table.getFilteredRowModel().rows.map((row) => row.original);

    if (onExport) {
      onExport(format, rows);
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
      <Tooltip title={labels.exportLabel}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          aria-label={labels.exportLabel}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          <FileDownloadIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {formats.map((format) => (
          <MenuItem key={format} onClick={() => handleExport(format)}>
            <ListItemIcon>{getFormatIcon(format)}</ListItemIcon>
            <ListItemText>{getFormatLabel(format)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function toExportString(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(toExportString).join(', ');
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
function exportToCsv<TData extends RowData>(
  data: TData[],
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
  fileName: string,
) {
  // Get headers
  const headers = columns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === 'string' ? header : col.id;
  });

  // Get rows
  const rows = data.map((row, rowIndex) =>
    columns.map((col) => {
      const value = getColumnValue(col.columnDef, row, rowIndex);
      const stringValue = String(value ?? '');
      // Escape quotes and wrap in quotes if contains comma or quote
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }
      return stringValue;
    }),
  );

  // Build CSV content
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  // Download
  downloadFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
}

async function exportToXlsx<TData extends RowData>(
  data: TData[],
  columns: Array<{id: string; columnDef: DataTableColumnDef<TData>}>,
  fileName: string,
) {
  const headers = columns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === 'string' ? header : col.id;
  });

  const rowValues = data.map((row, rowIndex) => columns.map((col) => getColumnValue(col.columnDef, row, rowIndex)));
  const rows = rowValues.map((values) => createDataRow(values));

  const colWidths = headers.map((header, i) => {
    const maxDataLen = rowValues.reduce((max, row) => Math.max(max, row[i].length), 0);
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

import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import {ListItemIcon, ListItemText, MenuItem} from '@mui/material';
import {flexRender} from '@tanstack/react-table';
import type {Column, Row, Table} from '@tanstack/react-table';
import dayjs from 'dayjs';
import {useState} from 'react';

import {AnchoredMenu} from '../AnchoredMenu';
import {useDateFormats} from '../config/ConfigContext';
import {createDataRow, createHeaderRow, writeExcelFile} from '../export/excel';
import {useLabels} from '../i18n';
import {ToolbarIconButton} from '../ToolbarIconButton';
import type {DataTableColumnDef, ExportFormat, RowData} from '../types';

interface ExportMenuProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly formats?: readonly ExportFormat[];
  readonly fileName?: string;
  readonly enableCsvFormulaGuard?: boolean;
  readonly onExport?: (format: ExportFormat, data: TData[]) => void | Promise<void>;
  readonly onExportStart?: (format: ExportFormat) => void;
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

export function ExportMenu<TData extends RowData>({
  table,
  formats = ['csv'],
  fileName = 'export',
  enableCsvFormulaGuard = true,
  onExport,
  onExportStart,
  onExportComplete,
}: Readonly<ExportMenuProps<TData>>) {
  const labels = useLabels();
  const {display: dateFormat} = useDateFormats();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [drawing, setDrawing] = useState<Drawing<TData> | null>(null);

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
    const rows = leafRows(table.getSortedRowModel().rows);
    const records = rows.map((row) => row.original);

    if (onExport) {
      await onExport(format, records);
      return;
    }

    // Default export implementations
    const columns = table
      .getAllLeafColumns()
      .filter((col) => col.id !== 'select' && col.id !== 'actions' && col.getIsVisible());
    // TanStack gives every column a `cell`, so the columns as they were passed in are what
    // says which ones draw themselves.
    const ownCell = new Set(table.options.columns.filter((def) => typeof def.cell === 'function').map((def) => def.id));
    const drawnIds = columns.filter((column) => ownCell.has(column.id)).map((column) => column.id);
    const drawn = await drawCells(rows, drawnIds);
    const sheet: Sheet = {
      headers: columns.map(columnHeader),
      rows: rows.map((row, index) =>
        columns.map(
          (column) => drawn[index]?.[drawnIds.indexOf(column.id)] || valueText(row, column, index, dateFormat),
        ),
      ),
    };

    switch (format) {
      case 'csv':
        exportToCsv(sheet, fileName, enableCsvFormulaGuard);
        break;
      case 'xlsx':
        await exportToXlsx(sheet, fileName);
        break;
      case 'json':
        exportToJson(records, fileName);
        break;
    }
  };

  // What a cell shows is only known once it is mounted: a chip's label, a component's
  // output, anything read from a hook. So the cells are mounted out of sight, read, and
  // taken down again.
  const drawCells = (rows: Row<TData>[], columnIds: string[]) =>
    columnIds.length === 0
      ? Promise.resolve<string[][]>([])
      : new Promise<string[][]>((resolve) => {
          setDrawing({
            rows,
            columnIds,
            onRead: (text) => {
              setDrawing(null);
              resolve(text);
            },
          });
        });

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
      default:
        return format;
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

      {drawing && <DrawnCells {...drawing} />}
    </>
  );
}

/** A group row is a heading over the rows it holds, so a grouped table exports what is inside. */
function leafRows<TData extends RowData>(rows: readonly Row<TData>[]): Row<TData>[] {
  return rows.flatMap((row) => (row.getIsGrouped() ? leafRows(row.subRows) : [row]));
}

/** One line of headings and one line per row, already as text. CSV and Excel write the same thing. */
interface Sheet {
  readonly headers: string[];
  readonly rows: string[][];
}

function toExportString(value: unknown, dateFormat: string): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => toExportString(item, dateFormat)).join(', ');
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : dayjs(value).format(dateFormat);
  if (typeof value === 'object') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

interface Drawing<TData extends RowData> {
  readonly rows: Row<TData>[];
  readonly columnIds: string[];
  readonly onRead: (text: string[][]) => void;
}

/**
 * The cells of the columns that draw themselves, mounted where nobody sees them so their
 * text can be read. Mounted inside the table, so a cell finds the same theme, labels and
 * providers it has on screen.
 */
function DrawnCells<TData extends RowData>({rows, columnIds, onRead}: Readonly<Drawing<TData>>) {
  // Rendered once and taken down, so there is no second render for the compiler to save.
  'use no memo';
  return (
    <div
      hidden
      ref={(node) => {
        if (node)
          onRead(Array.from(node.children, (line) => Array.from(line.children, (cell) => cell.textContent.trim())));
      }}
    >
      {rows.map((row) => (
        <div key={row.id}>
          {row
            .getAllCells()
            .filter((cell) => columnIds.includes(cell.column.id))
            .map((cell) => (
              <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
            ))}
        </div>
      ))}
    </div>
  );
}

/** The value under a cell, for a column with no `cell` of its own or one that draws no text. */
function valueText<TData extends RowData>(row: Row<TData>, column: Column<TData>, index: number, dateFormat: string) {
  const columnDef = column.columnDef as DataTableColumnDef<TData>;
  if (columnDef.accessorFn) return toExportString(columnDef.accessorFn(row.original, index), dateFormat);
  if (columnDef.accessorKey) return toExportString(row.original[columnDef.accessorKey], dateFormat);
  return '';
}

function columnHeader<TData extends RowData>(column: Column<TData>): string {
  const header = (column.columnDef as DataTableColumnDef<TData>).header;
  return typeof header === 'string' ? header : column.id;
}

/**
 * A spreadsheet runs a cell that opens with one of these as a formula, so a value typed by
 * one user can execute on the machine of whoever opens the export. A leading quote makes it
 * text. A plain number is left alone: `-5` is a value, `-5+cmd` is not.
 */
function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value)) ? `'${value}` : value;
}

function toCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Without a byte-order mark Excel reads a UTF-8 file as the system code page and garbles accents. */
const UTF8_BOM = '\uFEFF';

function exportToCsv(sheet: Sheet, fileName: string, guardFormulas: boolean) {
  const toCell = guardFormulas ? (value: string) => toCsvCell(guardFormula(value)) : toCsvCell;
  // Headings are cells too: one with a comma in it would shift every column under it.
  const lines = [sheet.headers, ...sheet.rows].map((values) => values.map(toCell).join(','));

  downloadFile(UTF8_BOM + lines.join('\n'), `${fileName}.csv`, 'text/csv;charset=utf-8;');
}

async function exportToXlsx(sheet: Sheet, fileName: string) {
  const rows = sheet.rows.map((values) => createDataRow(values));

  const colWidths = sheet.headers.map((header, i) => {
    // v8 ignore start: every row holds one value per header, so `row[i]` is always a string
    const maxDataLen = sheet.rows.reduce((max, row) => Math.max(max, row[i]?.length ?? 0), 0);
    // v8 ignore stop
    return {width: Math.min(Math.max(header.length, maxDataLen) + 2, 50)};
  });

  await writeExcelFile([createHeaderRow(sheet.headers), ...rows], {fileName: `${fileName}.xlsx`, columns: colWidths});
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

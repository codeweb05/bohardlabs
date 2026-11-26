import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import {LinearProgress, ListItemIcon, ListItemText, ListSubheader, MenuItem, Tooltip, Typography} from '@mui/material';
import {createRow, flexRender} from '@tanstack/react-table';
import type {Column, Row, Table} from '@tanstack/react-table';
import dayjs from 'dayjs';
import {useId, useRef, useState} from 'react';

import {AnchoredMenu} from '../AnchoredMenu';
import {useDateFormats} from '../config/ConfigContext';
import {createDataRow, createHeaderRow, writeExcelFile} from '../export/excel';
import {useLabels} from '../i18n';
import {ToolbarIconButton} from '../ToolbarIconButton';
import type {DataTableColumnDef, ExportFormat, RowData, ServerTableState} from '../types';

/** The most rows "All matching" exports unless `exportRowLimit` says otherwise. */
const DEFAULT_EXPORT_ROW_LIMIT = 10_000;

/** A ref that moves focus to its element once, when it mounts. Stable, so React never re-runs it. */
const focusOnMount = (node: HTMLElement | null) => node?.focus();

interface ExportMenuProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly formats?: readonly ExportFormat[];
  readonly fileName?: string;
  readonly enableCsvFormulaGuard?: boolean;
  readonly onExport?: (format: ExportFormat, data: TData[]) => void | Promise<void>;
  readonly onExportStart?: (format: ExportFormat) => void;
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
  readonly exportRows?: (state: ServerTableState) => Promise<readonly TData[]>;
  readonly exportRowLimit?: number;
  /** The server's count, for the "All matching" heading. */
  readonly totalRows?: number;
  /** The rows held are one page, so the menu says so. */
  readonly manualPagination?: boolean;
}

/** One block of the menu: a heading, then an item per format. */
interface ExportScope {
  readonly key: 'page' | 'all';
  readonly heading?: string;
  /** A note under the heading, such as "only the first 10,000 will be exported". */
  readonly note?: string;
}

/** An "All matching" export waiting on `exportRows`. Cancel adds it to `cancelledRef`. */
interface PendingExport {
  readonly format: ExportFormat;
}

export function ExportMenu<TData extends RowData>({
  table,
  formats = ['csv'],
  fileName = 'export',
  enableCsvFormulaGuard = true,
  onExport,
  onExportStart,
  onExportComplete,
  exportRows,
  exportRowLimit = DEFAULT_EXPORT_ROW_LIMIT,
  totalRows,
  manualPagination = false,
}: Readonly<ExportMenuProps<TData>>) {
  const labels = useLabels();
  const {display: dateFormat} = useDateFormats();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [drawing, setDrawing] = useState<Drawing<TData> | null>(null);
  // Read when the menu opens rather than during render: `table` is one stable object, so a
  // value derived from it in render would be cached past a change of column visibility.
  const [hasColumns, setHasColumns] = useState(true);
  // Read on open for the same reason: how many rows the table holds.
  const [heldCount, setHeldCount] = useState(0);
  // The run to draw the progress for. A ref holds the cancelled ones, so a cancel reaches the
  // run that is already awaiting.
  const [pending, setPending] = useState<PendingExport | null>(null);
  const cancelledRef = useRef(new WeakSet<PendingExport>());
  const [failed, setFailed] = useState(false);
  const headingId = useId();

  const handleExport = async (format: ExportFormat, allMatching: boolean) => {
    // Only "All matching" keeps the menu open, to show its progress.
    const run: PendingExport | null = allMatching && exportRows ? {format} : null;
    setPending(run);
    setFailed(false);
    if (!run) setAnchorEl(null);
    onExportStart?.(format);
    let succeeded = true;
    try {
      const rows = run && exportRows ? await matchingRows(exportRows) : heldRows();
      // A cancel has already closed the progress and reported the export.
      if (run && cancelledRef.current.has(run)) return;
      if (run) {
        setPending(null);
        setAnchorEl(null);
      }
      await runExport(format, rows);
    } catch (error) {
      if (run && cancelledRef.current.has(run)) return;
      // The click handler does not await this, so a throw from here would be a rejection
      // nobody is listening for. The consumer hears about it through `onExportComplete`.
      console.error(`Failed to export the table as "${format}":`, error);
      succeeded = false;
      if (run) {
        setPending(null);
        setFailed(true);
      }
    }
    onExportComplete?.(format, succeeded);
  };

  const cancelPending = (run: PendingExport) => {
    cancelledRef.current.add(run);
    setPending(null);
    onExportComplete?.(run.format, false);
  };

  // The sorted model is the filtered one put in the order on screen, across every page.
  const heldRows = () => leafRows(table.getSortedRowModel().rows);

  const matchingRows = async (fetchRows: NonNullable<typeof exportRows>) => {
    // Read at the click, not in render: `table` is one stable object.
    const {pagination, sorting, columnFilters, globalFilter} = table.getState();
    const fetched = await fetchRows({pagination, sorting, columnFilters, globalFilter: String(globalFilter ?? '')});
    // Over the limit the file holds the first `exportRowLimit` rows, as the menu said it would.
    const records = fetched.slice(0, exportRowLimit);
    const {getRowId} = table.options;
    // Rows the table never held, built the way it builds its own, so their cells draw and
    // export exactly as they would on screen.
    return records.map((original, index) =>
      createRow(table, getRowId ? getRowId(original, index) : String(index), original, index, 0),
    );
  };

  const runExport = async (format: ExportFormat, rows: Row<TData>[]) => {
    const records = rows.map((row) => row.original);

    if (onExport) {
      await onExport(format, records);
      return;
    }

    // Default export implementations
    if (format === 'json') {
      exportToJson(records, fileName);
      return;
    }

    const columns = exportColumns(table);
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

    if (format === 'csv') exportToCsv(sheet, fileName, enableCsvFormulaGuard);
    else await exportToXlsx(sheet, fileName);
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

  // Under server paging the rows held are one page, and the menu says so. With
  // `exportRows` it offers every row the filters match as well, up to the limit.
  const exportScopes = (): ExportScope[] => {
    if (!exportRows) {
      return [{key: 'page', heading: manualPagination ? labels.exportCurrentPageOnly(heldCount) : undefined}];
    }
    const matching = totalRows ?? heldCount;
    return [
      {key: 'page', heading: labels.exportCurrentPage(heldCount)},
      {
        key: 'all',
        heading: labels.exportAllMatching(matching),
        note: matching > exportRowLimit ? labels.exportRowLimitReached(matching, exportRowLimit) : undefined,
      },
    ];
  };

  const formatItem = (format: ExportFormat, scope: ExportScope) => {
    // JSON writes the records whole, and `onExport` gets the records too, so only the
    // built-in CSV and Excel writers need a column to write.
    const isEmpty = !hasColumns && !onExport && format !== 'json';
    const key = `${scope.key}-${format}`;
    const item = (
      <MenuItem
        key={key}
        disabled={isEmpty}
        // Two items read "Export CSV" when there are two scopes; the heading tells them apart.
        aria-describedby={scope.heading == null ? undefined : `${headingId}-${scope.key}`}
        onClick={() => handleExport(format, scope.key === 'all')}
      >
        <ListItemIcon>{getFormatIcon(format)}</ListItemIcon>
        <ListItemText>{getFormatLabel(format)}</ListItemText>
      </MenuItem>
    );
    // A disabled item takes no pointer events, so the tooltip listens on a wrapper.
    return isEmpty ? (
      <Tooltip key={key} title={labels.exportNoColumns} describeChild placement="left">
        <span>{item}</span>
      </Tooltip>
    ) : (
      item
    );
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
      default:
        return format;
    }
  };

  return (
    <>
      <ToolbarIconButton
        label={labels.exportLabel}
        onClick={(e) => {
          setHasColumns(exportColumns(table).length > 0);
          setHeldCount(heldRows().length);
          setAnchorEl(e.currentTarget);
        }}
      >
        <FileDownloadIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
      </ToolbarIconButton>

      <AnchoredMenu anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        {pending
          ? [
              // A status, not a choice. Closing the menu leaves the export running, and
              // opening it again brings this back with its Cancel.
              <MenuItem key="preparing" disabled sx={{display: 'block', '&.Mui-disabled': {opacity: 1}}}>
                <ListItemText>{labels.exportPreparing}</ListItemText>
                <LinearProgress aria-hidden sx={{mt: 1}} />
              </MenuItem>,
              // The item that was clicked is gone, so focus comes here rather than to the page.
              <MenuItem key="cancel" ref={focusOnMount} onClick={() => cancelPending(pending)}>
                {labels.cancel}
              </MenuItem>,
            ]
          : [
              failed && (
                <ListSubheader key="failed" role="presentation" disableSticky sx={{color: 'error.main'}}>
                  {labels.exportFailed}
                </ListSubheader>
              ),
              ...exportScopes().flatMap((scope) => [
                scope.heading != null && (
                  <ListSubheader
                    key={`${scope.key}-heading`}
                    id={`${headingId}-${scope.key}`}
                    role="presentation"
                    disableSticky
                    sx={{lineHeight: 2.5}}
                  >
                    {scope.heading}
                    {scope.note != null && (
                      <Typography component="span" variant="caption" sx={{display: 'block', pb: 1, lineHeight: 1.4}}>
                        {scope.note}
                      </Typography>
                    )}
                  </ListSubheader>
                ),
                ...formats.map((format) => formatItem(format, scope)),
              ]),
            ]}
      </AnchoredMenu>

      {drawing && <DrawnCells {...drawing} />}
    </>
  );
}

/**
 * The columns a CSV or Excel file holds: the visible ones in the order on screen, minus the
 * selection and actions chrome and any column that opted out with `enableExport: false`.
 */
function exportColumns<TData extends RowData>(table: Table<TData>): Column<TData>[] {
  return table
    .getVisibleLeafColumns()
    .filter(
      (column) =>
        column.id !== 'select' &&
        column.id !== 'actions' &&
        (column.columnDef as DataTableColumnDef<TData>).enableExport !== false,
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

/** What heads the column in the file: `meta.label`, then a string header, then the id made readable. */
function columnHeader<TData extends RowData>(column: Column<TData>): string {
  // `meta` is TanStack's, typed by whatever the consumer declared for it, so it is read
  // as unknown rather than trusted to hold a label.
  const meta: unknown = column.columnDef.meta;
  if (typeof meta === 'object' && meta !== null && 'label' in meta && typeof meta.label === 'string') {
    return meta.label;
  }
  const header = (column.columnDef as DataTableColumnDef<TData>).header;
  return typeof header === 'string' ? header : humanizeId(column.id);
}

/** `payout_status`, `payout-status` and `payoutStatus` all become "Payout status". */
function humanizeId(id: string): string {
  const words = id
    .replaceAll(/([a-z\d])([A-Z])/g, '$1 $2')
    .replaceAll(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
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

/**
 * Excel export wrapper.
 *
 * All XLSX functionality is accessed through this module so the underlying
 * library (`write-excel-file`) can be swapped without touching consumers.
 */

import type {Cell, Row, SheetData} from 'write-excel-file/browser';

export interface ExcelCell {
  readonly value: string | number | boolean | Date | null;
  readonly fontWeight?: 'bold';
}

export interface ExcelColumn {
  readonly width?: number;
}

export interface ExcelSheetOptions {
  readonly fileName: string;
  readonly sheetName?: string;
  readonly columns?: readonly ExcelColumn[];
}

/**
 * Build a header row from string labels (bold by default).
 */
export function createHeaderRow(headers: readonly string[]): ExcelCell[] {
  return headers.map((value) => ({value, fontWeight: 'bold' as const}));
}

/**
 * Build a data row from plain string values.
 */
export function createDataRow(values: readonly string[]): ExcelCell[] {
  return values.map((value) => ({value}));
}

function toLibCell(cell: ExcelCell): Cell {
  return {
    value: cell.value ?? undefined,
    fontWeight: cell.fontWeight,
  };
}

function toLibRow(row: ExcelCell[]): Row {
  return row.map(toLibCell);
}

/**
 * Write rows to an XLSX file and trigger a browser download.
 *
 * Uses a dynamic import so the library is only loaded when an export
 * is actually requested (keeps it out of the main bundle).
 */
export async function writeExcelFile(rows: ExcelCell[][], options: ExcelSheetOptions): Promise<void> {
  const {default: writeXlsxFile} = await import('write-excel-file/browser');

  const sheetData: SheetData = rows.map(toLibRow);
  const columns = options.columns?.map((c) => ({width: c.width}));

  await writeXlsxFile(sheetData, {
    fileName: options.fileName,
    sheet: options.sheetName ?? 'Sheet1',
    ...(columns && {columns}),
  });
}

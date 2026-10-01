import type {FilterFn, Row} from '@tanstack/react-table';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

import type {ColumnFilterConfig, RowData} from '../types';

dayjs.extend(customParseFormat);

/**
 * A dropdown picks one of a known set, so the row has to hold that value, not merely
 * contain it. TanStack's automatic choice for a string column is a substring match, under
 * which choosing "Open" also keeps every row that is "Reopened". Case is still ignored,
 * as it was.
 */
function matchesOption<TData extends RowData>(row: Row<TData>, columnId: string, filterValue: unknown): boolean {
  const cell = String(row.getValue(columnId) ?? '').toLowerCase();
  const wanted = Array.isArray(filterValue) ? filterValue : [filterValue];
  return wanted.some((value) => String(value).toLowerCase() === cell);
}

/**
 * The date filter stores `{from, to}` strings (or one string, in single mode) written in
 * `dateFormats.value`. No built-in TanStack filter understands that shape: the automatic
 * one compares the cell against the object and every row drops out.
 *
 * Compared by calendar day, both ends included. A row with no readable date is not in any
 * range.
 */
function withinDates<TData extends RowData>(valueFormat: string): FilterFn<TData> {
  return (row, columnId, filterValue: unknown) => {
    const raw: unknown = row.getValue(columnId);
    if (raw == null || raw === '') return false;
    const cell = dayjs(raw as dayjs.ConfigType);
    if (!cell.isValid()) return false;

    if (typeof filterValue === 'string') return cell.isSame(dayjs(filterValue, valueFormat), 'day');

    const {from, to} = (filterValue ?? {}) as {from?: string; to?: string};
    if (from && cell.isBefore(dayjs(from, valueFormat), 'day')) return false;
    return !(to && cell.isAfter(dayjs(to, valueFormat), 'day'));
  };
}

/**
 * The client-side match for a column whose filter control stores something TanStack's
 * automatic choice gets wrong. `undefined` leaves the automatic choice in place.
 */
export function defaultFilterFn<TData extends RowData>(
  type: ColumnFilterConfig['type'] | undefined,
  valueFormat: string,
): FilterFn<TData> | undefined {
  if (type === 'select') return matchesOption;
  if (type === 'date') return withinDates<TData>(valueFormat);
  return undefined;
}

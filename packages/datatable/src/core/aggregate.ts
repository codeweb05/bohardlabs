/**
 * The footer totals: the named aggregates, and the reads of `meta.aggregate` and
 * `meta.formatAggregate`. `meta` is the consumer's own object and untyped here, as it is for
 * `meta.group`, so each read checks what it got and treats anything else as absent.
 */
import type {Table} from '@tanstack/react-table';
import {isValidElement, type ReactNode} from 'react';

import type {Aggregate, RowData} from '../types';

function finiteNumbers(values: readonly unknown[]): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function present(values: readonly unknown[]): unknown[] {
  return values.filter((value) => value !== null && value !== undefined);
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}

/** `numbers` is sorted and never empty. */
function median(numbers: readonly number[]): number {
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle];
}

/** One column's total. Empty input gives `null`, and so does a custom one that returns no finite number. */
export function aggregate(fn: Aggregate, values: readonly unknown[]): number | null {
  if (values.length === 0) return null;
  if (typeof fn === 'function') {
    const result = fn(values);
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  }
  if (fn === 'count') return present(values).length;
  if (fn === 'distinct') return new Set(present(values)).size;

  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  switch (fn) {
    case 'sum':
      return sum(numbers);
    case 'avg':
      return sum(numbers) / numbers.length;
    case 'min':
      return numbers.reduce((lowest, value) => Math.min(lowest, value));
    case 'max':
      return numbers.reduce((highest, value) => Math.max(highest, value));
    case 'median':
      return median(numbers);
  }
}

const NAMED_AGGREGATES = new Set<unknown>(['sum', 'avg', 'count', 'min', 'max', 'median', 'distinct']);

function isAggregate(value: unknown): value is Aggregate {
  return typeof value === 'function' || NAMED_AGGREGATES.has(value);
}

function isFormat(value: unknown): value is (value: number) => unknown {
  return typeof value === 'function';
}

/** The column's `meta.aggregate`, when it is one the table knows. */
export function columnAggregate(meta: unknown): Aggregate | undefined {
  if (typeof meta === 'object' && meta !== null && 'aggregate' in meta && isAggregate(meta.aggregate)) {
    return meta.aggregate;
  }
  return undefined;
}

/**
 * Client mode: every column's total over the rows the filters keep, on every page. Top-level
 * rows only, so a tree's child rows are not counted twice. `undefined` when no column asks
 * for one, which spares the filtered row model.
 */
export function columnTotals<TData extends RowData>(table: Table<TData>): Record<string, number | null> | undefined {
  const aggregated = table.getAllLeafColumns().flatMap((column) => {
    const fn = columnAggregate(column.columnDef.meta);
    return fn ? [{id: column.id, fn}] : [];
  });
  if (aggregated.length === 0) return undefined;

  const rows = table.getFilteredRowModel().rows;
  return Object.fromEntries(
    aggregated.map(({id, fn}) => [
      id,
      aggregate(
        fn,
        rows.map((row) => row.getValue(id)),
      ),
    ]),
  );
}

/**
 * A total as the footer shows it: through the column's `meta.formatAggregate` when that
 * returns something React can render, otherwise as a number in the user's locale.
 */
export function formatTotal(meta: unknown, value: number): ReactNode {
  if (typeof meta === 'object' && meta !== null && 'formatAggregate' in meta && isFormat(meta.formatAggregate)) {
    const shown = meta.formatAggregate(value);
    if (typeof shown === 'string' || typeof shown === 'number' || isValidElement(shown)) return shown;
  }
  return new Intl.NumberFormat().format(value);
}

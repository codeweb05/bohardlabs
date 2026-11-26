import type {ColumnFilter} from '@tanstack/react-table';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

import type {DataTableLabels} from '../i18n';
import type {ColumnFilterConfig, DataTableDateFormats} from '../types';
import {filterOperator} from './filterOperator';

// A stored date is parsed in the format it was written in, which needs this plugin.
dayjs.extend(customParseFormat);

interface DescribeContext {
  readonly labels: DataTableLabels;
  readonly dateFormats: Required<DataTableDateFormats>;
}

/** One value as a person reads it, or `null` when there is nothing to show. */
function formatValue(value: unknown, config: ColumnFilterConfig | undefined, context: DescribeContext): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => formatValue(item, config, context)).filter((part) => part !== null);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  const option = config?.options?.find((candidate) => candidate.value === value);
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? context.labels.yes : context.labels.no;
  if (config?.type === 'date' && typeof value === 'string') {
    const date = dayjs(value, context.dateFormats.value, true);
    return date.isValid() ? date.format(context.dateFormats.display) : value;
  }
  return typeof value === 'object' ? null : String(value);
}

/** The two ends of a number range (`[min, max]`) or a date range (`{from, to}`). */
function rangeEnds(value: unknown): {readonly from: unknown; readonly to: unknown; readonly isDate: boolean} | null {
  if (Array.isArray(value) && value.length === 2) return {from: value[0], to: value[1], isDate: false};
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return {from: 'from' in value ? value.from : null, to: 'to' in value ? value.to : null, isDate: true};
  }
  return null;
}

/** A range as words: both ends, or the one that is set. */
function describeRange(
  column: string,
  ends: NonNullable<ReturnType<typeof rangeEnds>>,
  config: ColumnFilterConfig | undefined,
  context: DescribeContext,
): string | null {
  const {labels} = context;
  const from = formatValue(ends.from, config, context);
  const to = formatValue(ends.to, config, context);
  if (from !== null && to !== null) {
    return labels.filterChip(column, labels.filterOperator('between'), labels.filterRange(from, to));
  }
  if (from !== null) return labels.filterChip(column, labels.filterOperator(ends.isDate ? 'after' : 'atLeast'), from);
  if (to !== null) return labels.filterChip(column, labels.filterOperator(ends.isDate ? 'before' : 'atMost'), to);
  return null;
}

/**
 * The chip text for one column filter, with the operator the request sends for it: "Status
 * is not Cancelled", "Total between 10 and 50". `null` for a filter that narrows nothing,
 * such as an empty range, which gets no chip.
 */
export function describeFilter(
  filter: ColumnFilter,
  column: string,
  config: ColumnFilterConfig | undefined,
  context: DescribeContext,
): string | null {
  const operator = filterOperator(filter.value, config);
  const ends = operator === 'between' ? rangeEnds(filter.value) : null;
  if (ends) return describeRange(column, ends, config, context);

  const value = formatValue(filter.value, config, context);
  return value === null ? null : context.labels.filterChip(column, context.labels.filterOperator(operator), value);
}

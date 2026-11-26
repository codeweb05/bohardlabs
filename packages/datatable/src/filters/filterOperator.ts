import type {ColumnFilterConfig, FilterOperator} from '../types';

/** A number control's range: two bounds, either of which may be missing. */
function isNumberRange(value: unknown[]): boolean {
  return value.length === 2 && value.every((bound) => bound === null || typeof bound === 'number');
}

/** What a value means when nothing says which control wrote it. */
function operatorOfValue(value: unknown): FilterOperator {
  if (typeof value === 'string') return 'contains';
  if (Array.isArray(value)) return isNumberRange(value) ? 'between' : 'in';
  // A date range is `{from, to}`, with either end optional.
  if (typeof value === 'object' && value !== null && ('from' in value || 'to' in value)) return 'between';
  return 'equals';
}

/**
 * The comparison a filter asks the server for. A column's own `filterConfig.operator` wins;
 * otherwise it follows the control: a dropdown picks a whole value, a range is a range, and
 * only free text is a substring.
 *
 * Shared by the request (`useServerSidePagination`) and the filter chips, so a chip says
 * what was sent.
 */
export function filterOperator(value: unknown, config: ColumnFilterConfig | undefined): FilterOperator {
  if (config?.operator) return config.operator;
  switch (config?.type) {
    case 'text':
      return 'contains';
    case 'boolean':
      return 'equals';
    case 'select':
      return Array.isArray(value) ? 'in' : 'equals';
    case 'number':
      return Array.isArray(value) ? 'between' : 'equals';
    case 'date':
      return typeof value === 'string' ? 'equals' : 'between';
    default:
      return operatorOfValue(value);
  }
}

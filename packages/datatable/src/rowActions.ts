import type {RowAction} from './types';

export function visibleRowActions<TData>(
  row: TData,
  rowActions: readonly RowAction<TData>[] | undefined,
): readonly RowAction<TData>[] | undefined {
  return rowActions?.filter((action) => {
    if (typeof action.hidden === 'function') {
      return !action.hidden(row);
    }
    return !action.hidden;
  });
}

export function isRowActionDisabled<TData>(row: TData, action: RowAction<TData>): boolean {
  if (typeof action.disabled === 'function') {
    return action.disabled(row);
  }
  return action.disabled ?? false;
}

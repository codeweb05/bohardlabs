import type {RowSelectionState, Table} from '@tanstack/react-table';

import type {BulkAction, BulkActionResult, RowData} from '../types';

export interface BulkActionOutcome {
  readonly result: BulkActionResult;
  /** The selection left behind: the rows that failed, of those that were selected. */
  readonly selection: RowSelectionState;
}

function isBulkActionResult(value: unknown): value is BulkActionResult {
  return typeof value === 'object' && value !== null && 'failed' in value && Array.isArray(value.failed);
}

/**
 * Runs a bulk action and settles the selection after it, for the desktop bar and the mobile
 * menu alike. An action that returns nothing clears the selection. One that returns a
 * result keeps only the rows it says failed, so the user can try them again. A rejection
 * is left to the caller, with the selection untouched.
 */
export async function performBulkAction<TData extends RowData>(
  table: Table<TData>,
  action: BulkAction<TData>,
  rows: TData[],
): Promise<BulkActionOutcome | null> {
  const result = await action.onClick(rows);
  if (!isBulkActionResult(result)) {
    table.resetRowSelection();
    return null;
  }
  const failed = new Set(result.failed);
  // Read at the end of the run: the selection is the table's, and `table` is one stable object.
  const selection = Object.fromEntries(
    Object.entries(table.getState().rowSelection).filter(([id, selected]) => selected && failed.has(id)),
  );
  table.setRowSelection(selection);
  return {result, selection};
}

/** One string per set of selected ids, to tell whether the selection has changed since. */
export function selectionKey(selection: RowSelectionState) {
  return Object.keys(selection)
    .filter((id) => selection[id])
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
}

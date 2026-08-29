import type {SxProps, Theme} from '@mui/material';
import type {Row} from '@tanstack/react-table';
import type {ReactNode} from 'react';

import type {ExpandTrigger, RowData} from './types';

/** Shared expansion props for the desktop table surface (body + container). */
export interface TableExpansionProps<TData extends RowData> {
  readonly enableExpanding?: boolean;
  readonly expandTrigger?: ExpandTrigger;
  readonly renderExpandedRow?: (row: Row<TData>) => ReactNode;
  readonly animateExpansion?: boolean;
  readonly getRowSx?: (row: TData) => SxProps<Theme> | undefined;
}

/**
 * Whether a row's expanded panel should be open.
 *
 * Keyed by the table's row id (`getRowId`), not `row.original.id`. Looking it up by
 * the record's own id misses on every page that supplies its own key (a uuid, a
 * compound `${orderId}-${lineId}`), and the panel then never opens.
 */
export function isRowExpanded<TData extends RowData>(
  row: Row<TData>,
  enableExpanding: boolean,
  expanded: Record<string, boolean> | boolean | undefined,
): boolean {
  if (!enableExpanding) return false;
  if (!expanded) return row.getIsExpanded();
  if (typeof expanded === 'boolean') return expanded;
  return Boolean(expanded[row.id]);
}

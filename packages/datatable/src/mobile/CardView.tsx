import {Box, Collapse, Stack} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import type {ReactNode} from 'react';

import {useTableUI} from '../DataTableContext.hooks';
import type {RowAction, RowData} from '../types';
import {CardItem} from './CardItem';

interface CardViewProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly renderCard?: (row: TData, actions?: readonly RowAction<TData>[]) => ReactNode;
  readonly onRowClick?: (row: TData) => void;
  // Expansion props
  readonly enableExpanding?: boolean;
  readonly renderExpandedRow?: (row: Row<TData>) => ReactNode;
  readonly animateExpansion?: boolean;
  /** Accessible name for the card list, the mobile stand-in for the table's own name. */
  readonly ariaLabel?: string;
}

export function CardView<TData extends RowData>({
  table,
  rowActions,
  renderCard,
  onRowClick,
  enableExpanding = false,
  renderExpandedRow,
  animateExpansion = true,
  ariaLabel,
}: Readonly<CardViewProps<TData>>) {
  const rows = table.getRowModel().rows;
  const {expanded, rowSelection} = useTableUI();

  if (rows.length === 0) {
    return null;
  }

  const isRowExpanded = (row: Row<TData>): boolean => {
    if (!enableExpanding) return false;
    if (!expanded) return row.getIsExpanded();
    if (typeof expanded === 'boolean') return expanded;
    // Keyed by the table's row id, which is whatever `getRowId` returns. Looking it up
    // by `row.original.id` misses on every page that supplies its own key (a uuid, a
    // compound `${orderId}-${lineId}`), and the panel then never opens.
    return Boolean(expanded[row.id]);
  };

  return (
    <Stack
      component="ul"
      role="list"
      aria-label={ariaLabel}
      spacing={1.5}
      sx={{
        p: {xs: 1, sm: 1.5},
        listStyle: 'none',
        m: 0,
      }}
    >
      {rows.map((row) => {
        const rowIsExpanded = isRowExpanded(row);

        return (
          <Box component="li" key={row.id}>
            {renderCard ? (
              renderCard(row.original, rowActions)
            ) : (
              <CardItem
                row={row}
                table={table}
                rowActions={rowActions}
                onRowClick={onRowClick}
                enableExpanding={enableExpanding}
                isExpanded={rowIsExpanded}
                isSelected={!!rowSelection?.[row.id]}
              />
            )}
            {/* Expanded content for mobile cards */}
            {enableExpanding &&
              renderExpandedRow &&
              (animateExpansion || rowIsExpanded) &&
              (animateExpansion ? (
                <Collapse in={rowIsExpanded} timeout={200} unmountOnExit>
                  <Box
                    sx={{
                      mt: -0.5,
                      mx: 0,
                      p: 2,
                      bgcolor: 'action.hover',
                      borderRadius: '0 0 8px 8px',
                      border: (theme) =>
                        `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      borderTop: 0,
                    }}
                  >
                    {renderExpandedRow(row)}
                  </Box>
                </Collapse>
              ) : (
                <Box
                  sx={{
                    mt: -0.5,
                    mx: 0,
                    p: 2,
                    bgcolor: 'action.hover',
                    borderRadius: '0 0 8px 8px',
                    border: (theme) =>
                      `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderTop: 0,
                  }}
                >
                  {renderExpandedRow(row)}
                </Box>
              ))}
          </Box>
        );
      })}
    </Stack>
  );
}

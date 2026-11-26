import {Box, Collapse, Stack} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import type {ReactNode} from 'react';

import {useTableUI} from '../DataTableContext.hooks';
import {isRowExpanded} from '../expansion';
import type {RowAction, RowData} from '../types';
import {CardBar} from './CardBar';
import {CardItem} from './CardItem';

interface CardViewProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly renderCard?: (row: TData, actions?: readonly RowAction<TData>[]) => ReactNode;
  readonly onRowClick?: (row: TData) => void;
  readonly cardTapAction?: 'open' | 'select';
  /** Whether the card bar offers a sort. `DataTableProps.enableSorting`. */
  readonly enableSorting?: boolean;
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
  cardTapAction,
  enableSorting = false,
  enableExpanding = false,
  renderExpandedRow,
  animateExpansion = true,
  ariaLabel,
}: Readonly<CardViewProps<TData>>) {
  // `rows` comes off the stable `table`; cached against it, a sort from the card bar would
  // not reorder the cards.
  'use no memo';
  const rows = table.getRowModel().rows;
  const {expanded, rowSelection} = useTableUI();

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <CardBar table={table} rows={rows} enableSorting={enableSorting} />
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
          const rowIsExpanded = isRowExpanded(row, enableExpanding, expanded);

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
                  cardTapAction={cardTapAction}
                  enableExpanding={enableExpanding}
                  isExpanded={rowIsExpanded}
                  isSelected={!!rowSelection?.[row.id]}
                />
              )}
              {/* Expanded content for mobile cards */}
              {enableExpanding && renderExpandedRow && (animateExpansion || rowIsExpanded) && (
                <ExpandedCardPanel in={rowIsExpanded} animate={animateExpansion}>
                  {renderExpandedRow(row)}
                </ExpandedCardPanel>
              )}
            </Box>
          );
        })}
      </Stack>
    </>
  );
}

function ExpandedCardPanel({in: open, animate, children}: {in: boolean; animate: boolean; children: ReactNode}) {
  const content = (
    <Box
      sx={{
        mt: -0.5,
        mx: 0,
        p: 2,
        bgcolor: 'action.hover',
        borderRadius: 2,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        border: 1,
        borderColor: 'divider',
        borderTop: 0,
      }}
    >
      {children}
    </Box>
  );

  if (animate) {
    return (
      <Collapse in={open} timeout={200} unmountOnExit>
        {content}
      </Collapse>
    );
  }

  return content;
}

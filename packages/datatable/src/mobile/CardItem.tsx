import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type {Theme} from '@mui/material';
import {Box, Card, CardContent, Checkbox, IconButton, Typography} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import {useId, useState} from 'react';

import {useLabels} from '../i18n';
import {visibleRowActions} from '../rowActions';
import {RowActionsMenu} from '../RowActionsMenu';
import type {DataTableColumnDef, RowAction, RowData} from '../types';

/** The columns a card shows, sorted by `mobileOrder`; the first is its title. */
function cardColumns<TData extends RowData>(table: Table<TData>) {
  return table
    .getAllLeafColumns()
    .filter((col) => {
      const meta = col.columnDef as DataTableColumnDef<TData>;
      // `getAllLeafColumns()` includes hidden columns. Without the visibility check a
      // hidden column still consumes one of the card's slots (the title slot included)
      // and then renders nothing, silently dropping a field the user can still see.
      if (!col.getIsVisible()) return false;
      return meta.showInMobileCard !== false && col.id !== 'select' && col.id !== 'actions' && col.id !== 'expand';
    })
    .sort((a, b) => {
      const metaA = a.columnDef as DataTableColumnDef<TData>;
      const metaB = b.columnDef as DataTableColumnDef<TData>;
      return (metaA.mobileOrder ?? 999) - (metaB.mobileOrder ?? 999);
    })
    .slice(0, 5);
}

/** Enter opens the card's row, Space toggles its selection. */
function handleCardKey<TData extends RowData>(
  event: React.KeyboardEvent<HTMLElement>,
  row: Row<TData>,
  onRowClick: ((row: TData) => void) | undefined,
  canSelectThisRow: boolean,
) {
  // Keys pressed on the checkbox, the chevron or the menu button bubble up here and belong
  // to them, so only a key pressed on the card itself is handled.
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' && onRowClick) {
    event.preventDefault();
    onRowClick(row.original);
  } else if (event.key === ' ' && canSelectThisRow) {
    // Without preventDefault the page scrolls as well.
    event.preventDefault();
    row.toggleSelected();
  }
}

interface CardItemProps<TData extends RowData> {
  readonly row: Row<TData>;
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly onRowClick?: (row: TData) => void;
  readonly enableExpanding?: boolean;
  readonly isExpanded?: boolean;
  readonly isSelected?: boolean;
  /** What a tap on the card does. See `DataTableProps.cardTapAction`. */
  readonly cardTapAction?: 'open' | 'select';
}

export function CardItem<TData extends RowData>({
  row,
  table,
  rowActions,
  onRowClick,
  enableExpanding = false,
  isExpanded = false,
  isSelected = false,
  cardTapAction = 'select',
}: Readonly<CardItemProps<TData>>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const titleId = useId();

  const canSelect = !!table.options.enableRowSelection;
  const canSelectThisRow = canSelect && row.getCanSelect();

  const mobileColumns = cardColumns(table);

  const primaryColumn = mobileColumns[0];
  const secondaryColumns = mobileColumns.slice(1);

  // Filter visible actions
  const visibleActions = visibleRowActions(row.original, rowActions);

  const opensOnTap = cardTapAction === 'open';

  const handleCardClick = () => {
    // One tap, one meaning: the checkbox and the chevron keep selection and expansion.
    if (opensOnTap) {
      onRowClick?.(row.original);
      return;
    }
    // Toggle selection when card is clicked (if selectable)
    if (canSelectThisRow) {
      row.toggleSelected();
    }
    // Toggle expansion when card is clicked (if expandable)
    if (enableExpanding) {
      row.toggleExpanded();
    }
    onRowClick?.(row.original);
  };

  const handleCheckboxClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    row.toggleSelected();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) =>
    handleCardKey(event, row, onRowClick, canSelectThisRow);

  const tapDoesSomething = opensOnTap ? !!onRowClick : !!onRowClick || canSelect || enableExpanding;
  // A tab stop only where a key has something to do: Enter opens, Space selects. A group
  // rather than a button: the card holds a checkbox and a menu button of its own, and a
  // button may not contain other controls.
  const focusProps =
    onRowClick || canSelectThisRow
      ? {
          role: 'group',
          tabIndex: 0,
          'aria-labelledby': primaryColumn ? titleId : undefined,
          onKeyDown: handleCardKeyDown,
        }
      : {};

  const hasLeftContent = canSelect || enableExpanding;
  const hasRightContent = visibleActions && visibleActions.length > 0;

  return (
    <>
      <Card
        {...focusProps}
        sx={{
          cursor: tapDoesSomething ? 'pointer' : 'default',
          bgcolor: isSelected ? 'action.selected' : 'background.paper',
          '&:focus-visible': {
            outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
          '&:hover': tapDoesSomething ? {bgcolor: 'action.hover'} : undefined,
          border: 1,
          borderColor: isSelected ? 'primary.main' : 'divider',
          borderRadius: 2,
          // The expanded panel continues below, so the card's bottom corners go square.
          ...(enableExpanding && isExpanded && {borderBottomLeftRadius: 0, borderBottomRightRadius: 0}),
          transition: 'border-color 0.15s ease',
        }}
        onClick={handleCardClick}
        elevation={0}
      >
        <CardContent sx={{p: 1.5, '&:last-child': {pb: 1.5}}}>
          {/* Header row: checkbox / expand chevron | primary column (left-aligned) | actions menu */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: secondaryColumns.length > 0 ? 1 : 0,
            }}
          >
            {/* Left: checkbox and/or expand chevron */}
            {hasLeftContent && (
              <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                {canSelect && (
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    disabled={!canSelectThisRow}
                    onClick={handleCheckboxClick}
                    sx={{p: 0.25}}
                    slotProps={{
                      input: {
                        'aria-label': labels.selectRow(row.id),
                      },
                    }}
                  />
                )}
                {enableExpanding && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      row.toggleExpanded();
                    }}
                    aria-label={isExpanded ? labels.collapseRow : labels.expandRow}
                    aria-expanded={isExpanded}
                    sx={{p: 0.25}}
                  >
                    <ChevronRightIcon
                      fontSize="small"
                      sx={{
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s ease-in-out',
                      }}
                    />
                  </IconButton>
                )}
              </Box>
            )}

            {/* Primary column content (left-aligned, fills remaining space) */}
            {primaryColumn &&
              (() => {
                const cell = row.getVisibleCells().find((c) => c.column.id === primaryColumn.id);
                // v8 ignore start: `mobileColumns` is already filtered to visible columns, the same set `getVisibleCells` returns
                if (!cell) return null;
                // v8 ignore stop
                const content = flexRender(cell.column.columnDef.cell, cell.getContext());
                return (
                  <Typography
                    id={titleId}
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      flex: 1,
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {content}
                  </Typography>
                );
              })()}

            {/* Right: actions menu */}
            {hasRightContent && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchorEl(e.currentTarget);
                }}
                aria-label={labels.actions}
                sx={{flexShrink: 0, p: 0.25}}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}

            {/* Says the card opens something when a tap does nothing else. */}
            {opensOnTap && onRowClick && (
              <ChevronRightIcon fontSize="small" sx={{flexShrink: 0, color: 'text.secondary'}} />
            )}
          </Box>

          {/* Secondary columns: label-value pairs, left to right */}
          {secondaryColumns.length > 0 && (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
              {secondaryColumns.map((column) => {
                const cell = row.getVisibleCells().find((c) => c.column.id === column.id);
                // v8 ignore start: as above
                if (!cell) return null;
                // v8 ignore stop

                const meta = column.columnDef as DataTableColumnDef<TData>;
                const label =
                  meta.mobileLabel ??
                  (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id);

                const content = flexRender(cell.column.columnDef.cell, cell.getContext());
                const layout = meta.mobileContentLayout ?? 'inline';
                const overflow = meta.mobileOverflow ?? 'wrap';

                const valueStyles =
                  overflow === 'ellipsis'
                    ? {
                        overflow: 'hidden' as const,
                        textOverflow: 'ellipsis' as const,
                        whiteSpace: 'nowrap' as const,
                      }
                    : {
                        wordBreak: 'break-word' as const,
                        overflowWrap: 'break-word' as const,
                      };

                if (layout === 'stacked') {
                  return (
                    <Box key={column.id}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          lineHeight: 1.4,
                        }}
                      >
                        {label}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{
                          fontSize: '0.8125rem',
                          ...valueStyles,
                        }}
                      >
                        {content}
                      </Typography>
                    </Box>
                  );
                }

                // inline layout (default)
                return (
                  <Box
                    key={column.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        flexShrink: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {label}:
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{
                        fontSize: '0.8125rem',
                        minWidth: 0,
                        ...valueStyles,
                      }}
                    >
                      {content}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Actions Menu */}
      {visibleActions && visibleActions.length > 0 && (
        <RowActionsMenu
          actions={visibleActions}
          row={row.original}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
        />
      )}
    </>
  );
}

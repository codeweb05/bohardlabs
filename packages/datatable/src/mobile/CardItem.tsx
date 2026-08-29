import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import {useState} from 'react';

import {useLabels} from '../i18n';
import type {DataTableColumnDef, RowAction, RowData} from '../types';

interface CardItemProps<TData extends RowData> {
  readonly row: Row<TData>;
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly onRowClick?: (row: TData) => void;
  readonly enableExpanding?: boolean;
  readonly isExpanded?: boolean;
  readonly isSelected?: boolean;
}

export function CardItem<TData extends RowData>({
  row,
  table,
  rowActions,
  onRowClick,
  enableExpanding = false,
  isExpanded = false,
  isSelected = false,
}: Readonly<CardItemProps<TData>>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const canSelect = !!table.options.enableRowSelection;
  const canSelectThisRow = canSelect && row.getCanSelect();

  // Get columns configured for mobile display, sorted by mobileOrder
  const mobileColumns = table
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

  const primaryColumn = mobileColumns[0];
  const secondaryColumns = mobileColumns.slice(1);

  // Filter visible actions
  const visibleActions = rowActions?.filter((action) => {
    if (typeof action.hidden === 'function') {
      return !action.hidden(row.original);
    }
    return !action.hidden;
  });

  const handleActionClick = (action: RowAction<TData>) => {
    setAnchorEl(null);
    // Fire and forget, on purpose: the menu closes immediately and an async handler owns
    // its own progress and error reporting. Awaiting here would freeze the menu open with
    // no indication of why, and the contract in `RowAction.onClick` says so.
    void action.onClick(row.original);
  };

  const isActionDisabled = (action: RowAction<TData>) => {
    if (typeof action.disabled === 'function') {
      return action.disabled(row.original);
    }
    return action.disabled ?? false;
  };

  const handleCardClick = () => {
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

  const hasLeftContent = canSelect || enableExpanding;
  const hasRightContent = visibleActions && visibleActions.length > 0;

  return (
    <>
      <Card
        sx={{
          cursor: onRowClick || canSelect || enableExpanding ? 'pointer' : 'default',
          bgcolor: isSelected ? 'action.selected' : 'background.paper',
          '&:hover':
            onRowClick || canSelect || enableExpanding
              ? {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                }
              : undefined,
          border: (theme) => {
            if (isSelected) return `1px solid ${theme.palette.primary.main}`;
            const borderColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            return `1px solid ${borderColor}`;
          },
          borderRadius: enableExpanding && isExpanded ? '8px 8px 0 0' : 2,
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
                        'aria-label': `Select row ${row.id}`,
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
                if (!cell) return null;
                const content = flexRender(cell.column.columnDef.cell, cell.getContext());
                return (
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{
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
          </Box>

          {/* Secondary columns: label-value pairs, left to right */}
          {secondaryColumns.length > 0 && (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
              {secondaryColumns.map((column) => {
                const cell = row.getVisibleCells().find((c) => c.column.id === column.id);
                if (!cell) return null;

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
                      <Typography variant="caption" color="text.secondary" sx={{display: 'block', lineHeight: 1.4}}>
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
                    <Typography variant="caption" color="text.secondary" sx={{flexShrink: 0, lineHeight: 1.6}}>
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
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          slotProps={{
            paper: {
              sx: {
                minWidth: 160,
                maxWidth: 280,
              },
            },
          }}
        >
          {visibleActions.map((action, index) => (
            <Box key={action.id}>
              {action.divider && index > 0 && <Divider sx={{my: 0.5}} />}
              <MenuItem
                onClick={() => handleActionClick(action)}
                disabled={isActionDisabled(action)}
                sx={{
                  color: action.color ? `${action.color}.main` : undefined,
                }}
              >
                {action.icon && (
                  <ListItemIcon
                    sx={{
                      color: action.color ? `${action.color}.main` : undefined,
                      minWidth: 36,
                    }}
                  >
                    {action.icon}
                  </ListItemIcon>
                )}
                <ListItemText>{action.label}</ListItemText>
              </MenuItem>
            </Box>
          ))}
        </Menu>
      )}
    </>
  );
}

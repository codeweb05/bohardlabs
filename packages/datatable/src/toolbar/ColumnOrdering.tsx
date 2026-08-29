import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ReorderIcon from '@mui/icons-material/Reorder';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import type {Table} from '@tanstack/react-table';
import {useCallback, useState} from 'react';

import {
  LEADING_COLUMN_IDS,
  TRAILING_COLUMN_IDS,
  orderWithPinned,
  resolveColumnPinning,
} from '../hooks/useColumnPinning';
import {useLabels} from '../i18n';
import type {DataTableColumnDef, RowData} from '../types';

/** The system columns this dialog never lets the user move: they bracket the row. */
function isSystemColumn(columnId: string): boolean {
  return LEADING_COLUMN_IDS.includes(columnId) || TRAILING_COLUMN_IDS.includes(columnId);
}

interface ColumnOrderingProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly onOrderChange?: (order: string[]) => void;
}

export function ColumnOrdering<TData extends RowData>({table, onOrderChange}: Readonly<ColumnOrderingProps<TData>>) {
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Get orderable columns (the system columns bracket the row and are not draggable)
  const columns = table.getAllLeafColumns().filter((col) => !isSystemColumn(col.id));

  const [localOrder, setLocalOrder] = useState<string[]>(() => columns.map((col) => col.id));

  // Reset local order when dialog opens
  const handleOpen = () => {
    const currentOrder = table.getState().columnOrder;
    if (currentOrder.length > 0) {
      // Keep only orderable columns, and only ones the table still has
      const available = new Set(columns.map((col) => col.id));
      setLocalOrder(currentOrder.filter((id) => available.has(id)));
    } else {
      setLocalOrder(columns.map((col) => col.id));
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newOrder = [...localOrder];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      setLocalOrder(newOrder);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleApply = () => {
    // Put the system columns back around the reordered ones, then run the whole thing
    // through the same normalizer every drag on the header uses: it is what keeps the
    // frozen columns together at the front of the row. Skipping it leaves a pinned
    // column stranded mid-row while the header still paints it frozen, so the frozen
    // header cells end up over the wrong body cells.
    const allIds = table.getAllLeafColumns().map((col) => col.id);
    const systemIds = allIds.filter(isSystemColumn);
    const pinning = table.getState().columnPinning;
    const fullOrder = orderWithPinned([...systemIds, ...localOrder], pinning.left ?? []);

    table.setColumnOrder(fullOrder);

    // The pinned array is painted in its own order by the header, so it has to be
    // re-sliced off the order it just committed.
    const nextPinning = resolveColumnPinning(pinning, fullOrder);
    if (nextPinning !== pinning) {
      table.setColumnPinning(nextPinning);
    }

    onOrderChange?.(fullOrder);
    handleClose();
  };

  const handleReset = () => {
    setLocalOrder(columns.map((col) => col.id));
  };

  // Get column label
  const getColumnLabel = (columnId: string): string => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return columnId;
    const columnDef = column.columnDef as DataTableColumnDef<TData>;
    return typeof columnDef.header === 'string' ? columnDef.header : columnId;
  };

  return (
    <>
      <Tooltip title={labels.dragToReorder}>
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label={labels.dragToReorder}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          <ReorderIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              maxHeight: '80vh',
            },
          },
        }}
      >
        <DialogTitle sx={{pb: 1}}>
          <Typography variant="h6" fontWeight={600}>
            {labels.dragToReorder}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
            {labels.reorderHint}
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{p: 0}}>
          <List disablePadding>
            {localOrder.map((columnId, index) => {
              const getRowBgColor = () => {
                if (dragOverIndex === index) return 'action.selected';
                if (draggedIndex === index) return 'action.hover';
                return 'transparent';
              };
              return (
                <ListItem
                  key={columnId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  sx={{
                    cursor: 'grab',
                    bgcolor: getRowBgColor(),
                    borderBottom: (theme) =>
                      `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    '&:active': {
                      cursor: 'grabbing',
                    },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <ListItemIcon sx={{minWidth: 36}}>
                    <DragIndicatorIcon
                      sx={{
                        color: 'text.secondary',
                        fontSize: '1.25rem',
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={getColumnLabel(columnId)}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        fontWeight: 500,
                      },
                    }}
                  />
                  <Box
                    component="span"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                    }}
                  >
                    {index + 1}
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>

        <DialogActions sx={{px: 2, py: 1.5}}>
          <Button onClick={handleReset} color="inherit" size="small">
            {labels.reset}
          </Button>
          <Box sx={{flex: 1}} />
          <Button onClick={handleClose} color="inherit" size="small">
            {labels.cancel}
          </Button>
          <Button onClick={handleApply} variant="contained" size="small">
            {labels.apply}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

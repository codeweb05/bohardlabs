import CloseIcon from '@mui/icons-material/Close';
import {Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, alpha} from '@mui/material';
import type {RowSelectionState, Table} from '@tanstack/react-table';
import {useState} from 'react';

import {ConfirmSlot} from '../config/ConfigContext';
import {useLabels} from '../i18n';
import type {BulkAction, BulkActionResult, RowData} from '../types';
import {performBulkAction, selectionKey} from './performBulkAction';

interface BulkActionsProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly actions: readonly BulkAction<TData>[];
  /** Passed in so a change of selection re-renders the bar; `table` itself never changes. */
  readonly rowSelection?: RowSelectionState;
  readonly onResult?: (action: BulkAction<TData>, result: BulkActionResult) => void;
}

/** The counts an action reported, and the selection they describe. */
interface Notice {
  readonly succeeded: number;
  readonly failed: number;
  readonly selection: string;
}

export function BulkActions<TData extends RowData>({
  table,
  actions,
  rowSelection = table.getState().rowSelection,
  onResult,
}: Readonly<BulkActionsProps<TData>>) {
  const labels = useLabels();
  const [confirmAction, setConfirmAction] = useState<BulkAction<TData> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // The message is about the rows left selected. Once the user picks others, it is not.
  if (notice && notice.selection !== selectionKey(rowSelection)) setNotice(null);

  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const selectedCount = selectedRows.length;

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = async (action: BulkAction<TData>) => {
    // Check if action needs confirmation
    if (action.confirmMessage) {
      setConfirmAction(action);
      return;
    }
    await executeAction(action);
  };

  const executeAction = async (action: BulkAction<TData>) => {
    setIsLoading(true);
    setLoadingActionId(action.id);
    try {
      const outcome = await performBulkAction(table, action, selectedRows);
      if (outcome) {
        const {result, selection} = outcome;
        setNotice({
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          selection: selectionKey(selection),
        });
        onResult?.(action, result);
      }
    } catch (error) {
      // Nothing awaits the click, so a throw from here would be a rejection nobody is
      // listening for. The selection is left alone so the same rows can be tried again.
      console.error(`Bulk action "${action.id}" failed:`, error);
    } finally {
      setIsLoading(false);
      setLoadingActionId(null);
      setConfirmAction(null);
    }
  };

  const getConfirmMessage = (): string => {
    if (!confirmAction?.confirmMessage) return '';
    if (typeof confirmAction.confirmMessage === 'function') {
      return confirmAction.confirmMessage(selectedCount);
    }
    return confirmAction.confirmMessage;
  };

  const isActionDisabled = (action: BulkAction<TData>): boolean => {
    if (isLoading) return true;
    if (typeof action.disabled === 'function') {
      return action.disabled(selectedRows);
    }
    return action.disabled ?? false;
  };

  const handleClearSelection = () => {
    table.resetRowSelection();
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: {xs: 1, sm: 2},
          py: {xs: 1, sm: 1.25},
          px: {xs: 1.5, sm: 2},
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.06),
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Selection count */}
        <Chip
          label={`${selectedCount} ${labels.selected}`}
          size="small"
          color="primary"
          variant="filled"
          sx={{
            fontWeight: 600,
            fontSize: {xs: '0.75rem', sm: '0.8125rem'},
          }}
        />

        {/* Clear selection button */}
        <IconButton
          size="small"
          onClick={handleClearSelection}
          aria-label={labels.clearSelection}
          sx={{
            p: 0.5,
          }}
        >
          <CloseIcon sx={{fontSize: '1rem'}} />
        </IconButton>

        <Divider orientation="vertical" flexItem />

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            flex: 1,
          }}
        >
          {actions.map((action) => {
            const isActionLoading = loadingActionId === action.id;
            return (
              <Button
                key={action.id}
                size="small"
                color={action.color ?? 'primary'}
                variant="outlined"
                startIcon={isActionLoading ? <CircularProgress size={16} color="inherit" /> : action.icon}
                onClick={() => handleAction(action)}
                disabled={isActionDisabled(action)}
                sx={{
                  fontSize: {xs: '0.75rem', sm: '0.8125rem'},
                  py: {xs: 0.5, sm: 0.75},
                  px: {xs: 1, sm: 1.5},
                  minWidth: 'auto',
                }}
              >
                {action.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      {notice && (
        <Alert
          severity={notice.failed > 0 ? 'error' : 'success'}
          closeText={labels.close}
          onClose={() => setNotice(null)}
          sx={{borderRadius: 0, borderBottom: (theme) => `1px solid ${theme.palette.divider}`}}
        >
          {labels.bulkResult(notice.succeeded, notice.failed)}
        </Alert>
      )}

      {/* Confirmation dialog */}
      <ConfirmSlot
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (confirmAction) {
            await executeAction(confirmAction);
          }
        }}
        title={confirmAction?.label ?? ''}
        message={getConfirmMessage()}
        confirmColor={confirmAction?.color === 'error' ? 'error' : 'primary'}
        isLoading={isLoading}
      />
    </>
  );
}

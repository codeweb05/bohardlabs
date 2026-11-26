import CloseIcon from '@mui/icons-material/Close';
import {Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Paper, alpha} from '@mui/material';
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
  /** `'sticky'` floats the bar at the bottom of the viewport. */
  readonly position?: 'inline' | 'sticky';
  /**
   * How many rows the filters match on the server: `totalRows`, under `manualPagination`.
   * The sticky bar offers to select them all once the whole page is selected.
   */
  readonly matchingCount?: number;
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
  position = 'inline',
  matchingCount,
}: Readonly<BulkActionsProps<TData>>) {
  const labels = useLabels();
  const [confirmAction, setConfirmAction] = useState<BulkAction<TData> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The selection and filters "Select all N matching" was chosen for. Picking a row or
  // changing a filter drops it for good, even if the user puts them back.
  const [allMatchingFor, setAllMatchingFor] = useState<{readonly key: string; readonly count: number} | null>(null);

  // The message is about the rows left selected. Once the user picks others, it is not.
  if (notice && notice.selection !== selectionKey(rowSelection)) setNotice(null);

  const {columnFilters, globalFilter} = table.getState();
  const matchKey = JSON.stringify([selectionKey(rowSelection), columnFilters, globalFilter]);
  if (allMatchingFor && allMatchingFor.key !== matchKey) setAllMatchingFor(null);

  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const selectedCount = selectedRows.length;

  if (selectedCount === 0) {
    return null;
  }

  const isSticky = position === 'sticky';
  const allMatchingCount = allMatchingFor?.key === matchKey ? allMatchingFor.count : null;
  const allMatching = allMatchingCount !== null;
  const offerCount =
    isSticky &&
    !allMatching &&
    matchingCount !== undefined &&
    matchingCount > selectedCount &&
    table.getIsAllPageRowsSelected()
      ? matchingCount
      : null;
  // What the action will act on, for the count and the confirmation.
  const actionCount = allMatchingCount ?? selectedCount;

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
      const outcome = await performBulkAction(table, action, selectedRows, allMatching);
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
      return confirmAction.confirmMessage(actionCount);
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

  const bar = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: {xs: 1, sm: 2},
        py: {xs: 1, sm: 1.25},
        px: {xs: 1.5, sm: 2},
        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.06),
        borderBottom: isSticky ? undefined : (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Selection count */}
      <Chip
        label={allMatching ? labels.allMatchingSelected(actionCount) : `${selectedCount} ${labels.selected}`}
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

      {offerCount !== null && (
        <Button
          size="small"
          onClick={() => setAllMatchingFor({key: matchKey, count: offerCount})}
          sx={{whiteSpace: 'nowrap'}}
        >
          {labels.selectAllMatching(offerCount)}
        </Button>
      )}

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
  );

  // Always an error: after a clean run no row is left selected, and the bar is gone.
  const alert = notice && (
    <Alert
      severity="error"
      closeText={labels.close}
      onClose={() => setNotice(null)}
      sx={{borderRadius: 0, borderBottom: (theme) => `1px solid ${theme.palette.divider}`}}
    >
      {labels.bulkResult(notice.succeeded, notice.failed)}
    </Alert>
  );

  return (
    <>
      {isSticky ? (
        // Above the content, below dialogs and menus; clear of a phone's home indicator.
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            zIndex: (theme) => theme.zIndex.appBar,
            width: 'max-content',
            maxWidth: 'calc(100% - 32px)',
            overflow: 'hidden',
          }}
        >
          {alert}
          {bar}
        </Paper>
      ) : (
        <>
          {bar}
          {alert}
        </>
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

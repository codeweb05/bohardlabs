import {Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography} from '@mui/material';
import {useState} from 'react';

import {useLabels} from './i18n';
import type {DataTableConfirmProps} from './types';

/**
 * The confirmation the table puts in front of a destructive bulk action, exported so an
 * app can use the same dialog everywhere rather than matching it by hand.
 *
 * It is also the shape of the `slots.confirmDialog` contract: this component takes exactly
 * `DataTableConfirmProps`, so replacing it is a substitution rather than an adapter, and a
 * consumer can wrap this one (fixing `confirmColor`, say) and pass the wrapper back in.
 *
 * Standalone use needs no provider. `Cancel` and `Confirm` come from `DEFAULT_LABELS` when
 * there is no `DataTable` above it; `cancelLabel` and `confirmLabel` override either way.
 *
 * The dialog owns the pending state of its own confirm click: `onConfirm` may return a
 * promise, and both buttons stay disabled and the confirm button shows a spinner until it
 * settles. A caller that already tracks pending state elsewhere (a mutation) passes
 * `isLoading` instead, and the two combine.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onConfirm={() => deleteOrder(id)}
 *   title="Delete order"
 *   message="This cannot be undone."
 *   confirmLabel="Delete"
 *   confirmColor="error"
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor = 'primary',
  isLoading = false,
}: Readonly<DataTableConfirmProps>) {
  const labels = useLabels();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loading = isLoading || isSubmitting;
  const confirmText = confirmLabel ?? labels.confirm;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch {
      // The caller owns error reporting; swallowing here only stops a rejected `onConfirm`
      // from surfacing as an unhandled rejection in their app. The `finally` re-enables the
      // dialog either way, so a failed action can be retried or cancelled.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            m: {xs: 2, sm: 3},
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: {xs: '1rem', sm: '1.125rem'},
          fontWeight: 600,
          pb: 1,
          pt: {xs: 2, sm: 2.5},
          px: {xs: 2, sm: 2.5},
        }}
      >
        {title}
      </DialogTitle>

      <DialogContent sx={{px: {xs: 2, sm: 2.5}, py: 1}}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: {xs: '0.8125rem', sm: '0.875rem'},
          }}
        >
          {message}
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          px: {xs: 2, sm: 2.5},
          pb: {xs: 2, sm: 2.5},
          pt: 1.5,
          gap: 1,
        }}
      >
        <Button
          onClick={handleClose}
          disabled={loading}
          size="small"
          sx={{
            minWidth: 80,
            fontSize: '0.8125rem',
          }}
        >
          {cancelLabel ?? labels.cancel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          disabled={loading}
          size="small"
          // The spinner replaces the label, which would otherwise leave the button with no
          // accessible name for the length of the action. Naming it here keeps it the same
          // button to a screen reader, and to a consumer's `getByRole('button', {name})`,
          // in both states. It matches the visible text when there is any.
          aria-label={confirmText}
          aria-busy={loading}
          sx={{
            minWidth: 80,
            fontSize: '0.8125rem',
          }}
        >
          {/*
            Hidden from assistive tech on purpose: `aria-busy` above is what announces the
            state, and an indeterminate progressbar with no name inside an already-named
            button adds an unnamed node and nothing else (axe: `aria-progressbar-name`).
          */}
          {loading ? <CircularProgress size={18} color="inherit" aria-hidden /> : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import {Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography} from '@mui/material';
import {useState} from 'react';

import {useLabels} from '../i18n';
import type {DataTableConfirmProps} from '../types';

/**
 * The table's own confirmation dialog, used when the consumer passes no
 * `slots.confirmDialog`. It takes the public slot props, so swapping it out is a
 * substitution rather than an adapter.
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

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
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
          color="text.secondary"
          sx={{
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
          sx={{
            minWidth: 80,
            fontSize: '0.8125rem',
          }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : (confirmLabel ?? labels.confirm)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

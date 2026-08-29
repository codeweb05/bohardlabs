import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/Check';
import {Box, CircularProgress, IconButton, Tooltip} from '@mui/material';

import {useTableEditingContext} from '../DataTableContext.hooks';
import {useLabels} from '../i18n';
import type {RowData} from '../types';

interface EditActionsProps {
  readonly rowId: string;
  readonly onSave?: () => void;
  readonly onCancel?: () => void;
}

export function EditActions<TData extends RowData>({rowId, onSave, onCancel}: Readonly<EditActionsProps>) {
  const labels = useLabels();
  const {isEditing, saveEdit, cancelEdit, isSaving} = useTableEditingContext<TData>();

  const isRowEditing = isEditing(rowId);

  if (!isRowEditing) {
    return null;
  }

  const handleSave = async () => {
    if (onSave) {
      onSave();
    } else {
      await saveEdit();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      cancelEdit();
    }
  };

  // `t()` returns the key itself when a translation is missing, so a `??` fallback is
  // dead code. i18next's own `defaultValue` is the one that actually fires.
  const saveLabel = labels.saveChanges;
  const cancelLabel = labels.discardChanges;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Save button */}
      <Tooltip title={saveLabel}>
        {/* The span keeps the tooltip alive while the button is disabled mid-save, but it
            also absorbs the tooltip's aria-label, so the button needs its own. */}
        <span>
          <IconButton
            size="small"
            color="success"
            onClick={handleSave}
            disabled={isSaving}
            aria-label={saveLabel}
            sx={{p: 0.5}}
          >
            {isSaving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon sx={{fontSize: '1.125rem'}} />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Cancel button */}
      <Tooltip title={cancelLabel}>
        <IconButton
          size="small"
          color="error"
          onClick={handleCancel}
          disabled={isSaving}
          aria-label={cancelLabel}
          sx={{p: 0.5}}
        >
          <CancelIcon sx={{fontSize: '1.125rem'}} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

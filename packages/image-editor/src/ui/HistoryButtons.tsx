import RedoIcon from '@mui/icons-material/Redo';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import {useLabels} from './LabelsContext';

interface HistoryButtonsProps {
  /** `null` at that end of the history. */
  readonly onUndo: (() => void) | null;
  readonly onRedo: (() => void) | null;
}

export function HistoryButtons({onUndo, onRedo}: Readonly<HistoryButtonsProps>) {
  const labels = useLabels();
  return (
    <Box sx={{display: 'flex'}}>
      <Tooltip title={labels.undo}>
        <span>
          <IconButton aria-label={labels.undo} disabled={!onUndo} onClick={onUndo ?? undefined}>
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={labels.redo}>
        <span>
          <IconButton aria-label={labels.redo} disabled={!onRedo} onClick={onRedo ?? undefined}>
            <RedoIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

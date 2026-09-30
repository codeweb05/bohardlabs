import FlipIcon from '@mui/icons-material/Flip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import UndoIcon from '@mui/icons-material/Undo';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import type {ReactNode} from 'react';

import type {ResolvedFeatures} from '../features.js';
import type {EditorAction} from '../state/editorState.js';
import {useLabels} from './LabelsContext.js';

interface MobileToolbarProps {
  readonly features: ResolvedFeatures;
  readonly onAction: (action: EditorAction) => void;
  /** `null` when there is nothing to undo, or to reset. */
  readonly onUndo: (() => void) | null;
  readonly onReset: (() => void) | null;
  readonly disabled: boolean;
}

/** The pill that floats over the canvas below `sm`. Each button shows only when its tool is on. */
export function MobileToolbar({features, onAction, onUndo, onReset, disabled}: Readonly<MobileToolbarProps>) {
  const labels = useLabels();
  const {rotate, flip, history} = features;

  const tool = (label: string, icon: ReactNode, onClick: (() => void) | null) => (
    <IconButton aria-label={label} disabled={disabled || !onClick} onClick={onClick ?? undefined}>
      {icon}
    </IconButton>
  );

  return (
    <Paper
      role="toolbar"
      aria-label={labels.toolbar}
      elevation={4}
      sx={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 999,
      }}
    >
      {history && tool(labels.undo, <UndoIcon />, onUndo)}
      {rotate && tool(labels.rotateRight, <RotateRightIcon />, () => onAction({type: 'rotate', direction: 1}))}
      {flip &&
        flip.horizontal &&
        tool(labels.flipHorizontal, <FlipIcon />, () => onAction({type: 'flip', axis: 'horizontal'}))}
      {flip &&
        flip.vertical &&
        tool(labels.flipVertical, <FlipIcon sx={{transform: 'rotate(90deg)'}} />, () =>
          onAction({type: 'flip', axis: 'vertical'}),
        )}
      {tool(labels.reset, <RestartAltIcon />, onReset)}
    </Paper>
  );
}

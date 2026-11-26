import FlipIcon from '@mui/icons-material/Flip';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import UndoIcon from '@mui/icons-material/Undo';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useId, useState, type ReactNode} from 'react';

import type {ResolvedFeatures} from '../features.js';
import type {EditorAction} from '../state/editorState.js';
import {useLabels} from './LabelsContext.js';

/**
 * Seven 40 px buttons, their gaps and the pill's padding take 320 px, plus 32 px of dialog
 * padding. Below this the pill would run off the screen, so the two flips share one menu.
 */
const FOLD_BELOW = 352;

interface MobileToolbarProps {
  readonly features: ResolvedFeatures;
  readonly onAction: (action: EditorAction) => void;
  /** `null` when there is nothing to undo, redo, or reset. */
  readonly onUndo: (() => void) | null;
  readonly onRedo: (() => void) | null;
  readonly onReset: (() => void) | null;
  readonly disabled: boolean;
}

/** The pill that floats over the canvas below `sm`. Each button shows only when its tool is on. */
export function MobileToolbar({features, onAction, onUndo, onRedo, onReset, disabled}: Readonly<MobileToolbarProps>) {
  const labels = useLabels();
  const {rotate, flip, history} = features;
  const narrow = useMediaQuery(`(max-width: ${FOLD_BELOW - 0.05}px)`);
  // Only the full set of seven is too wide; with any tool off the flips fit as buttons.
  const fold = narrow && history && rotate && flip && flip.horizontal && flip.vertical;

  const tool = (label: string, icon: ReactNode, onClick: (() => void) | null) => (
    <IconButton aria-label={label} disabled={disabled || !onClick} onClick={onClick ?? undefined}>
      {icon}
    </IconButton>
  );
  const flipHorizontal = () => onAction({type: 'flip', axis: 'horizontal'});
  const flipVertical = () => onAction({type: 'flip', axis: 'vertical'});

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
      {history && tool(labels.redo, <RedoIcon />, onRedo)}
      {rotate && tool(labels.rotateLeft, <RotateLeftIcon />, () => onAction({type: 'rotate', direction: -1}))}
      {rotate && tool(labels.rotateRight, <RotateRightIcon />, () => onAction({type: 'rotate', direction: 1}))}
      {fold ? (
        <FlipMenu disabled={disabled} onHorizontal={flipHorizontal} onVertical={flipVertical} />
      ) : (
        <>
          {flip && flip.horizontal && tool(labels.flipHorizontal, <FlipIcon />, flipHorizontal)}
          {flip &&
            flip.vertical &&
            tool(labels.flipVertical, <FlipIcon sx={{transform: 'rotate(90deg)'}} />, flipVertical)}
        </>
      )}
      {tool(labels.reset, <RestartAltIcon />, onReset)}
    </Paper>
  );
}

interface FlipMenuProps {
  readonly disabled: boolean;
  readonly onHorizontal: () => void;
  readonly onVertical: () => void;
}

/** One Flip button that opens both flips, for a pill too narrow to show them side by side. */
function FlipMenu({disabled, onHorizontal, onVertical}: Readonly<FlipMenuProps>) {
  const labels = useLabels();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const choose = (flip: () => void) => () => {
    close();
    flip();
  };

  return (
    <>
      <IconButton
        id={`${id}-button`}
        aria-label={labels.flip}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        aria-controls={anchor ? `${id}-menu` : undefined}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <FlipIcon />
      </IconButton>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{vertical: 'top', horizontal: 'center'}}
        transformOrigin={{vertical: 'bottom', horizontal: 'center'}}
        slotProps={{list: {'aria-labelledby': `${id}-button`}}}
      >
        <MenuItem onClick={choose(onHorizontal)}>
          <ListItemIcon>
            <FlipIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{labels.flipHorizontal}</ListItemText>
        </MenuItem>
        <MenuItem onClick={choose(onVertical)}>
          <ListItemIcon>
            <FlipIcon fontSize="small" sx={{transform: 'rotate(90deg)'}} />
          </ListItemIcon>
          <ListItemText>{labels.flipVertical}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

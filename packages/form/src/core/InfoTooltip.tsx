import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import {InfoIcon} from './icons';

interface InfoTooltipProps {
  readonly title: string;
  /** The button's accessible name. */
  readonly label: string;
}

/** A real button, so keyboard and touch users reach the tooltip the same way a mouse does. */
export function InfoTooltip({title, label}: Readonly<InfoTooltipProps>) {
  return (
    <Tooltip title={title} describeChild enterTouchDelay={0}>
      <IconButton size="small" aria-label={label} sx={{p: 0.25, color: 'text.secondary'}}>
        <InfoIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}

import {IconButton, Tooltip} from '@mui/material';
import type {ReactNode} from 'react';

interface ToolbarIconButtonProps {
  readonly label: string;
  readonly onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly children: ReactNode;
}

/** Compact toolbar trigger: tooltip + icon button at the density used across the chrome. */
export function ToolbarIconButton({label, onClick, children}: Readonly<ToolbarIconButtonProps>) {
  return (
    <Tooltip title={label}>
      <IconButton
        onClick={onClick}
        size="small"
        aria-label={label}
        sx={{
          p: {xs: 0.5, sm: 1},
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

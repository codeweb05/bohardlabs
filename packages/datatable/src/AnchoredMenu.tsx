import type {SxProps, Theme} from '@mui/material';
import {Menu} from '@mui/material';
import type {ReactNode} from 'react';

export const BOTTOM_RIGHT_ORIGIN = {
  anchorOrigin: {vertical: 'bottom', horizontal: 'right'} as const,
  transformOrigin: {vertical: 'top', horizontal: 'right'} as const,
};

interface AnchoredMenuProps {
  readonly anchorEl: HTMLElement | null;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly paperSx?: SxProps<Theme>;
}

/** Toolbar and row-action menus share the same bottom-right origin. */
export function AnchoredMenu({anchorEl, onClose, children, paperSx}: Readonly<AnchoredMenuProps>) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      {...BOTTOM_RIGHT_ORIGIN}
      slotProps={paperSx ? {paper: {sx: paperSx}} : undefined}
    >
      {children}
    </Menu>
  );
}

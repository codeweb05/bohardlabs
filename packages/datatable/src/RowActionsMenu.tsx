import {Box, Divider, ListItemIcon, ListItemText, MenuItem} from '@mui/material';

import {AnchoredMenu} from './AnchoredMenu';
import {isRowActionDisabled} from './rowActions';
import type {RowAction, RowData} from './types';

interface RowActionsMenuProps<TData extends RowData> {
  readonly actions: readonly RowAction<TData>[];
  readonly row: TData;
  readonly anchorEl: HTMLElement | null;
  readonly onClose: () => void;
}

export function RowActionsMenu<TData extends RowData>({
  actions,
  row,
  anchorEl,
  onClose,
}: Readonly<RowActionsMenuProps<TData>>) {
  if (actions.length === 0) return null;

  return (
    <AnchoredMenu anchorEl={anchorEl} onClose={onClose} paperSx={{minWidth: 160, maxWidth: 280}}>
      {actions.map((action, index) => (
        <Box key={action.id}>
          {action.divider && index > 0 && <Divider sx={{my: 0.5}} />}
          <MenuItem
            onClick={() => {
              onClose();
              // Fire and forget, on purpose: the menu closes immediately and an async
              // handler owns its own progress and error reporting. Awaiting here would
              // freeze the menu open with no indication of why, and the contract in
              // `RowAction.onClick` says so.
              void action.onClick(row);
            }}
            disabled={isRowActionDisabled(row, action)}
            sx={{
              color: action.color ? `${action.color}.main` : undefined,
            }}
          >
            {action.icon && (
              <ListItemIcon
                sx={{
                  color: action.color ? `${action.color}.main` : undefined,
                  minWidth: 36,
                }}
              >
                {action.icon}
              </ListItemIcon>
            )}
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        </Box>
      ))}
    </AnchoredMenu>
  );
}

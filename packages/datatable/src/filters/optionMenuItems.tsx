import {MenuItem} from '@mui/material';

import type {FilterOption} from '../types';

export function optionMenuItems(options: readonly FilterOption[]) {
  return options.map((option) => (
    <MenuItem key={String(option.value)} value={option.value as string | number}>
      {option.label}
    </MenuItem>
  ));
}

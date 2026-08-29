import type {SelectChangeEvent} from '@mui/material';
import {FormControl, MenuItem, Select, Tooltip} from '@mui/material';
import {useEffect, useRef} from 'react';

import type {FilterOption} from '../types';

interface EditSelectFieldProps {
  readonly value: string | number;
  readonly onChange: (value: string | number) => void;
  readonly options: readonly FilterOption[];
  readonly disabled?: boolean;
  readonly error?: string;
  readonly autoFocus?: boolean;
}

export function EditSelectField({
  value,
  onChange,
  options,
  disabled = false,
  error,
  autoFocus = true,
}: Readonly<EditSelectFieldProps>) {
  const selectRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount. The focusable element is the combobox div; the only <input>
  // inside a MUI Select is the hidden one carrying the form value, which cannot take
  // focus, so targeting it left the row in edit mode with focus wherever it was.
  useEffect(() => {
    if (autoFocus && selectRef.current) {
      const combobox = selectRef.current.querySelector<HTMLElement>('[role="combobox"]');
      combobox?.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: SelectChangeEvent<string | number>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent row click events from triggering
    e.stopPropagation();
  };

  const select = (
    <FormControl size="small" fullWidth ref={selectRef}>
      <Select
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        error={Boolean(error)}
        sx={{
          '& .MuiSelect-select': {
            fontSize: '0.8125rem',
            py: 0.5,
            px: 1,
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'error.main' : undefined,
          },
        }}
      >
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={option.value as string | number}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  if (error) {
    return (
      <Tooltip title={error} placement="top" arrow>
        {select}
      </Tooltip>
    );
  }

  return select;
}

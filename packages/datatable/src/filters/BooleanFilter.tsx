import type {SelectChangeEvent} from '@mui/material';
import {FormControl, MenuItem, Select} from '@mui/material';
import type {Column} from '@tanstack/react-table';
import {useEffect, useState} from 'react';

import {useLabels} from '../i18n';

interface BooleanFilterProps<TData> {
  readonly column: Column<TData>;
  readonly trueLabel?: string;
  readonly falseLabel?: string;
  readonly debounceMs?: number;
}

// Helper function to convert boolean filter value to string
function booleanToString(value: boolean | undefined): string {
  if (value === undefined) return '';
  return value ? 'true' : 'false';
}

export function BooleanFilter<TData>({
  column,
  trueLabel,
  falseLabel,
  debounceMs = 500,
}: Readonly<BooleanFilterProps<TData>>) {
  // `useReactTable` hands back the same column object on every render, so the compiler
  // would cache `getFilterValue()` against it and the sync below would never see a filter
  // set or cleared from elsewhere. Rendering one small control costs nothing to repeat.
  'use no memo';

  const labels = useLabels();
  const filterValue = column.getFilterValue() as boolean | undefined;

  // Convert boolean to string for local state
  const initialValue = booleanToString(filterValue);
  const [localValue, setLocalValue] = useState<string>(initialValue);
  const [prevFilterValue, setPrevFilterValue] = useState(filterValue);

  // Sync local value with column filter value (storing previous value pattern)
  if (prevFilterValue !== filterValue) {
    setPrevFilterValue(filterValue);
    setLocalValue(booleanToString(filterValue));
  }

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      // Convert string back to boolean for filter
      const currentFilterValue = booleanToString(filterValue);
      if (localValue !== currentFilterValue) {
        if (localValue === '') {
          column.setFilterValue(undefined);
        } else {
          column.setFilterValue(localValue === 'true');
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, filterValue, column, debounceMs]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    setLocalValue(event.target.value);
  };

  return (
    <FormControl size="small" fullWidth>
      <Select
        value={localValue}
        onChange={handleChange}
        displayEmpty
        sx={{
          '& .MuiSelect-select': {
            fontSize: '0.8125rem',
            py: 0.75,
          },
        }}
      >
        <MenuItem value="">
          <em>{labels.all}</em>
        </MenuItem>
        <MenuItem value="true">{trueLabel ?? labels.yes}</MenuItem>
        <MenuItem value="false">{falseLabel ?? labels.no}</MenuItem>
      </Select>
    </FormControl>
  );
}

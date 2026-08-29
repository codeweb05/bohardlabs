import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import {IconButton, InputAdornment, TextField} from '@mui/material';
import type {Column} from '@tanstack/react-table';
import {useEffect, useState} from 'react';

import {useLabels} from '../i18n';

interface TextFilterProps<TData> {
  readonly column: Column<TData>;
  readonly placeholder?: string;
  readonly debounceMs?: number;
}

export function TextFilter<TData>({column, placeholder, debounceMs = 500}: Readonly<TextFilterProps<TData>>) {
  // `useReactTable` hands back the same column object on every render, so the compiler
  // would cache `getFilterValue()` against it and this box would never hear about a
  // filter cleared from the toolbar. Rendering one text field costs nothing to repeat.
  'use no memo';

  const labels = useLabels();
  const filterValue = (column.getFilterValue() ?? '') as string;
  const [localValue, setLocalValue] = useState(filterValue);

  // The last value this field pushed out. Anything else arriving in `filterValue` came
  // from somewhere else (a toolbar reset, a restored URL) and is the only thing allowed
  // to overwrite what is being typed: echoing our own debounced commit back into the box
  // drops whatever was typed while that commit was in flight.
  const [committed, setCommitted] = useState(filterValue);

  // Adjusted during render rather than in an effect, so an external change is on screen
  // in the same paint that filters the table.
  const [prevFilterValue, setPrevFilterValue] = useState(filterValue);
  if (prevFilterValue !== filterValue) {
    setPrevFilterValue(filterValue);
    if (filterValue !== committed) {
      setCommitted(filterValue);
      setLocalValue(filterValue);
    }
  }

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== (column.getFilterValue() ?? '')) {
        setCommitted(localValue);
        column.setFilterValue(localValue || undefined);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, column, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    setCommitted('');
    column.setFilterValue(undefined);
  };

  return (
    <TextField
      size="small"
      fullWidth
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder ?? labels.search}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{fontSize: '1rem', color: 'text.secondary'}} />
            </InputAdornment>
          ),
          endAdornment: localValue ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} edge="end">
                <ClearIcon sx={{fontSize: '0.875rem'}} />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
      sx={{
        '& .MuiInputBase-input': {
          fontSize: '0.8125rem',
          py: 0.75,
        },
      }}
    />
  );
}

import ClearIcon from '@mui/icons-material/Clear';
import type {SelectChangeEvent} from '@mui/material';
import {Box, Chip, FormControl, IconButton, InputAdornment, MenuItem, Select} from '@mui/material';
import type {Column} from '@tanstack/react-table';
import {useEffect, useState} from 'react';

import {useLabels} from '../i18n';
import type {FilterOption} from '../types';

type SelectFilterValue = string | number | (string | number)[];

interface SelectFilterProps<TData> {
  readonly column: Column<TData>;
  readonly options: readonly FilterOption[];
  readonly placeholder?: string;
  readonly multiple?: boolean;
  readonly debounceMs?: number;
}

export function SelectFilter<TData>({
  column,
  options,
  placeholder,
  multiple = false,
  debounceMs = 500,
}: Readonly<SelectFilterProps<TData>>) {
  // `useReactTable` hands back the same column object on every render, so the compiler
  // would cache `getFilterValue()` against it and the sync below would never see a filter
  // set or cleared from elsewhere. Rendering one small control costs nothing to repeat.
  'use no memo';

  const labels = useLabels();
  const filterValue = column.getFilterValue();

  // Handle value based on multiple mode
  const computedValue: SelectFilterValue = multiple
    ? ((filterValue as (string | number)[]) ?? [])
    : ((filterValue as string | number) ?? '');
  const [localValue, setLocalValue] = useState<SelectFilterValue>(computedValue);

  // Sync local value with column filter value (adjusting state during render)
  const [prevFilterValue, setPrevFilterValue] = useState(filterValue);
  const [prevMultiple, setPrevMultiple] = useState(multiple);
  if (prevFilterValue !== filterValue || prevMultiple !== multiple) {
    setPrevFilterValue(filterValue);
    setPrevMultiple(multiple);
    setLocalValue(computedValue);
  }

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (multiple) {
        const arrayValue = localValue as (string | number)[];
        const currentValue = (filterValue as (string | number)[]) ?? [];
        const hasChanged =
          arrayValue.length !== currentValue.length || arrayValue.some((v, i) => v !== currentValue[i]);
        if (hasChanged) {
          column.setFilterValue(arrayValue.length > 0 ? arrayValue : undefined);
        }
      } else {
        if (localValue !== filterValue) {
          // Only the empty string means "no selection". A truthiness check drops the
          // option whose value is 0, which is a real choice on numeric enums.
          column.setFilterValue(localValue === '' ? undefined : localValue);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, filterValue, column, multiple, debounceMs]);

  const handleChange = (event: SelectChangeEvent<SelectFilterValue>) => {
    setLocalValue(event.target.value);
  };

  const handleClear = () => {
    setLocalValue(multiple ? [] : '');
  };

  const hasValue = multiple ? (localValue as (string | number)[]).length > 0 : localValue !== '';

  return (
    <FormControl size="small" fullWidth>
      <Select
        value={localValue}
        onChange={handleChange}
        multiple={multiple}
        displayEmpty
        renderValue={(selected) => {
          if (selected === '' || selected == null || (Array.isArray(selected) && selected.length === 0)) {
            return (
              <Box component="span" sx={{color: 'text.secondary'}}>
                {placeholder ?? labels.select}
              </Box>
            );
          }

          if (multiple && Array.isArray(selected)) {
            return (
              <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                {selected.map((val) => {
                  const option = options.find((o) => o.value === val);
                  return (
                    <Chip
                      key={String(val)}
                      label={option?.label ?? String(val)}
                      size="small"
                      sx={{height: 20, fontSize: '0.75rem'}}
                    />
                  );
                })}
              </Box>
            );
          }

          const option = options.find((o) => String(o.value) === String(selected));
          return <Box component="span">{option?.label ?? String(selected)}</Box>;
        }}
        endAdornment={
          hasValue ? (
            <InputAdornment position="end" sx={{mr: 2}}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <ClearIcon sx={{fontSize: '0.875rem'}} />
              </IconButton>
            </InputAdornment>
          ) : null
        }
        sx={{
          '& .MuiSelect-select': {
            fontSize: '0.8125rem',
            py: 0.75,
          },
        }}
      >
        {!multiple && (
          <MenuItem value="">
            <Box component="em" sx={{color: 'text.secondary'}}>
              {labels.all}
            </Box>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={option.value as string | number}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

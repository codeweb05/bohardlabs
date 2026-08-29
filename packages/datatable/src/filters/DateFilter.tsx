import ClearIcon from '@mui/icons-material/Clear';
import {Box, IconButton} from '@mui/material';
import type {PickersActionBarAction} from '@mui/x-date-pickers';
import {DatePicker} from '@mui/x-date-pickers';
import type {Column} from '@tanstack/react-table';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';
import {useEffect, useState} from 'react';

import {useDateFormats} from '../config/ConfigContext';
import {useLabels} from '../i18n';

interface DateFilterProps<TData> {
  readonly column: Column<TData>;
  readonly placeholder?: string;
  readonly showRange?: boolean;
  readonly debounceMs?: number;
}

interface DateRangeValue {
  from?: string;
  to?: string;
}

const pickerSlotProps = {
  textField: {
    size: 'small' as const,
    sx: {
      '& .MuiInputBase-input': {
        fontSize: '0.8125rem',
        py: 0.75,
      },
    },
  },
  actionBar: {
    actions: ['clear', 'today'] as PickersActionBarAction[],
  },
};

function toDayjs(value: string | undefined | null): Dayjs | null {
  return value ? dayjs(value) : null;
}

function formatDayjs(value: Dayjs | null, format: string): string | undefined {
  return value?.isValid() ? value.format(format) : undefined;
}

// ---------------------------------------------------------------------------
// Shared clear button
// ---------------------------------------------------------------------------

function ClearButton({visible, onClear}: Readonly<{visible: boolean; onClear: () => void}>) {
  if (!visible) return null;
  return (
    <IconButton size="small" onClick={onClear}>
      <ClearIcon sx={{fontSize: '0.875rem'}} />
    </IconButton>
  );
}

// ---------------------------------------------------------------------------
// Single date filter
// ---------------------------------------------------------------------------

function SingleDateFilter<TData>({
  column,
  filterValue,
  debounceMs,
}: Readonly<{column: Column<TData>; filterValue: string | undefined; debounceMs: number}>) {
  const formats = useDateFormats();
  const [local, setLocal] = useState<Dayjs | null>(toDayjs(filterValue));

  // Sync from external filter value (React "adjust state during render" pattern)
  const [prev, setPrev] = useState(filterValue);
  if (prev !== filterValue) {
    setPrev(filterValue);
    setLocal(toDayjs(filterValue));
  }

  // Debounce local → column
  useEffect(() => {
    const timer = setTimeout(() => {
      const str = formatDayjs(local, formats.value);
      if (str !== filterValue) {
        column.setFilterValue(str);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [local, filterValue, column, debounceMs, formats.value]);

  const handleClear = () => {
    setLocal(null);
    column.setFilterValue(undefined);
  };

  return (
    <Box sx={{display: 'flex', gap: 0.5, alignItems: 'center'}}>
      <DatePicker
        value={local}
        onChange={setLocal}
        format={formats.display}
        slotProps={pickerSlotProps}
        sx={{flex: 1}}
      />
      <ClearButton visible={local !== null} onClear={handleClear} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Range date filter
// ---------------------------------------------------------------------------

function RangeDateFilter<TData>({
  column,
  filterValue,
  debounceMs,
}: Readonly<{column: Column<TData>; filterValue: DateRangeValue | undefined; debounceMs: number}>) {
  const labels = useLabels();
  const formats = useDateFormats();
  const [localFrom, setLocalFrom] = useState<Dayjs | null>(toDayjs(filterValue?.from));
  const [localTo, setLocalTo] = useState<Dayjs | null>(toDayjs(filterValue?.to));

  // Sync from external filter value (React "adjust state during render" pattern)
  const [prev, setPrev] = useState(filterValue);
  if (prev !== filterValue) {
    setPrev(filterValue);
    setLocalFrom(toDayjs(filterValue?.from));
    setLocalTo(toDayjs(filterValue?.to));
  }

  // Debounce local → column
  useEffect(() => {
    const timer = setTimeout(() => {
      const fromStr = formatDayjs(localFrom, formats.value);
      const toStr = formatDayjs(localTo, formats.value);

      if (fromStr || toStr) {
        if (filterValue?.from !== fromStr || filterValue?.to !== toStr) {
          column.setFilterValue({from: fromStr, to: toStr});
        }
      } else if (filterValue !== undefined) {
        column.setFilterValue(undefined);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localFrom, localTo, filterValue, column, debounceMs, formats.value]);

  const handleClear = () => {
    setLocalFrom(null);
    setLocalTo(null);
    column.setFilterValue(undefined);
  };

  const hasValue = localFrom !== null || localTo !== null;

  return (
    <Box sx={{display: 'flex', gap: 0.5, alignItems: 'center'}}>
      <DatePicker
        value={localFrom}
        onChange={setLocalFrom}
        maxDate={localTo ?? undefined}
        format={formats.display}
        slotProps={{
          ...pickerSlotProps,
          textField: {
            ...pickerSlotProps.textField,
            placeholder: labels.from,
          },
        }}
        sx={{flex: 1, minWidth: 0}}
      />
      <Box sx={{color: 'text.secondary', px: 0.5}}>-</Box>
      <DatePicker
        value={localTo}
        onChange={setLocalTo}
        minDate={localFrom ?? undefined}
        format={formats.display}
        slotProps={{
          ...pickerSlotProps,
          textField: {
            ...pickerSlotProps.textField,
            placeholder: labels.to,
          },
        }}
        sx={{flex: 1, minWidth: 0}}
      />
      <ClearButton visible={hasValue} onClear={handleClear} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Public component — delegates to Single or Range
// ---------------------------------------------------------------------------

export function DateFilter<TData>({column, showRange = true, debounceMs = 500}: Readonly<DateFilterProps<TData>>) {
  // `useReactTable` hands back the same column object on every render, so the compiler
  // would cache `getFilterValue()` against it and the sync below would never see a filter
  // set or cleared from elsewhere. Rendering one small control costs nothing to repeat.
  'use no memo';

  const filterValue = column.getFilterValue() as DateRangeValue | string | undefined;
  const isRangeMode = showRange && (typeof filterValue === 'object' || filterValue === undefined);

  if (!isRangeMode) {
    const singleValue = typeof filterValue === 'string' ? filterValue : undefined;
    return <SingleDateFilter column={column} filterValue={singleValue} debounceMs={debounceMs} />;
  }

  const rangeValue = typeof filterValue === 'object' ? filterValue : undefined;
  return <RangeDateFilter column={column} filterValue={rangeValue} debounceMs={debounceMs} />;
}

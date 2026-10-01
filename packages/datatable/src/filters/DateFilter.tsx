import ClearIcon from '@mui/icons-material/Clear';
import {Box, IconButton} from '@mui/material';
import type {PickersActionBarAction} from '@mui/x-date-pickers';
import {DatePicker} from '@mui/x-date-pickers';
import type {Column} from '@tanstack/react-table';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {useState} from 'react';

import {useDateFormats} from '../config/ConfigContext';
import {useLabels} from '../i18n';
import {useDebouncedCommit} from './useDebouncedCommit';

// Reading a stored value back needs the format it was written in. dayjs only honours a
// format argument with this plugin, and extending twice is a no-op, so it does not matter
// that the pickers' own adapter loads it too.
dayjs.extend(customParseFormat);

interface DateFilterProps<TData> {
  readonly column: Column<TData>;
  /** The column's name, which is what a screen reader calls the control. */
  readonly label?: string;
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

/**
 * Parsed with the format the value was written in. Left to guess, dayjs reads `03/04/2025`
 * as the 4th of March whatever `dateFormats.value` says, and cannot read `25/04/2025` at all.
 */
function toDayjs(value: string | undefined | null, format: string): Dayjs | null {
  return value ? dayjs(value, format) : null;
}

function formatDayjs(value: Dayjs | null, format: string): string | undefined {
  return value?.isValid() ? value.format(format) : undefined;
}

// ---------------------------------------------------------------------------
// Shared clear button
// ---------------------------------------------------------------------------

function ClearButton({visible, onClear}: Readonly<{visible: boolean; onClear: () => void}>) {
  const labels = useLabels();
  if (!visible) return null;
  return (
    <IconButton size="small" onClick={onClear} aria-label={labels.reset}>
      <ClearIcon sx={{fontSize: '0.875rem'}} />
    </IconButton>
  );
}

// ---------------------------------------------------------------------------
// Single date filter
// ---------------------------------------------------------------------------

function SingleDateFilter<TData>({
  column,
  label,
  filterValue,
  debounceMs,
}: Readonly<{column: Column<TData>; label?: string; filterValue: string | undefined; debounceMs: number}>) {
  const formats = useDateFormats();
  const [local, setLocal] = useState<Dayjs | null>(toDayjs(filterValue, formats.value));

  // Sync from external filter value (React "adjust state during render" pattern)
  const [prev, setPrev] = useState(filterValue);
  if (prev !== filterValue) {
    setPrev(filterValue);
    setLocal(toDayjs(filterValue, formats.value));
  }

  useDebouncedCommit(
    () => {
      const str = formatDayjs(local, formats.value);
      if (str !== filterValue) {
        column.setFilterValue(str);
      }
    },
    local,
    debounceMs,
  );

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
        slotProps={{...pickerSlotProps, textField: {...pickerSlotProps.textField, 'aria-label': label}}}
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
  label,
  filterValue,
  debounceMs,
}: Readonly<{column: Column<TData>; label?: string; filterValue: DateRangeValue | undefined; debounceMs: number}>) {
  const labels = useLabels();
  const formats = useDateFormats();
  const [localFrom, setLocalFrom] = useState<Dayjs | null>(toDayjs(filterValue?.from, formats.value));
  const [localTo, setLocalTo] = useState<Dayjs | null>(toDayjs(filterValue?.to, formats.value));

  // Sync from external filter value (React "adjust state during render" pattern)
  const [prev, setPrev] = useState(filterValue);
  if (prev !== filterValue) {
    setPrev(filterValue);
    setLocalFrom(toDayjs(filterValue?.from, formats.value));
    setLocalTo(toDayjs(filterValue?.to, formats.value));
  }

  useDebouncedCommit(
    () => {
      const fromStr = formatDayjs(localFrom, formats.value);
      const toStr = formatDayjs(localTo, formats.value);

      if (fromStr || toStr) {
        if (filterValue?.from !== fromStr || filterValue?.to !== toStr) {
          column.setFilterValue({from: fromStr, to: toStr});
        }
      } else if (filterValue !== undefined) {
        column.setFilterValue(undefined);
      }
    },
    // One value that changes when either end does.
    `${localFrom?.valueOf()}|${localTo?.valueOf()}`,
    debounceMs,
  );

  const handleClear = () => {
    setLocalFrom(null);
    setLocalTo(null);
    column.setFilterValue(undefined);
  };

  const hasValue = localFrom !== null || localTo !== null;

  return (
    <Box role="group" aria-label={label} sx={{display: 'flex', gap: 0.5, alignItems: 'center'}}>
      <DatePicker
        value={localFrom}
        onChange={setLocalFrom}
        maxDate={localTo ?? undefined}
        format={formats.display}
        slotProps={{
          ...pickerSlotProps,
          textField: {
            ...pickerSlotProps.textField,
            // v9 pickers always render the accessible (sectioned) field, which has no
            // placeholder. The name is what told these two fields apart, so it moves to
            // the accessible name.
            'aria-label': labels.from,
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
            // v9 pickers always render the accessible (sectioned) field, which has no
            // placeholder. The name is what told these two fields apart, so it moves to
            // the accessible name.
            'aria-label': labels.to,
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

export function DateFilter<TData>({
  column,
  label,
  showRange = true,
  debounceMs = 500,
}: Readonly<DateFilterProps<TData>>) {
  // `useReactTable` hands back the same column object on every render, so the compiler
  // would cache `getFilterValue()` against it and the sync below would never see a filter
  // set or cleared from elsewhere. Rendering one small control costs nothing to repeat.
  'use no memo';

  const filterValue = column.getFilterValue() as DateRangeValue | string | undefined;
  const isRangeMode = showRange && (typeof filterValue === 'object' || filterValue === undefined);

  if (!isRangeMode) {
    const singleValue = typeof filterValue === 'string' ? filterValue : undefined;
    return <SingleDateFilter column={column} label={label} filterValue={singleValue} debounceMs={debounceMs} />;
  }

  const rangeValue = typeof filterValue === 'object' ? filterValue : undefined;
  return <RangeDateFilter column={column} label={label} filterValue={rangeValue} debounceMs={debounceMs} />;
}

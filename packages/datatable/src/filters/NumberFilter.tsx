import ClearIcon from '@mui/icons-material/Clear';
import {Box, IconButton, InputAdornment, TextField} from '@mui/material';
import type {Column} from '@tanstack/react-table';
import {useEffect, useRef, useState} from 'react';

import {useLabels} from '../i18n';

interface NumberFilterProps<TData> {
  readonly column: Column<TData>;
  /** The column's name, which is what a screen reader calls the control. */
  readonly label?: string;
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  readonly debounceMs?: number;
  readonly showRange?: boolean;
}

// TanStack's inNumberRange filter expects a tuple [min, max] with null for absent bounds
type NumberRangeTuple = readonly [number | null, number | null];

/** What this column's filter can hold: a range, a single bound, or nothing. */
type NumberFilterValue = NumberRangeTuple | number | undefined;

/**
 * A bound the user has actually finished typing. `Number('-')`, `Number('.')` and
 * `Number('-.')` are all NaN, and NaN is not null, so committing them straight would
 * hand `[NaN, null]` to the row model and then paint the literal text "NaN" back into
 * the box the user is still typing in.
 */
function toBound(raw: string): number | null {
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The range filter value for a pair of raw entries, or `undefined` when neither is a bound. */
function toRangeValue(minRaw: string, maxRaw: string): NumberRangeTuple | undefined {
  const min = toBound(minRaw);
  const max = toBound(maxRaw);
  return min === null && max === null ? undefined : [min, max];
}

function isSameFilterValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a[0] === b[0] && a[1] === b[1];
  return a === b;
}

/**
 * Commits only a genuine change. TanStack hands back a new `columnFilters` array even
 * when the update removed nothing, so an unconditional write on mount, on blur or on
 * unmount reads downstream as a filter change and refetches the list for nothing.
 *
 * Module-level so the effects below can call it without listing it as a dependency,
 * which would restart the debounce timer on every render.
 */
function commitFilterValue<TData>(column: Column<TData>, next: NumberFilterValue): void {
  if (!isSameFilterValue(column.getFilterValue(), next)) {
    column.setFilterValue(next);
  }
}

/** A filter value as something two renders can compare. */
function keyOf(value: NumberFilterValue): string {
  return JSON.stringify(value ?? null);
}

/** Returns the local display string for a synced numeric field, preserving partial inputs like "1." */
function syncedField(localValue: string, externalValue: number | null): string {
  if (externalValue == null) return '';
  if (localValue !== '' && Number(localValue) === externalValue) return localValue;
  return String(externalValue);
}

/** Computes synced local display values from an external filter value. */
function getSyncedValues(
  filterValue: NumberFilterValue,
  localMin: string,
  localMax: string,
  localSingle: string,
): {min: string; max: string; single: string} {
  if (Array.isArray(filterValue)) {
    return {
      min: syncedField(localMin, filterValue[0]),
      max: syncedField(localMax, filterValue[1]),
      single: localSingle,
    };
  }
  if (typeof filterValue === 'number') {
    const preserve = localSingle !== '' && Number(localSingle) === filterValue;
    return {min: localMin, max: localMax, single: preserve ? localSingle : String(filterValue)};
  }
  return {min: '', max: '', single: ''};
}

export function NumberFilter<TData>({
  column,
  label,
  placeholder,
  min: minLimit,
  debounceMs = 500,
  showRange = true,
}: Readonly<NumberFilterProps<TData>>) {
  const labels = useLabels();
  const filterValue = column.getFilterValue() as NumberFilterValue;

  // Determine if we're using range or single value mode
  const isRangeMode = showRange && (Array.isArray(filterValue) || filterValue === undefined);

  // type="text" + inputMode="decimal" avoids the browser returning e.target.value=""
  // for partial decimals like "5." (which clears the input mid-typing with type="number").
  // Allow negative only when min is unset or explicitly negative.
  const allowNegative = minLimit == null || minLimit < 0;
  const partialNumberPattern = allowNegative ? /^-?\d*(?:\.\d*)?$/ : /^\d*(?:\.\d*)?$/;
  const isValidPartialNumber = (val: string) => val === '' || partialNumberPattern.test(val);

  // Local state for debouncing
  const [localMin, setLocalMin] = useState<string>(() => {
    if (!Array.isArray(filterValue) || filterValue[0] == null) return '';
    return String(filterValue[0]);
  });
  const [localMax, setLocalMax] = useState<string>(() => {
    if (!Array.isArray(filterValue) || filterValue[1] == null) return '';
    return String(filterValue[1]);
  });
  const [localSingle, setLocalSingle] = useState<string>(typeof filterValue === 'number' ? String(filterValue) : '');

  // Refs to always have current values for flush-on-unmount (avoids stale closures)
  const localMinRef = useRef(localMin);
  const localMaxRef = useRef(localMax);
  const localSingleRef = useRef(localSingle);
  const columnRef = useRef(column);
  const isRangeModeRef = useRef(isRangeMode);

  useEffect(() => {
    localMinRef.current = localMin;
    localMaxRef.current = localMax;
    localSingleRef.current = localSingle;
    columnRef.current = column;
    isRangeModeRef.current = isRangeMode;
  });

  const filterValueKey = keyOf(filterValue);

  // The last value this filter pushed out. Anything else arriving in `filterValue` came
  // from somewhere else (a toolbar reset, a restored URL) and is the only thing allowed to
  // overwrite the boxes: echoing our own debounced commit back into them drops the digit
  // typed while that commit was in flight.
  const [committedKey, setCommittedKey] = useState(filterValueKey);

  // Flush pending value immediately — used on blur and on unmount
  const flushFilter = () => {
    const next = isRangeModeRef.current
      ? toRangeValue(localMinRef.current, localMaxRef.current)
      : (toBound(localSingleRef.current) ?? undefined);

    setCommittedKey(keyOf(next));
    commitFilterValue(columnRef.current, next);
  };

  // Flush on unmount so closing the drawer always commits pending values
  useEffect(() => {
    return flushFilter;
  }, []);

  // Sync local values with filter value (handles external clears and URL state restores).
  // Uses "adjusting state during render" pattern (React-recommended) instead of useEffect
  // to avoid set-state-in-effect. Preserves partial inputs (e.g. "1.") that parse to the same number.
  const [prevFilterValueKey, setPrevFilterValueKey] = useState(filterValueKey);

  const changed = filterValueKey !== prevFilterValueKey;
  if (changed) setPrevFilterValueKey(filterValueKey);
  if (changed && filterValueKey !== committedKey) {
    setCommittedKey(filterValueKey);
    const synced = getSyncedValues(filterValue, localMin, localMax, localSingle);
    setLocalMin(synced.min);
    setLocalMax(synced.max);
    setLocalSingle(synced.single);
  }

  // Debounce filter changes for range mode.
  // columnRef.current is used instead of column to avoid restarting the timer on every
  // DataTable re-render (TanStack Table creates a new column object reference after each
  // setFilterValue call, which previously caused an infinite 500 ms re-render loop).
  useEffect(() => {
    if (!isRangeMode) return;

    const timer = setTimeout(() => {
      const next = toRangeValue(localMin, localMax);
      setCommittedKey(keyOf(next));
      commitFilterValue(columnRef.current, next);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localMin, localMax, debounceMs, isRangeMode]);

  // Debounce filter changes for single value mode.
  // Same reasoning as above — columnRef.current avoids the infinite re-render loop.
  useEffect(() => {
    if (isRangeMode) return;

    const timer = setTimeout(() => {
      const next = toBound(localSingle) ?? undefined;
      setCommittedKey(keyOf(next));
      commitFilterValue(columnRef.current, next);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localSingle, debounceMs, isRangeMode]);

  const handleClear = () => {
    setLocalMin('');
    setLocalMax('');
    setLocalSingle('');
    setCommittedKey(keyOf(undefined));
    column.setFilterValue(undefined);
  };

  const hasValue = isRangeMode ? localMin !== '' || localMax !== '' : localSingle !== '';

  if (!isRangeMode) {
    return (
      <TextField
        size="small"
        fullWidth
        type="text"
        inputMode="decimal"
        value={localSingle}
        onChange={(e) => {
          if (isValidPartialNumber(e.target.value)) setLocalSingle(e.target.value);
        }}
        onBlur={flushFilter}
        placeholder={placeholder ?? labels.enterValue}
        slotProps={{
          htmlInput: {'aria-label': label},
          input: {
            endAdornment: hasValue ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClear} edge="end" aria-label={labels.reset}>
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

  return (
    <Box role="group" aria-label={label} sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
      <TextField
        size="small"
        type="text"
        inputMode="decimal"
        value={localMin}
        onChange={(e) => {
          if (isValidPartialNumber(e.target.value)) setLocalMin(e.target.value);
        }}
        onBlur={flushFilter}
        placeholder={labels.from}
        slotProps={{htmlInput: {'aria-label': labels.from}}}
        sx={{
          flex: 1,
          '& .MuiInputBase-input': {
            fontSize: '0.8125rem',
            py: 0.75,
          },
        }}
      />
      <Box sx={{color: 'text.secondary'}}>-</Box>
      <TextField
        size="small"
        type="text"
        inputMode="decimal"
        value={localMax}
        onChange={(e) => {
          if (isValidPartialNumber(e.target.value)) setLocalMax(e.target.value);
        }}
        onBlur={flushFilter}
        placeholder={labels.to}
        slotProps={{htmlInput: {'aria-label': labels.to}}}
        sx={{
          flex: 1,
          '& .MuiInputBase-input': {
            fontSize: '0.8125rem',
            py: 0.75,
          },
        }}
      />
      {hasValue && (
        <IconButton size="small" onClick={handleClear} aria-label={labels.reset}>
          <ClearIcon sx={{fontSize: '0.875rem'}} />
        </IconButton>
      )}
    </Box>
  );
}

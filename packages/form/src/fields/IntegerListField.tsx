import Chip from '@mui/material/Chip';
import MuiTextField from '@mui/material/TextField';
import type {AnyFieldApi} from '@tanstack/react-form';
import {useStore} from '@tanstack/react-form';
import {useEffect, useState} from 'react';

import {useFieldSize, useFormConfig} from '../config/FormConfigContext.js';
import type {FormLabels} from '../config/labels.js';
import {useFieldContext} from '../context.js';
import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NUMBER_ARRAY} from '../core/valueChecks.js';
import {rangeText} from './NumberField.js';

export interface IntegerListFieldProps extends CommonFieldProps {
  /** The lowest entry allowed. An entry below it stays on screen as an error chip. */
  readonly min?: number;
  /** The highest entry allowed. */
  readonly max?: number;
  /** Shown on each chip, such as `min` for "15 min". Pass it translated. */
  readonly unit?: string;
  /** Default false: a repeat becomes an error chip. */
  readonly allowDuplicates?: boolean;
  /** Default false: entries keep the order they were typed in. True sorts them on commit. */
  readonly sorted?: boolean;
}

/** An entry the user typed that is not in the value, with the reason. */
interface Rejected {
  readonly text: string;
  readonly message: string;
}

interface Rules {
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly allowDuplicates: boolean;
  readonly labels: FormLabels;
}

function problemWith(entry: string, values: readonly number[], {min, max, allowDuplicates, labels}: Rules) {
  const value = Number(entry);
  if (!/^[+-]?\d+$/.test(entry) || !Number.isSafeInteger(value)) return labels.integerListInvalid(entry);
  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    return labels.integerListOutOfRange(entry, min, max);
  }
  if (!allowDuplicates && values.includes(value)) return labels.integerListDuplicate(entry);
  return null;
}

/** Splits typed or pasted text on commas and sorts each piece into the list or out of it. */
function split(text: string, values: readonly number[], rules: Rules) {
  const accepted = [...values];
  const rejected: Rejected[] = [];
  for (const piece of text.split(',')) {
    const entry = piece.trim();
    if (entry === '') continue;
    const message = problemWith(entry, accepted, rules);
    if (message === null) accepted.push(Number(entry));
    else rejected.push({text: entry, message});
  }
  return {accepted, rejected};
}

const sameList = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * A rejected entry is not in the value, so no validator ever sees it. The field reports it
 * through `errorMap.onMount`, the one key TanStack's change, blur and submit validation never
 * rewrite, so the error holds and blocks submit until the entry is fixed or removed. A
 * consumer's own `onMount` validator on this field runs only at mount, before any entry exists.
 *
 * The effect keys on the form and the field name, not on `field`: the field object gets a new
 * identity whenever its state changes, and writing the error changes its state, so keying on it
 * would clear and rewrite the error forever.
 */
function useRejectionError(field: AnyFieldApi, message: string | undefined) {
  const {form, name} = field;
  useEffect(() => {
    if (message === undefined) return;
    form.setFieldMeta(name, (meta) => ({...meta, errorMap: {...meta.errorMap, onMount: message}}));
    return () => form.setFieldMeta(name, (meta) => ({...meta, errorMap: {...meta.errorMap, onMount: undefined}}));
  }, [form, name, message]);
}

/**
 * A list of whole numbers, such as reminder offsets, typed as chips. Comma, `Enter` or blur
 * commits the typed entry; a pasted "15, 30, 60" becomes three chips. The value is always a
 * `number[]`.
 */
export function IntegerListField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  size,
  min,
  max,
  unit,
  allowDuplicates = false,
  sorted = false,
}: Readonly<IntegerListFieldProps>) {
  const {labels} = useFormConfig();
  const fieldSize = useFieldSize(size);
  const field = useFieldContext<number[]>();
  const binding = useFieldBinding<number[]>({required, expect: NUMBER_ARRAY});
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const values = Array.isArray(binding.value) ? binding.value.filter((value) => Number.isFinite(value)) : [];
  const [draft, setDraft] = useState('');

  // Rejected entries belong to the value they were typed against. A value set from outside
  // the field (a load) clears them, and so does a reset, which leaves the field untouched.
  const [held, setHeld] = useState<{source: unknown; rejected: readonly Rejected[]}>({
    source: binding.value,
    rejected: [],
  });
  let rejected = held.rejected;
  if (held.source !== binding.value || (!isTouched && rejected.length > 0)) {
    rejected = [];
    setHeld({source: binding.value, rejected});
  }
  useRejectionError(field, rejected[0]?.message);

  const write = (nextValues: number[], nextRejected: readonly Rejected[]) => {
    // Touched first, in the same event, so the render that shows an error chip never sees an
    // untouched field and mistakes it for a reset.
    if (nextRejected.length > 0) field.setMeta((meta) => ({...meta, isTouched: true}));
    const changed = !sameList(nextValues, values);
    setHeld({source: changed ? nextValues : binding.value, rejected: nextRejected});
    if (changed) binding.setValue(nextValues);
  };

  const commit = (text: string) => {
    const {accepted, rejected: added} = split(text, values, {min, max, allowDuplicates, labels});
    write(sorted ? accepted.sort((a, b) => a - b) : accepted, [...rejected, ...added]);
  };

  const chips = [
    ...values.map((value, index) => {
      const text = unit ? `${value} ${unit}` : String(value);
      const remove = () =>
        write(
          values.filter((_, at) => at !== index),
          rejected,
        );
      return (
        <Chip
          key={`value-${index}`}
          label={text}
          size="small"
          disabled={disabled}
          aria-label={labels.removeEntry(text)}
          onClick={remove}
          onDelete={remove}
        />
      );
    }),
    ...rejected.map((entry, index) => {
      const remove = () =>
        write(
          values,
          rejected.filter((_, at) => at !== index),
        );
      return (
        <Chip
          key={`rejected-${index}`}
          label={entry.text}
          title={entry.message}
          size="small"
          color="error"
          variant="outlined"
          disabled={disabled}
          aria-label={labels.removeEntry(entry.text)}
          onClick={remove}
          onDelete={remove}
        />
      );
    }),
  ];

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description ?? rangeText(labels, min, max)}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTextField
        id={binding.inputId}
        value={draft}
        onChange={(event) => {
          // A typed comma commits what is before it; whatever follows stays as the draft.
          const text = event.target.value;
          const cut = text.lastIndexOf(',');
          if (cut === -1) {
            setDraft(text);
            return;
          }
          commit(text.slice(0, cut));
          setDraft(text.slice(cut + 1));
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData('text');
          if (!pasted.includes(',')) return;
          event.preventDefault();
          commit(draft + pasted);
          setDraft('');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && draft.trim() !== '') {
            // The entry, not the form: Enter here commits a chip instead of submitting.
            event.preventDefault();
            commit(draft);
            setDraft('');
          } else if (event.key === 'Backspace' && draft === '') {
            if (rejected.length > 0) write(values, rejected.slice(0, -1));
            else if (values.length > 0) write(values.slice(0, -1), rejected);
          }
        }}
        onBlur={() => {
          if (draft.trim() !== '') commit(draft);
          setDraft('');
          binding.onBlur();
        }}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        size={fieldSize}
        fullWidth
        slotProps={{
          htmlInput: {...binding.inputProps, inputMode: 'numeric'},
          input: {
            startAdornment: chips.length > 0 ? chips : undefined,
            sx: {flexWrap: 'wrap', gap: 0.5, '& .MuiInputBase-input': {flex: 1, minWidth: 64}},
          },
        }}
      />
    </FieldShell>
  );
}

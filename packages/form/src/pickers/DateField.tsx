import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {usePickerAdapter} from '@mui/x-date-pickers/hooks';

import {LabelledByShell} from '../core/LabelledByShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {dateFromString, dateToString, isDateString} from './dateStrings';
import {pickerSlotProps} from './pickerSlotProps';
import type {PickerBinding} from './pickerSlotProps';
import {usePickerDraft} from './usePickerDraft';

export interface DateFieldProps extends CommonFieldProps {
  /** `YYYY-MM-DD`. */
  readonly minDate?: string;
  /** `YYYY-MM-DD`. */
  readonly maxDate?: string;
  readonly disablePast?: boolean;
  readonly disableFuture?: boolean;
}

export const NULLABLE_DATE_STRING: ValueExpectation = {
  test: (value) => value === null || isDateString(value),
  description: "a 'YYYY-MM-DD' string or null",
};

/**
 * A calendar day, stored as `'YYYY-MM-DD'` so no timezone can move it. The layout is
 * `LabelledByShell`: the picker is a group of sections, not an input a `<label for>` can name.
 */
export function DateField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  minDate,
  maxDate,
  disablePast,
  disableFuture,
}: Readonly<DateFieldProps>) {
  const binding = useFieldBinding<string | null>({required, expect: NULLABLE_DATE_STRING});

  return (
    <LabelledByShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <DateInput
        binding={binding}
        labelledBy={binding.labelId}
        value={binding.value ?? null}
        onChange={binding.setValue}
        minDate={minDate}
        maxDate={maxDate}
        disablePast={disablePast}
        disableFuture={disableFuture}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </LabelledByShell>
  );
}

export interface DateInputProps extends Pick<DateFieldProps, 'minDate' | 'maxDate' | 'disablePast' | 'disableFuture'> {
  readonly binding: PickerBinding;
  /** The id of the element that names this picker. */
  readonly labelledBy: string;
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

/** One `DatePicker` over a `'YYYY-MM-DD'` value. `DateField` renders one, `DateRangeField` two. */
export function DateInput({
  binding,
  labelledBy,
  value,
  onChange,
  minDate,
  maxDate,
  disablePast,
  disableFuture,
  disabled,
  autoFocus,
}: Readonly<DateInputProps>) {
  const adapter = usePickerAdapter();
  const {draft, change} = usePickerDraft(value, dateFromString, dateToString, onChange);

  return (
    <DatePicker
      value={draft}
      onChange={change}
      onClose={binding.onBlur}
      disabled={disabled}
      autoFocus={autoFocus}
      minDate={dateFromString(adapter, minDate ?? null) ?? undefined}
      maxDate={dateFromString(adapter, maxDate ?? null) ?? undefined}
      disablePast={disablePast}
      disableFuture={disableFuture}
      slotProps={pickerSlotProps(binding, labelledBy)}
    />
  );
}

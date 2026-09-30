import {useFormConfig} from '../config/FormConfigContext.js';
import {useFieldContext} from '../context.js';
import {FieldPart, FieldParts} from '../core/FieldParts.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {ValueExpectation} from '../core/valueChecks.js';
import {DateInput, NULLABLE_DATE_STRING} from './DateField.js';
import type {DateInputProps} from './DateField.js';
import {isDateString} from './dateStrings.js';

export interface DateRange {
  readonly start: string | null;
  readonly end: string | null;
}

export interface DateRangeFieldProps extends CommonFieldProps {
  /** `YYYY-MM-DD`. */
  readonly minDate?: string;
  /** `YYYY-MM-DD`. */
  readonly maxDate?: string;
}

const DATE_RANGE: ValueExpectation = {
  test: (value) =>
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    'end' in value &&
    NULLABLE_DATE_STRING.test(value.start) &&
    NULLABLE_DATE_STRING.test(value.end),
  description: "{start, end} of 'YYYY-MM-DD' strings or null",
};

const EMPTY: DateRange = {start: null, end: null};

/** Each end on its own, so one unusable end does not blank the other. */
function readRange(value: unknown): DateRange {
  if (typeof value !== 'object' || value === null) return EMPTY;
  const start = 'start' in value && isDateString(value.start) ? value.start : null;
  const end = 'end' in value && isDateString(value.end) ? value.end : null;
  return {start, end};
}

/**
 * Two linked date pickers in one fieldset. MUI's DateRangePicker is in the paid Pro
 * package. Each end limits the other: an end typed before the start (or a start after the
 * end) shows as invalid and is stored as null, until a change to the other end makes it
 * valid and it is stored. Any other rule between the two (a maximum length, end required
 * once start is set) belongs in the schema.
 */
export function DateRangeField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  minDate,
  maxDate,
}: Readonly<DateRangeFieldProps>) {
  const binding = useFieldBinding<DateRange>({required, expect: DATE_RANGE});
  // Writes read the value at that moment: both ends can settle in one commit.
  const field = useFieldContext<unknown>();
  const {labels} = useFormConfig();
  const range = readRange(binding.value);

  return (
    <FieldParts
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <RangeEnd
        binding={binding}
        labelledBy={`${binding.labelId}-start`}
        caption={labels.rangeStart}
        value={range.start}
        onChange={(start) => binding.setValue({...readRange(field.form.getFieldValue(field.name)), start})}
        minDate={minDate}
        maxDate={range.end ?? maxDate}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <RangeEnd
        binding={binding}
        labelledBy={`${binding.labelId}-end`}
        caption={labels.rangeEnd}
        value={range.end}
        onChange={(end) => binding.setValue({...readRange(field.form.getFieldValue(field.name)), end})}
        minDate={range.start ?? minDate}
        maxDate={maxDate}
        disabled={disabled}
      />
    </FieldParts>
  );
}

interface RangeEndProps extends DateInputProps {
  readonly caption: string;
}

/** One end of the range: its caption names the picker through `aria-labelledby`. */
function RangeEnd({caption, ...input}: Readonly<RangeEndProps>) {
  return (
    <FieldPart captionId={input.labelledBy} caption={caption} minWidth={180}>
      <DateInput {...input} />
    </FieldPart>
  );
}

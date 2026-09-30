import {useFormConfig} from '../config/FormConfigContext';
import {FieldPart, FieldParts} from '../core/FieldParts';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {DateInput, NULLABLE_DATE_STRING} from './DateField';
import type {DateInputProps} from './DateField';

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

/**
 * Two linked date pickers in one fieldset. MUI's DateRangePicker is in the paid Pro
 * package. The end picker cannot go before the start; any other rule between the two
 * (a maximum length, end required once start is set) belongs in the schema.
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
  const {labels} = useFormConfig();
  const range = DATE_RANGE.test(binding.value) ? binding.value : EMPTY;

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
        onChange={(start) => binding.setValue({...range, start})}
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
        onChange={(end) => binding.setValue({...range, end})}
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

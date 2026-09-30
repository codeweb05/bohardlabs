import type {FieldBinding} from '../core/useFieldBinding.js';

/** The part of a binding a picker reads. */
export type PickerBinding = Pick<FieldBinding<unknown>, 'error' | 'onBlur' | 'inputProps'>;

/**
 * The slot props every picker in this entry passes. MUI X 9 renders the field as a
 * `role="group"` of spinbutton sections with the value in a hidden `<input>`, so there is no
 * input for a `<label for>` to point at. `textField.slotProps.input` reaches the group
 * element: the binding's aria wiring and `data-form-id` go there, and `aria-labelledby`
 * names it. `aria-required` is the exception, since ARIA does not allow it on a group; it
 * goes on each spinbutton section instead.
 *
 * `error` is left undefined while the form has no error, and `aria-invalid` is left to MUI:
 * a defined `error` replaces the picker's own validation (minDate, maxDate, a half-typed
 * date on blur), which would then never show.
 */
export function pickerSlotProps(binding: PickerBinding, labelledBy: string) {
  const {inputProps} = binding;
  return {
    textField: {
      onBlur: binding.onBlur,
      error: binding.error !== null || undefined,
      fullWidth: true,
      slotProps: {
        input: {
          'aria-labelledby': labelledBy,
          'aria-describedby': inputProps['aria-describedby'],
          'data-form-id': inputProps['data-form-id'],
          slotProps: {sectionContent: {'aria-required': inputProps['aria-required']}},
        },
      },
    },
  };
}

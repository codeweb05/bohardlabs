import type {FieldBinding} from '../core/useFieldBinding';

/** The part of a binding a picker reads. */
export type PickerBinding = Pick<FieldBinding<unknown>, 'error' | 'onBlur' | 'inputProps'>;

/**
 * The slot props every picker in this entry passes. MUI X 9 renders the field as a
 * `role="group"` of spinbutton sections with the value in a hidden `<input>`, so there is no
 * input for a `<label for>` to point at. `textField.slotProps.input` reaches the group
 * element: the binding's aria wiring and `data-form-id` go there, and `aria-labelledby`
 * names it. The one exception is `aria-required`, which ARIA does not allow on a group; it
 * goes on each spinbutton section instead.
 */
export function pickerSlotProps(binding: PickerBinding, labelledBy: string) {
  const {'aria-required': required, ...groupProps} = binding.inputProps;
  return {
    textField: {
      onBlur: binding.onBlur,
      error: binding.error !== null,
      fullWidth: true,
      slotProps: {
        input: {
          'aria-labelledby': labelledBy,
          ...groupProps,
          slotProps: {sectionContent: {'aria-required': required}},
        },
      },
    },
  };
}

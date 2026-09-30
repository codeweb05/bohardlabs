import {ToggleField} from './ToggleField.js';
import type {ToggleFieldProps} from './ToggleField.js';

export type CheckboxFieldProps = ToggleFieldProps;

export function CheckboxField(props: Readonly<CheckboxFieldProps>) {
  return <ToggleField {...props} control="checkbox" />;
}

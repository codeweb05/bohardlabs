import {ToggleField} from './ToggleField';
import type {ToggleFieldProps} from './ToggleField';

export type CheckboxFieldProps = ToggleFieldProps;

export function CheckboxField(props: Readonly<CheckboxFieldProps>) {
  return <ToggleField {...props} control="checkbox" />;
}

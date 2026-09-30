import {ToggleField} from './ToggleField.js';
import type {ToggleFieldProps} from './ToggleField.js';

export type SwitchFieldProps = ToggleFieldProps;

/** For a setting that applies at once in the user's mind (notifications on or off). */
export function SwitchField(props: Readonly<SwitchFieldProps>) {
  return <ToggleField {...props} control="switch" />;
}

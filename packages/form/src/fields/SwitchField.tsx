import {ToggleField} from './ToggleField';
import type {ToggleFieldProps} from './ToggleField';

export type SwitchFieldProps = ToggleFieldProps;

/** For a setting that applies at once in the user's mind (notifications on or off). */
export function SwitchField(props: Readonly<SwitchFieldProps>) {
  return <ToggleField {...props} control="switch" />;
}

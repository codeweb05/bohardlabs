import {TextField} from './TextField';
import type {TextFieldProps} from './TextField';

export type TextAreaProps = Omit<TextFieldProps, 'multiline' | 'type'>;

/** `TextField` with `multiline` on and three rows to start. */
export function TextArea({minRows = 3, ...props}: Readonly<TextAreaProps>) {
  return <TextField {...props} multiline minRows={minRows} />;
}

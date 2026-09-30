import {TextField} from './TextField.js';
import type {TextFieldProps} from './TextField.js';

export type TextAreaProps = Omit<TextFieldProps, 'multiline' | 'type'>;

/** `TextField` with `multiline` on and three rows to start. */
export function TextArea({minRows = 3, ...props}: Readonly<TextAreaProps>) {
  return <TextField {...props} multiline minRows={minRows} />;
}

import {useId} from 'react';

import type {VariableSpec} from '../types.js';
import {useStrings} from './strings.js';
import {fromLocal, toLocal, variableLabel} from './values.js';

/** One variable's field, typed by its spec; a refusal shows under it. */
export function VariableField({
  variable,
  value,
  error,
  onChange,
}: Readonly<{
  variable: VariableSpec;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}>) {
  const strings = useStrings();
  const id = useId();
  const hints: Partial<Record<VariableSpec['type'], string>> = {url: strings.hintUrl, datetime: strings.hintDatetime};
  const hint = hints[variable.type];
  const hasHint = hint !== undefined;
  const describedBy = [hasHint ? `${id}-hint` : '', error === undefined ? '' : `${id}-error`].join(' ').trim();
  const common = {
    id,
    className: 'np-input',
    'aria-invalid': error === undefined ? undefined : true,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
  } as const;

  const field = (() => {
    switch (variable.type) {
      case 'enum':
        return (
          <select
            {...common}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          >
            {(variable.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'datetime':
        return (
          <input
            {...common}
            type="datetime-local"
            step="1"
            value={toLocal(value)}
            onChange={(event) => {
              onChange(fromLocal(event.target.value));
            }}
          />
        );
      case 'number':
        return (
          <input
            {...common}
            type="number"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        );
      default:
        return (
          <input
            {...common}
            type={variable.type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        );
    }
  })();

  return (
    <div className="np-field">
      <label htmlFor={id} className="np-field-label">
        {variableLabel(variable.name)}
        <code className="np-field-name">{variable.name}</code>
      </label>
      {field}
      {hasHint ? (
        <p id={`${id}-hint`} className="np-hint">
          {hint}
        </p>
      ) : null}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="np-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

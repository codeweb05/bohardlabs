import {useId} from 'react';
import type {ReactNode} from 'react';

import {useStrings} from './strings.js';

export interface SegOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

/** A row of radio buttons drawn as one segmented control. */
export function Seg<T extends string>({
  legend,
  options,
  value,
  onChange,
}: Readonly<{
  legend: string;
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
}>) {
  const name = useId();
  return (
    <fieldset className="np-seg">
      <legend className="np-seg-legend">{legend}</legend>
      <div className="np-seg-options">
        {options.map((option) => (
          <label key={option.value} className="np-seg-option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span>
              {option.icon}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Previous and next, with the open notification's place between them. */
export function Pager({
  position,
  count,
  onStep,
}: Readonly<{position: number; count: number; onStep: (by: 1 | -1) => void}>) {
  const strings = useStrings();
  return (
    <div className="np-pager">
      <button
        type="button"
        className="np-icon-button"
        aria-label={strings.previous}
        title={strings.previous}
        disabled={count < 2}
        onClick={() => {
          onStep(-1);
        }}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span className="np-pager-position">{strings.position(position, count)}</span>
      <button
        type="button"
        className="np-icon-button"
        aria-label={strings.next}
        title={strings.next}
        disabled={count < 2}
        onClick={() => {
          onStep(1);
        }}
      >
        <span aria-hidden="true">›</span>
      </button>
      <span className="np-keys">
        <kbd>←</kbd>
        <kbd>→</kbd> {strings.keysHint}
      </span>
    </div>
  );
}

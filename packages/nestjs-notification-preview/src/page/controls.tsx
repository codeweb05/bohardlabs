import {useId} from 'react';
import type {ReactNode} from 'react';

import {useStrings} from './strings.js';

export interface SegOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

/**
 * A row of radio buttons drawn as one segmented control. `iconOnly` shows each option's icon
 * alone; its label stays as the radio's name and the hover title.
 */
export function Seg<T extends string>({
  legend,
  options,
  value,
  onChange,
  iconOnly = false,
}: Readonly<{
  legend: string;
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  iconOnly?: boolean;
}>) {
  const name = useId();
  return (
    <fieldset className="np-seg" data-icons={iconOnly ? 'true' : undefined}>
      <legend className="np-seg-legend">{legend}</legend>
      <div className="np-seg-options">
        {options.map((option) => (
          <label key={option.value} className="np-seg-option" title={iconOnly ? option.label : undefined}>
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
              <span className={iconOnly ? 'np-visually-hidden' : undefined}>{option.label}</span>
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
        className="np-pager-button"
        aria-label={strings.previous}
        title={strings.previous}
        disabled={count < 2}
        onClick={() => {
          onStep(-1);
        }}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span className="np-pager-position" aria-live="polite">
        {strings.position(position, count)}
      </span>
      <button
        type="button"
        className="np-pager-button"
        aria-label={strings.next}
        title={strings.next}
        disabled={count < 2}
        onClick={() => {
          onStep(1);
        }}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

/** The arrow keys' hint, at the toolbar's end. */
export function KeysHint() {
  const strings = useStrings();
  return (
    <span className="np-keys">
      <kbd>←</kbd> <kbd>→</kbd> {strings.keysHint}
    </span>
  );
}

/** Props every field takes. Anything a user reads is a prop, so a consumer can translate it. */
export interface CommonFieldProps {
  /** Shown above the input and used as its accessible name. */
  readonly label: string;
  /** Helper text under the input. An error replaces it while one shows. */
  readonly description?: string;
  readonly required?: boolean;
  /** Extra context behind an info button beside the label. */
  readonly tooltip?: string;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

/** One choice in a select, radio group or autocomplete. */
export interface Option<V extends string | number> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
  readonly description?: string;
}

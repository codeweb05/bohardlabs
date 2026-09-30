import type {FormLabels} from '../config/labels.js';

/** The Autocomplete props that are words, taken from the labels so every Autocomplete here translates the same way. */
export function autocompleteText(labels: FormLabels) {
  return {
    noOptionsText: labels.noOptions,
    loadingText: labels.loading,
    clearText: labels.clear,
    openText: labels.open,
    closeText: labels.close,
  };
}

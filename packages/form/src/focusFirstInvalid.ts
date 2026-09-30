import type {AnyFormApi} from '@tanstack/react-form';

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to the first field of this form that shows an error, so a keyboard or
 * screen reader user lands on the problem instead of on a submit button that did nothing.
 *
 * It waits a tick because the errors TanStack just set have not rendered yet. Fields mark
 * their input with `data-form-id`, which keeps a second form on the page out of it; the
 * comparison is done in JavaScript because `CSS.escape` is missing in some test DOMs and
 * `useId` output needs escaping in a selector.
 */
export function focusFirstInvalid(form: AnyFormApi): void {
  setTimeout(() => {
    const candidates = document.querySelectorAll<HTMLElement>('[aria-invalid="true"][data-form-id]');
    const invalid = Array.from(candidates).find((element) => element.dataset.formId === form.formId);
    if (!invalid) return;
    // A radio group marks its container; focus goes to its first radio.
    const target = invalid.matches(FOCUSABLE) ? invalid : invalid.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, 0);
}

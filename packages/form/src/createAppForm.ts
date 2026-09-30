import {createFormHook} from '@tanstack/react-form';

import {fieldContext, formContext} from './context.js';
import {focusFirstInvalid} from './focusFirstInvalid.js';

/** What `createFormHook` accepts as a component map, taken from its own signature. */
type ComponentMap = Parameters<typeof createFormHook>[0]['fieldComponents'];

/**
 * Builds the consumer's form hook on the package's contexts. Call it once per app, at
 * module level, and register only the fields that app uses: every registered component
 * is in the bundle, so heavy fields go in through `lazyField`.
 *
 * The returned `useAppForm` focuses the first invalid field when a submit fails. A form
 * that passes its own `onSubmitInvalid` replaces that.
 *
 * @example
 * const {useAppForm} = createAppForm({
 *   fieldComponents: {TextField, PasswordField},
 *   formComponents: {SubmitButton, FormError},
 * });
 */
export function createAppForm<
  const TFieldComponents extends ComponentMap,
  const TFormComponents extends ComponentMap,
>(options: {readonly fieldComponents: TFieldComponents; readonly formComponents: TFormComponents}) {
  const hook = createFormHook({
    fieldComponents: options.fieldComponents,
    formComponents: options.formComponents,
    fieldContext,
    formContext,
  });

  const useAppForm: typeof hook.useAppForm = (formOptions) =>
    hook.useAppForm({
      ...formOptions,
      onSubmitInvalid: formOptions.onSubmitInvalid ?? (({formApi}) => focusFirstInvalid(formApi)),
    });

  return {...hook, useAppForm};
}

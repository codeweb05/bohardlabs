import {createFormHook} from '@tanstack/react-form';

import {fieldContext, formContext} from './context';

/** What `createFormHook` accepts as a component map, taken from its own signature. */
type ComponentMap = Parameters<typeof createFormHook>[0]['fieldComponents'];

/**
 * Builds the consumer's form hook on the package's contexts. Call it once per app, at
 * module level, and register only the fields that app uses: every registered component
 * is in the bundle, so heavy fields go in through `lazyField`.
 */
export function createAppForm<
  const TFieldComponents extends ComponentMap,
  const TFormComponents extends ComponentMap,
>(options: {readonly fieldComponents: TFieldComponents; readonly formComponents: TFormComponents}) {
  return createFormHook({
    fieldComponents: options.fieldComponents,
    formComponents: options.formComponents,
    fieldContext,
    formContext,
  });
}

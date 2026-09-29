import {createFormHookContexts} from '@tanstack/react-form';

/**
 * The package's only pair of form contexts. `createAppForm` hands them to
 * `createFormHook`, and every field reads them, so a consumer never creates a second pair.
 */
export const {fieldContext, formContext, useFieldContext, useFormContext} = createFormHookContexts();

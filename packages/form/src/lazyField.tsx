import {lazy, Suspense} from 'react';
import type {ComponentType, ReactNode} from 'react';

/**
 * Registers a heavy field without loading it. `createAppForm` needs a component for every
 * field up front; this hands it a small stub, and the real module loads the first time the
 * field renders.
 *
 *   const DateField = lazyField(() => import('@vt-labs/form/pickers').then((m) => m.DateField));
 *
 * Call it at module level. Called inside a component, it makes a new lazy component on
 * every render and the field remounts each time.
 */
export function lazyField<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ReactNode = null,
): ComponentType<P> {
  const Lazy = lazy(() => load().then((component) => ({default: component})));

  function LazyField(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return LazyField;
}

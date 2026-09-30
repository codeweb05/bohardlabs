let loading: Promise<void> | null = null;

/**
 * The only way into cropperjs. Importing it registers its custom elements, which touches
 * `customElements`, so it must never run on the server or at module load; the editor calls
 * this from an effect. A failed load is forgotten so the next attempt retries.
 */
export function loadCropper(): Promise<void> {
  loading ??= import('cropperjs').then(
    () => undefined,
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

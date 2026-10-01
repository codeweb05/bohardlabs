import {useEffect, useRef} from 'react';

/**
 * Runs `commit` once `pending` has been quiet for `delayMs`, and straight away if the
 * filter unmounts first. The drawer unmounts its filters as it closes, well inside the
 * delay, so without the second half a value chosen just before closing never reaches the
 * table.
 *
 * `commit` has to be safe to call when nothing changed: it runs on every unmount, touched
 * or not.
 */
export function useDebouncedCommit(commit: () => void, pending: unknown, delayMs: number): void {
  // The latest closure, so the timer and the unmount both commit what is on screen now
  // without `commit` being a dependency that restarts the wait on every render.
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });

  useEffect(() => {
    const timer = setTimeout(() => latest.current(), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  useEffect(() => () => latest.current(), []);
}

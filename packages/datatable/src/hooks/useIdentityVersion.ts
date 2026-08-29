import {useRef} from 'react';

/* eslint-disable react-hooks/refs --
   A setState-during-render version counter infinite-loops when `value` is a new
   reference every render. The write does not subscribe; it only bumps a number
   the body already reads. See the function comment.
*/

/**
 * Bumps a counter whenever `value` changes identity.
 *
 * The table reads rows and headers through a stable TanStack `table` reference, so a
 * new `data` or `columns` array has no input the React Compiler can see. The counter is
 * that input.
 *
 * This cannot be `useState` adjusted during render. A parent that passes a fresh array
 * on every render (inline `.map`, a test that rebuilds options) would then setState
 * during render, re-render, pass another fresh array, and loop. A ref write does not
 * schedule work, so an unstable identity only bumps the number the body already reads.
 */
export function useIdentityVersion(value: unknown): number {
  const prevRef = useRef(value);
  const versionRef = useRef(0);
  if (prevRef.current !== value) {
    prevRef.current = value;
    versionRef.current += 1;
  }
  return versionRef.current;
}

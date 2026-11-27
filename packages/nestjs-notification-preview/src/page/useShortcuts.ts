import {useEffect, useRef} from 'react';

export interface Shortcuts {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSearch: () => void;
}

/**
 * The arrow keys move between notifications and `/` goes to the search; a focused field
 * keeps every key. Shift is read for the arrows only: some keyboards type `/` with it.
 */
export function useShortcuts(shortcuts: Shortcuts): void {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [role="tab"]') !== null) {
        return;
      }
      if (event.key === 'ArrowLeft' && !event.shiftKey) latest.current.onPrevious();
      if (event.key === 'ArrowRight' && !event.shiftKey) latest.current.onNext();
      if (event.key === '/') {
        event.preventDefault();
        latest.current.onSearch();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

import {useEffect, useRef, useState} from 'react';

export interface Fullscreen {
  readonly isFullscreen: boolean;
  readonly toggle: () => void;
}

/**
 * The Display menu's fullscreen mode.
 *
 * The page goes fullscreen, not the table's own element, and the table then covers it. The
 * table's menus, popovers, drawers and dialogs portal into `document.body`; with the table
 * element fullscreen they would open outside the top layer and stay invisible. `Escape` is
 * the browser's own way out, and the `fullscreenchange` listener follows it.
 */
export function useFullscreen(): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Only the table that asked covers the page. Another table on it, or the host app going
  // fullscreen for its own reasons, leaves this one where it is.
  const requested = useRef(false);

  useEffect(() => {
    const handleChange = () => {
      const active = requested.current && document.fullscreenElement !== null;
      requested.current = active;
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      if (requested.current && document.fullscreenElement !== null) void document.exitFullscreen();
    };
  }, []);

  const toggle = () => {
    if (isFullscreen) {
      void document.exitFullscreen();
      return;
    }
    requested.current = true;
    document.documentElement.requestFullscreen().catch(() => {
      requested.current = false;
    });
  };

  return {isFullscreen, toggle};
}

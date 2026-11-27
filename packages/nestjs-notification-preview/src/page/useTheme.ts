import {useState} from 'react';

export type ThemeChoice = 'light' | 'auto' | 'dark';

// The store may be blocked or throw, as in a private window; the page then stays on Auto.
function readTheme(key: string): ThemeChoice {
  try {
    const stored = localStorage.getItem(key);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** Light or Dark is kept across visits in this browser; Auto follows the system. */
/** `key` is where the choice is kept in localStorage. */
export function useTheme(key: string): readonly [ThemeChoice, (choice: ThemeChoice) => void] {
  const [theme, setTheme] = useState(() => readTheme(key));
  const choose = (choice: ThemeChoice): void => {
    setTheme(choice);
    try {
      if (choice === 'auto') localStorage.removeItem(key);
      else localStorage.setItem(key, choice);
    } catch {
      // Kept for this visit only.
    }
  };
  return [theme, choose] as const;
}

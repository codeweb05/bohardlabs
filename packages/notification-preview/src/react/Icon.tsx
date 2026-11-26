export type IconName = 'envelope' | 'phone' | 'bell' | 'monitor' | 'sun' | 'half' | 'moon' | 'search' | 'copy' | 'send';

const PATHS: Readonly<Record<IconName, string>> = {
  envelope: 'M3 5h18v14H3z M3 6l9 7 9-7',
  phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
  monitor: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  sun: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  half: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z M12 3v18',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13z M15.5 15.5L20 20',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  send: 'M3 11l18-8-8 18-2-8z',
};

/** A line icon in the text's colour. Decorative: whatever it marks is named in words. */
export function Icon({name}: Readonly<{name: IconName}>) {
  return (
    <svg
      className="np-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

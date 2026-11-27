import {useStrings} from '../../strings.js';

/** The header's switch for test mode, which shows each notification's tick; off, the page is as it was. */
export function TestModeSwitch({on, onChange}: Readonly<{on: boolean; onChange: (on: boolean) => void}>) {
  const strings = useStrings();
  return (
    <button
      type="button"
      className="np-mode"
      role="switch"
      aria-checked={on}
      onClick={() => {
        onChange(!on);
      }}
    >
      <span className="np-track" aria-hidden="true" />
      <span>{strings.testMode}</span>
    </button>
  );
}

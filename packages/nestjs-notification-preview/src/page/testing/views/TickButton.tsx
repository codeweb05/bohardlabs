import {useStrings} from '../../strings.js';

/**
 * The toolbar's tick for the open notification. A real checkbox laid unseen over a label drawn
 * as a button, so a click anywhere on it is the checkbox's. Unticked while the render is still
 * on its way.
 */
export function TickButton({
  tested,
  disabled,
  onToggle,
}: Readonly<{tested: boolean; disabled: boolean; onToggle: () => void}>) {
  const strings = useStrings();
  return (
    <label className="np-check">
      <input type="checkbox" checked={tested} disabled={disabled} onChange={onToggle} />
      <span className="np-box" aria-hidden="true">
        {tested ? '✓' : ''}
      </span>
      <span>{tested ? strings.tested : strings.markTested}</span>
    </label>
  );
}

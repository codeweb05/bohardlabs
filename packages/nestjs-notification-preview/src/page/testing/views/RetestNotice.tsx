import {useStrings} from '../../strings.js';

/** The canvas's notice that the open notification renders differently from when it was ticked. */
export function RetestNotice() {
  const strings = useStrings();
  return (
    <p className="np-retest" role="status">
      <b>{strings.retestTitle}</b> {strings.retestBody}
    </p>
  );
}

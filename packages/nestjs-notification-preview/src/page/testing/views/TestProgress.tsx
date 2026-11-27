import {useStrings} from '../../strings.js';
import type {TestCount} from '../useTesting.js';

const share = (count: TestCount): string => `${String(count.total === 0 ? 0 : (count.tested / count.total) * 100)}%`;

/** How far the tester has got: tested over all, with a bar, and over each channel. */
export function TestProgress({all, email, push}: Readonly<{all: TestCount; email: TestCount; push: TestCount}>) {
  const strings = useStrings();
  const channels = [
    {channel: 'email', title: strings.channelEmail, count: email},
    {channel: 'push', title: strings.channelPush, count: push},
  ];
  return (
    <div className="np-progress" role="group" aria-label={strings.testProgress}>
      <div className="np-progress-row">
        <span>{strings.tested}</span>
        <b>{strings.testedOf(all.tested, all.total)}</b>
      </div>
      <div className="np-bar" aria-hidden="true">
        <i style={{width: share(all)}} />
      </div>
      <ul className="np-progress-channels">
        {channels
          .filter(({count}) => count.total > 0)
          .map(({channel, title, count}) => (
            <li key={channel} data-channel={channel}>
              <span>{title}</span> <b>{strings.testedOf(count.tested, count.total)}</b>
            </li>
          ))}
      </ul>
    </div>
  );
}

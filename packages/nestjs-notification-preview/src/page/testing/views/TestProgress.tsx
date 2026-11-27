import {Seg} from '../../controls.js';
import {useStrings} from '../../strings.js';
import type {TestFilter} from '../testedStore.js';
import type {TestCount, TestCounts} from '../useTesting.js';

const share = (part: number, total: number): string => `${String(total === 0 ? 0 : (part / total) * 100)}%`;

/**
 * How far the tester has got: tested over all with a bar of tested and changed, how many
 * changed and are not tested, each channel's count, and the filter to what is left.
 */
export function TestProgress({
  counts,
  filter,
  onFilter,
}: Readonly<{counts: TestCounts; filter: TestFilter; onFilter: (filter: TestFilter) => void}>) {
  const strings = useStrings();
  const {all} = counts;
  const channels: readonly {channel: string; title: string; count: TestCount}[] = [
    {channel: 'email', title: strings.channelEmail, count: counts.email},
    {channel: 'push', title: strings.channelPush, count: counts.push},
  ];
  return (
    <div className="np-testing">
      <div className="np-progress" role="group" aria-label={strings.testProgress}>
        <div className="np-progress-row">
          <span>{strings.tested}</span>
          <b>{strings.testedOf(all.tested, all.total)}</b>
        </div>
        <div className="np-progress-row">
          <span>{strings.testedSummary(all.retest, all.total - all.tested - all.retest)}</span>
        </div>
        <div className="np-bar" aria-hidden="true">
          <i className="np-bar-good" style={{width: share(all.tested, all.total)}} />
          <i className="np-bar-warn" style={{width: share(all.retest, all.total)}} />
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
      <Seg<TestFilter>
        legend={strings.filterLegend}
        value={filter}
        onChange={onFilter}
        options={[
          {value: 'all', label: strings.filterAll},
          {value: 'todo', label: strings.filterTodo},
          {value: 'tested', label: strings.filterTested},
        ]}
      />
    </div>
  );
}

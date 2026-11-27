import {useId, useState} from 'react';
import type {ReactNode, RefObject} from 'react';

import type {Channel, RegistryEntry} from '../core/types.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';
import type {TestState} from './testing/testedStore.js';
import {StateMark} from './testing/views/StateMark.js';

const matches = (entry: RegistryEntry, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return needle === '' || [entry.label, entry.id, entry.trigger].some((field) => field.toLowerCase().includes(needle));
};

/**
 * The registered notifications, by channel, with a search over label, id and trigger. `stateOf`
 * marks each item's end with its test state, as test mode does; `top` goes under the search, where test mode puts its progress.
 */
export function EntryList({
  entries,
  selectedId,
  searchRef,
  onSelect,
  stateOf,
  keeps,
  top,
}: Readonly<{
  entries: readonly RegistryEntry[];
  selectedId: string | undefined;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  stateOf?: (entry: RegistryEntry) => TestState;
  /** With test mode's filter: whether an item stays in the list. */
  keeps?: (state: TestState) => boolean;
  top?: ReactNode;
}>) {
  const strings = useStrings();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const shown = entries.filter(
    (entry) => matches(entry, query) && (stateOf === undefined || keeps === undefined || keeps(stateOf(entry))),
  );
  const groups: readonly {readonly channel: Channel; readonly title: string}[] = [
    {channel: 'email', title: strings.channelEmail},
    {channel: 'push', title: strings.channelPush},
  ];

  return (
    <nav className="np-list" aria-label={strings.list}>
      <div className="np-search">
        <label htmlFor={searchId} className="np-visually-hidden">
          {strings.search}
        </label>
        <Icon name="search" />
        <input
          id={searchId}
          ref={searchRef}
          type="search"
          className="np-search-input"
          placeholder={strings.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      {top}
      {entries.length === 0 ? <p className="np-muted">{strings.empty}</p> : null}
      {entries.length > 0 && shown.length === 0 ? <p className="np-muted">{strings.noMatch}</p> : null}
      {groups.map(({channel, title}) => {
        const inGroup = shown.filter((entry) => entry.channel === channel);
        if (inGroup.length === 0) return null;
        return (
          <section key={channel} className="np-group" aria-label={title}>
            <h2 className="np-group-title">
              {title}
              <span className="np-count">
                {stateOf === undefined
                  ? inGroup.length
                  : strings.testedOf(
                      entries.filter((entry) => entry.channel === channel && stateOf(entry) === 'tested').length,
                      entries.filter((entry) => entry.channel === channel).length,
                    )}
              </span>
            </h2>
            <ul className="np-items">
              {inGroup.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="np-item"
                    aria-current={entry.id === selectedId ? 'true' : undefined}
                    onClick={() => {
                      onSelect(entry.id);
                    }}
                  >
                    <span className="np-ico" aria-hidden="true">
                      <Icon name={channel === 'email' ? 'envelope' : 'bell'} />
                    </span>
                    <span className="np-item-text">
                      <b>{entry.label}</b>
                      <code>{entry.id}</code>
                      {entry.recipient === undefined ? null : (
                        <span className="np-item-recipient">{entry.recipient}</span>
                      )}
                    </span>
                    {stateOf === undefined ? null : <StateMark state={stateOf(entry)} />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

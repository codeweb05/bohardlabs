import {useId, useState} from 'react';
import type {RefObject} from 'react';

import type {Channel, RegistryEntry} from '../core/types.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';

const matches = (entry: RegistryEntry, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return needle === '' || [entry.label, entry.id, entry.trigger].some((field) => field.toLowerCase().includes(needle));
};

/** The registered notifications, by channel, with a search over label, id and trigger. */
export function EntryList({
  entries,
  selectedId,
  searchRef,
  onSelect,
}: Readonly<{
  entries: readonly RegistryEntry[];
  selectedId: string | undefined;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
}>) {
  const strings = useStrings();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const shown = entries.filter((entry) => matches(entry, query));
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
      {entries.length === 0 ? <p className="np-muted">{strings.empty}</p> : null}
      {entries.length > 0 && shown.length === 0 ? <p className="np-muted">{strings.noMatch}</p> : null}
      {groups.map(({channel, title}) => {
        const inGroup = shown.filter((entry) => entry.channel === channel);
        if (inGroup.length === 0) return null;
        return (
          <section key={channel} className="np-group" aria-label={title}>
            <h2 className="np-group-title">
              <Icon name={channel === 'email' ? 'envelope' : 'bell'} />
              {title}
              <span className="np-count">{inGroup.length}</span>
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
                    <span className="np-item-label">{entry.label}</span>
                    <code className="np-item-id">{entry.id}</code>
                    {entry.recipient === undefined ? null : (
                      <span className="np-item-recipient">{entry.recipient}</span>
                    )}
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

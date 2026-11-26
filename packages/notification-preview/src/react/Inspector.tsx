import {useId, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';

import type {RegistryEntry, RenderResponse, Values} from '../types.js';
import {Icon} from './Icon.js';
import {recentTargets, rememberTarget} from './recentTargets.js';
import {useStrings} from './strings.js';
import type {SendState} from './useSend.js';
import type {Preset} from './values.js';
import {PRESETS} from './values.js';
import {VariableField} from './VariableField.js';

type Tab = 'variables' | 'details' | 'send';
const TABS: readonly Tab[] = ['variables', 'details', 'send'];

/** The open notification's trigger and recipient, then its variables, details and test send. */
export function Inspector({
  entry,
  values,
  lang,
  rendered,
  fieldErrors,
  sender,
  targetsKey,
  onEdit,
  onPreset,
  onReset,
}: Readonly<{
  entry: RegistryEntry;
  values: Values;
  lang: string;
  rendered: RenderResponse | undefined;
  fieldErrors: Readonly<Record<string, string>>;
  sender: SendState;
  /** Where recent targets are kept; the channel is added to it. */
  targetsKey: string;
  onEdit: (name: string, value: string) => void;
  onPreset: (preset: Preset) => void;
  onReset: () => void;
}>) {
  const strings = useStrings();
  const base = useId();
  const [tab, setTab] = useState<Tab>('variables');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const labels: Readonly<Record<Tab, string>> = {
    variables: strings.tabVariables,
    details: strings.tabDetails,
    send: strings.tabSend,
  };

  // The arrow keys move between tabs, as a tab list's keys do.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const by = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (by === undefined) return;
    event.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + by + TABS.length) % TABS.length] ?? 'variables';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className="np-inspector" aria-label={strings.inspector}>
      <div className="np-inspector-head">
        <h2 className="np-inspector-title">{entry.label}</h2>
        <dl className="np-facts">
          <dt>{strings.whenSent}</dt>
          <dd>{entry.trigger}</dd>
          {entry.recipient === undefined ? null : (
            <>
              <dt>{strings.recipient}</dt>
              <dd>{entry.recipient}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="np-tabs" role="tablist" aria-label={strings.inspector}>
        {TABS.map((name) => (
          <button
            key={name}
            ref={(element) => {
              tabRefs.current[name] = element;
            }}
            type="button"
            role="tab"
            id={`${base}-${name}-tab`}
            aria-selected={tab === name}
            aria-controls={`${base}-${name}`}
            tabIndex={tab === name ? 0 : -1}
            className="np-tab"
            onClick={() => {
              setTab(name);
            }}
            onKeyDown={onTabKey}
          >
            {labels[name]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-${tab}`} aria-labelledby={`${base}-${tab}-tab`} className="np-panel">
        {tab === 'variables' ? (
          <VariablesPanel
            entry={entry}
            values={values}
            fieldErrors={fieldErrors}
            onEdit={onEdit}
            onPreset={onPreset}
            onReset={onReset}
          />
        ) : null}
        {tab === 'details' ? <DetailsPanel entry={entry} lang={lang} rendered={rendered} /> : null}
        {tab === 'send' ? (
          <SendPanel
            key={entry.channel}
            entry={entry}
            values={values}
            lang={lang}
            sender={sender}
            targetsKey={`${targetsKey}.${entry.channel}`}
          />
        ) : null}
      </div>
    </aside>
  );
}

function VariablesPanel({
  entry,
  values,
  fieldErrors,
  onEdit,
  onPreset,
  onReset,
}: Readonly<{
  entry: RegistryEntry;
  values: Values;
  fieldErrors: Readonly<Record<string, string>>;
  onEdit: (name: string, value: string) => void;
  onPreset: (preset: Preset) => void;
  onReset: () => void;
}>) {
  const strings = useStrings();
  if (entry.variables.length === 0) return <p className="np-muted">{strings.noVariables}</p>;
  const presetLabels: Readonly<Record<Preset, string>> = {
    sample: strings.presetSample,
    long: strings.presetLong,
    empty: strings.presetEmpty,
    escaping: strings.presetEscaping,
    longUrl: strings.presetLongUrl,
  };
  return (
    <>
      <div className="np-row" role="group" aria-label={strings.presets}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="np-chip"
            onClick={() => {
              onPreset(preset);
            }}
          >
            {presetLabels[preset]}
          </button>
        ))}
      </div>
      <div className="np-section-head">
        <h3 className="np-section-title">{strings.variables}</h3>
        <button type="button" className="np-link-button" onClick={onReset}>
          {strings.reset}
        </button>
      </div>
      {entry.variables.map((variable) => (
        <VariableField
          key={variable.name}
          variable={variable}
          value={values[variable.name] ?? ''}
          error={fieldErrors[variable.name]}
          onChange={(value) => {
            onEdit(variable.name, value);
          }}
        />
      ))}
    </>
  );
}

function DetailsPanel({
  entry,
  lang,
  rendered,
}: Readonly<{entry: RegistryEntry; lang: string; rendered: RenderResponse | undefined}>) {
  const strings = useStrings();
  const [copied, setCopied] = useState<string>();
  const copy = async (text: string, done: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(done);
    } catch {
      setCopied(strings.clipboardRefused);
    }
  };
  const orEmpty = (text: string): string => (text === '' ? strings.emptyValue : text);
  return (
    <>
      <dl className="np-facts">
        <dt>{strings.message}</dt>
        <dd>
          <code>{entry.id}</code>
        </dd>
        <dt>{strings.channel}</dt>
        <dd>{entry.channel === 'email' ? strings.channelEmail : strings.channelPush}</dd>
        <dt>{strings.language}</dt>
        <dd>{strings.languageName(lang)}</dd>
        {rendered?.channel === 'email' ? (
          <>
            <dt>{strings.subject}</dt>
            <dd>{orEmpty(rendered.subject)}</dd>
            <dt>{strings.htmlSize}</dt>
            <dd>{strings.kilobytes((new Blob([rendered.html]).size / 1024).toFixed(1))}</dd>
          </>
        ) : null}
        {rendered?.channel === 'push' ? (
          <>
            <dt>{strings.pushTitle}</dt>
            <dd>{orEmpty(rendered.title)}</dd>
            <dt>{strings.pushBody}</dt>
            <dd>{orEmpty(rendered.body)}</dd>
          </>
        ) : null}
      </dl>
      {rendered?.channel === 'email' ? (
        <div className="np-row">
          <button
            type="button"
            className="np-button"
            onClick={() => {
              void copy(rendered.html, strings.copiedHtml);
            }}
          >
            <Icon name="copy" />
            {strings.copyHtml}
          </button>
          <button
            type="button"
            className="np-button"
            onClick={() => {
              void copy(rendered.text, strings.copiedText);
            }}
          >
            <Icon name="copy" />
            {strings.copyText}
          </button>
        </div>
      ) : null}
      <p className="np-status" role="status">
        {copied}
      </p>
    </>
  );
}

function SendPanel({
  entry,
  values,
  lang,
  sender,
  targetsKey,
}: Readonly<{entry: RegistryEntry; values: Values; lang: string; sender: SendState; targetsKey: string}>) {
  const strings = useStrings();
  const id = useId();
  const [recent, setRecent] = useState(() => recentTargets(targetsKey));
  const [target, setTarget] = useState(() => recent[0] ?? '');
  const isEmail = entry.channel === 'email';
  const error = sender.fieldErrors['target'];
  const sendLabel = isEmail ? strings.sendEmail : strings.sendPush;
  const describedBy = [isEmail ? '' : `${id}-hint`, error === undefined ? '' : `${id}-error`].join(' ').trim();

  return (
    <form
      className="np-send"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const send = async (): Promise<void> => {
          const sent = await sender.send({id: entry.id, lang, values, target});
          if (sent) setRecent(rememberTarget(targetsKey, target.trim()));
        };
        void send();
      }}
    >
      <div className="np-field">
        <label htmlFor={id} className="np-field-label">
          {isEmail ? strings.targetEmail : strings.targetPush}
        </label>
        <input
          id={id}
          className="np-input"
          type={isEmail ? 'email' : 'text'}
          autoComplete="off"
          value={target}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          onChange={(event) => {
            setTarget(event.target.value);
          }}
        />
        {isEmail ? null : (
          <p id={`${id}-hint`} className="np-hint">
            {strings.targetPushHint}
          </p>
        )}
        {error === undefined ? null : (
          <p id={`${id}-error`} className="np-error">
            {error}
          </p>
        )}
      </div>
      {recent.length > 0 ? (
        <div className="np-row" role="group" aria-label={strings.recentTargets}>
          {recent.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="np-chip"
              aria-pressed={candidate === target}
              onClick={() => {
                setTarget(candidate);
              }}
            >
              {candidate}
            </button>
          ))}
        </div>
      ) : null}
      <p className="np-warning">{strings.sendWarning}</p>
      <button type="submit" className="np-button np-button-primary" disabled={sender.sending}>
        <Icon name="send" />
        {sender.sending ? strings.sending : sendLabel}
      </button>
      <p className={sender.notice?.ok === false ? 'np-status np-status-error' : 'np-status'} role="status">
        {sender.notice?.text}
      </p>
    </form>
  );
}

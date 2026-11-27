import {useRef, useState} from 'react';
import type {ReactNode} from 'react';

import type {Catalog} from '../core/types.js';
import {AppNameContext} from './appName.js';
import type {PreviewClient} from './client.js';
import {EmailCanvas} from './EmailCanvas.js';
import {EntryList} from './EntryList.js';
import {Header} from './Header.js';
import {Inspector} from './Inspector.js';
import {PhoneFrame} from './PhoneFrame.js';
import {mergeStrings, StringsContext, useStrings} from './strings.js';
import type {PageStringsInput} from './strings.js';
import {shows} from './testing/testedStore.js';
import type {TestFilter} from './testing/testedStore.js';
import {useTesting} from './testing/useTesting.js';
import {RetestNotice} from './testing/views/RetestNotice.js';
import {TestModeSwitch} from './testing/views/TestModeSwitch.js';
import {TestProgress} from './testing/views/TestProgress.js';
import {TickButton} from './testing/views/TickButton.js';
import {Toolbar} from './Toolbar.js';
import type {CanvasView} from './Toolbar.js';
import {useCatalog} from './useCatalog.js';
import {usePreview} from './usePreview.js';
import {useSend} from './useSend.js';
import {useShortcuts} from './useShortcuts.js';
import {useTheme} from './useTheme.js';
import type {ThemeChoice} from './useTheme.js';

export interface NotificationPreviewPageProps {
  /** How the page reaches the server; `main.tsx` passes `createPageClient`. */
  readonly client: PreviewClient;
  /** The app's name, on the brand, the inbox header and the phone. */
  readonly appName: string;
  /** Any of the page's words; the rest keep their English default. */
  readonly strings?: PageStringsInput;
  /** A short name for the server the page talks to, such as `DEV`, shown beside the title. */
  readonly environment?: string | null;
  /**
   * The localStorage prefix for the theme, the recent send targets and test mode's ticks, which
   * are kept under `<storageKey>:tested`. Recent targets are kept per channel and per
   * `environment` under it.
   */
  readonly storageKey?: string;
}

const FIRST_VIEW: CanvasView = {width: 'desktop', part: 'html', device: 'ios', surface: 'lock'};

/**
 * A page for looking at every notification the server's registry holds, as the recipient
 * would see it, and sending one as a test.
 */
export function NotificationPreviewPage({
  client,
  appName,
  strings,
  environment,
  storageKey = 'vt-labs.notification-preview',
}: Readonly<NotificationPreviewPageProps>) {
  const merged = mergeStrings(strings);
  const [theme, setTheme] = useTheme(`${storageKey}.theme`);
  const catalog = useCatalog(client);
  const environmentName = environment ?? undefined;
  return (
    <StringsContext value={merged}>
      <AppNameContext value={appName}>
        <div className="np-root" data-theme={theme === 'auto' ? undefined : theme}>
          {catalog.state === 'loaded' ? (
            <Workspace
              client={client}
              catalog={catalog.catalog}
              testedKey={`${storageKey}:tested`}
              modeKey={`${storageKey}:testMode`}
              environment={environmentName}
              targetsKey={
                environmentName === undefined ? `${storageKey}.targets` : `${storageKey}.targets.${environmentName}`
              }
              theme={theme}
              onTheme={setTheme}
            />
          ) : (
            <>
              <Header
                environment={environmentName}
                locales={[]}
                locale=""
                theme={theme}
                onLanguage={() => undefined}
                onTheme={setTheme}
              />
              <p
                className={catalog.state === 'failed' ? 'np-status np-status-error np-loading' : 'np-status np-loading'}
                role="status"
              >
                {catalog.state === 'failed' ? merged.catalogFailed : merged.loading}
              </p>
            </>
          )}
        </div>
      </AppNameContext>
    </StringsContext>
  );
}

function Workspace({
  client,
  catalog,
  environment,
  testedKey,
  modeKey,
  targetsKey,
  theme,
  onTheme,
}: Readonly<{
  client: PreviewClient;
  catalog: Catalog;
  environment: string | undefined;
  testedKey: string;
  modeKey: string;
  targetsKey: string;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
}>) {
  const strings = useStrings();
  const preview = usePreview(client, catalog);
  const sender = useSend(client);
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<CanvasView>(FIRST_VIEW);
  const testing = useTesting(testedKey, modeKey, preview.locale, catalog.fingerprints);
  const [filter, setFilter] = useState<TestFilter>('all');
  const {entry, render} = preview;
  // A render for another notification is never drawn under this one's name.
  const rendered = entry !== undefined && render.request?.id === entry.id ? render.rendered : undefined;
  let drawn: ReactNode = null;
  if (rendered?.channel === 'email') drawn = <EmailCanvas email={rendered} width={view.width} part={view.part} />;
  if (rendered?.channel === 'push')
    drawn = <PhoneFrame device={view.device} surface={view.surface} title={rendered.title} body={rendered.body} />;
  // A tick keeps the catalog's fingerprint for this notification in this language, and is offered
  // once the page shows that language's render. Right after a language switch, `rendered` is still
  // the last language's, so there is nothing yet for the reviewer to have looked at.
  const shown = rendered !== undefined && render.request?.locale === preview.locale;
  const state = entry === undefined ? 'untested' : testing.stateOf(entry);
  const step = (by: 1 | -1): void => {
    sender.clear();
    preview.step(by);
  };

  useShortcuts({
    onPrevious: () => {
      step(-1);
    },
    onNext: () => {
      step(1);
    },
    onSearch: () => {
      searchRef.current?.focus();
    },
  });

  return (
    <>
      <Header
        environment={environment}
        locales={preview.locales}
        locale={preview.locale}
        theme={theme}
        onLanguage={preview.language}
        onTheme={onTheme}
        tools={<TestModeSwitch on={testing.on} onChange={testing.setOn} />}
      />
      <div className="np-main">
        <EntryList
          entries={preview.entries}
          selectedId={entry?.id}
          searchRef={searchRef}
          top={
            testing.on ? (
              <TestProgress counts={testing.count(preview.entries)} filter={filter} onFilter={setFilter} />
            ) : undefined
          }
          stateOf={testing.on ? testing.stateOf : undefined}
          keeps={(candidate) => shows(filter, candidate)}
          onSelect={(id) => {
            sender.clear();
            preview.select(id);
          }}
        />
        <section className="np-canvas" aria-label={strings.preview} aria-busy={render.busy}>
          <Toolbar
            channel={entry?.channel}
            position={preview.index + 1}
            count={preview.entries.length}
            view={view}
            onStep={step}
            onView={setView}
            end={
              testing.on && entry !== undefined ? (
                <TickButton
                  tested={state === 'tested'}
                  disabled={!shown || render.busy}
                  onToggle={() => {
                    testing.toggle(entry);
                  }}
                />
              ) : undefined
            }
          />
          {testing.on && state === 'retest' ? <RetestNotice /> : null}
          <p className="np-status np-status-error" role="status">
            {render.failure}
          </p>
          {rendered === undefined || rendered.warnings.length === 0 ? null : (
            <section className="np-warnings" aria-label={strings.warnings}>
              <h2 className="np-visually-hidden">{strings.warnings}</h2>
              <ul>
                {/* A renderer may give the same warning twice; it is listed once. */}
                {[...new Set(rendered.warnings)].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}
          {/* The stage scrolls a long email, and a region that scrolls must take focus for the
              keyboard to scroll it (axe scrollable-region-focusable, WCAG 2.1.1). */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region is the exception the rule allows for */}
          <div className="np-stage" role="group" aria-label={strings.stage} tabIndex={0}>
            {drawn}
          </div>
        </section>
        {entry === undefined ? null : (
          <Inspector
            entry={entry}
            values={preview.values}
            locale={preview.locale}
            rendered={rendered}
            fieldErrors={render.fieldErrors}
            sender={sender}
            targetsKey={targetsKey}
            onEdit={preview.edit}
            onPreset={preview.preset}
            onReset={preview.reset}
          />
        )}
      </div>
    </>
  );
}

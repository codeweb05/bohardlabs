import {useRef} from 'react';

import type {Catalog} from '../types.js';
import type {PreviewClient} from './client.js';
import {Pager} from './controls.js';
import {EmailCanvas} from './EmailCanvas.js';
import {EntryList} from './EntryList.js';
import {Header} from './Header.js';
import {Inspector} from './Inspector.js';
import {PushCanvas} from './PushCanvas.js';
import {DEFAULT_NOTIFICATION_PREVIEW_STRINGS, StringsContext, useStrings} from './strings.js';
import type {NotificationPreviewStrings} from './strings.js';
import {useCatalog} from './useCatalog.js';
import {usePreview} from './usePreview.js';
import {useSend} from './useSend.js';
import {useShortcuts} from './useShortcuts.js';
import {useTheme} from './useTheme.js';
import type {ThemeChoice} from './useTheme.js';

export interface NotificationPreviewPageProps {
  /** How the page reaches the server: `createFetchClient`, or the consumer's own. */
  readonly client: PreviewClient;
  /** Any of the page's words; the rest keep their English default. */
  readonly strings?: Partial<NotificationPreviewStrings>;
  /** A short name for the server the page talks to, such as `staging`, shown beside the title. */
  readonly environment?: string;
  /**
   * The localStorage prefix for the theme and the recent send targets. Recent targets are
   * kept per channel and per `environment` under it.
   */
  readonly storageKey?: string;
}

/**
 * A page for looking at every notification the server's registry holds, as the recipient
 * would see it, and sending one as a test. Import `@vt-labs/notification-preview/style.css`
 * once beside it.
 */
export function NotificationPreviewPage({
  client,
  strings,
  environment,
  storageKey = 'vt-labs.notification-preview',
}: Readonly<NotificationPreviewPageProps>) {
  const merged: NotificationPreviewStrings = {...DEFAULT_NOTIFICATION_PREVIEW_STRINGS, ...strings};
  const [theme, setTheme] = useTheme(`${storageKey}.theme`);
  const catalog = useCatalog(client);
  return (
    <StringsContext value={merged}>
      <div className="np-root" data-theme={theme === 'auto' ? undefined : theme}>
        {catalog.state === 'loaded' ? (
          <Workspace
            client={client}
            catalog={catalog.catalog}
            environment={environment}
            targetsKey={environment === undefined ? `${storageKey}.targets` : `${storageKey}.targets.${environment}`}
            theme={theme}
            onTheme={setTheme}
          />
        ) : (
          <>
            <Header
              environment={environment}
              languages={[]}
              lang=""
              theme={theme}
              onLanguage={() => undefined}
              onTheme={setTheme}
            />
            <p className={catalog.state === 'failed' ? 'np-status np-status-error' : 'np-status'} role="status">
              {catalog.state === 'failed' ? merged.catalogFailed : merged.loading}
            </p>
          </>
        )}
      </div>
    </StringsContext>
  );
}

function Workspace({
  client,
  catalog,
  environment,
  targetsKey,
  theme,
  onTheme,
}: Readonly<{
  client: PreviewClient;
  catalog: Catalog;
  environment: string | undefined;
  targetsKey: string;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
}>) {
  const strings = useStrings();
  const preview = usePreview(client, catalog);
  const sender = useSend(client);
  const searchRef = useRef<HTMLInputElement>(null);
  const {entry, render} = preview;
  // A render for another notification is never drawn under this one's name.
  const rendered = entry !== undefined && render.request?.id === entry.id ? render.rendered : undefined;

  useShortcuts({
    onPrevious: () => {
      sender.clear();
      preview.step(-1);
    },
    onNext: () => {
      sender.clear();
      preview.step(1);
    },
    onSearch: () => {
      searchRef.current?.focus();
    },
  });

  return (
    <>
      <Header
        environment={environment}
        languages={catalog.languages}
        lang={preview.lang}
        theme={theme}
        onLanguage={preview.language}
        onTheme={onTheme}
      />
      <div className="np-main">
        <EntryList
          entries={preview.entries}
          selectedId={entry?.id}
          searchRef={searchRef}
          onSelect={(id) => {
            sender.clear();
            preview.select(id);
          }}
        />
        <section className="np-stage" aria-label={strings.preview} aria-busy={render.busy}>
          <div className="np-stage-head">
            <h2 className="np-stage-title">{entry?.label ?? strings.preview}</h2>
            {preview.entries.length > 0 ? (
              <Pager
                position={preview.index + 1}
                count={preview.entries.length}
                onStep={(by) => {
                  sender.clear();
                  preview.step(by);
                }}
              />
            ) : null}
          </div>
          <p className="np-status np-status-error" role="status">
            {render.failure}
          </p>
          {rendered === undefined ? null : (
            <>
              {rendered.channel === 'email' ? <EmailCanvas email={rendered} /> : <PushCanvas push={rendered} />}
              {rendered.warnings.length > 0 ? (
                <section className="np-warnings" aria-label={strings.warnings}>
                  <h3 className="np-section-title">{strings.warnings}</h3>
                  <ul>
                    {/* A renderer may give the same warning twice; it is listed once. */}
                    {[...new Set(rendered.warnings)].map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </section>
        {entry === undefined ? null : (
          <Inspector
            entry={entry}
            values={preview.values}
            lang={preview.lang}
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

import type {Catalog, RegistryEntry, RenderRequest, RenderResponse, SendRequest, SendResponse} from '../core/types.js';
import {PreviewClientError} from '../page/client.js';
import type {PreviewClient} from '../page/client.js';

const ENTRIES: readonly RegistryEntry[] = [
  {
    id: 'welcome',
    channel: 'email',
    label: 'Welcome',
    recipient: 'A new account holder',
    trigger: 'An account is created.',
    variables: [
      {name: 'firstName', type: 'text', sample: 'Ada'},
      {name: 'verifyUrl', type: 'url', sample: 'https://example.com/verify/abc'},
    ],
  },
  {
    id: 'invoice-due',
    channel: 'email',
    label: 'Invoice due',
    trigger: 'An invoice is three days from its due date.',
    variables: [
      {name: 'amount', type: 'number', sample: '42'},
      {name: 'dueAt', type: 'datetime', sample: '2026-01-15T09:30:00.000Z'},
      {name: 'plan', type: 'enum', options: ['basic', 'pro'], sample: 'pro'},
    ],
  },
  {
    id: 'task-reminder',
    channel: 'push',
    label: 'Task reminder',
    recipient: 'The task owner',
    trigger: 'A task is due in fifteen minutes.',
    variables: [{name: 'taskName', type: 'text', sample: 'Water the plants'}],
  },
  {
    id: 'weekly-summary',
    channel: 'push',
    label: 'Weekly summary',
    trigger: 'Every Monday at nine.',
    variables: [],
  },
];

/**
 * A stand-in fingerprint for each entry in each of its channel's locales (`en` for a channel that
 * lists none), as the server would give. An id in `changed` gets another, as a render changed
 * since a tick would.
 */
function fingerprintsOf(
  entries: readonly RegistryEntry[],
  locales: Catalog['locales'],
  changed: readonly string[] = [],
): Catalog['fingerprints'] {
  return Object.fromEntries(
    entries.map((entry) => {
      const listed = locales[entry.channel] ?? [];
      const offered = listed.length === 0 ? ['en'] : listed;
      const version = changed.includes(entry.id) ? 'v2' : 'v1';
      return [entry.id, Object.fromEntries(offered.map((locale) => [locale, `${entry.id}.${locale}.${version}`]))];
    }),
  );
}

const LOCALES: Catalog['locales'] = {email: ['en', 'es'], push: ['en', 'es']};

/** A registry with two emails and two pushes, in two locales, for the tests and the stories. */
export const CATALOG: Catalog = {locales: LOCALES, entries: ENTRIES, fingerprints: fingerprintsOf(ENTRIES, LOCALES)};

const GREETING: Readonly<Record<string, string>> = {en: 'Hello', es: 'Hola'};

const escape = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** `count` more entries, alternating email and push, for a list long enough to scroll. */
function extraEntries(count: number): RegistryEntry[] {
  return Array.from({length: count}, (_, index): RegistryEntry => ({
    id: `extra-${String(index + 1)}`,
    channel: index % 2 === 0 ? 'email' : 'push',
    label: `Extra notification ${String(index + 1)}`,
    trigger: 'Only in the long-list fixture.',
    variables: [],
  }));
}

function renderOf(catalog: Catalog, request: RenderRequest): RenderResponse {
  const entry = catalog.entries.find((candidate) => candidate.id === request.id);
  if (entry === undefined) throw new PreviewClientError('Not registered.', {status: 404});
  const v = request.values;
  const url = v['verifyUrl'];
  if (url !== undefined && !url.startsWith('https://')) {
    throw new PreviewClientError('A value was refused.', {
      status: 422,
      fieldErrors: {verifyUrl: 'Must start with https://.'},
    });
  }
  const hello = GREETING[request.locale] ?? 'Hello';
  if (entry.id.startsWith('extra-')) {
    return entry.channel === 'push'
      ? {channel: 'push', title: entry.label, body: `${hello}! A short push.`, warnings: []}
      : {
          channel: 'email',
          subject: entry.label,
          html: `<!doctype html><html><body style="font-family:sans-serif"><p>${hello}, a short email.</p></body></html>`,
          text: `${hello}, a short email.`,
          warnings: [],
        };
  }
  if (entry.channel === 'push') {
    return entry.id === 'task-reminder'
      ? {
          channel: 'push',
          title: 'Due soon',
          body: `${hello}! ${v['taskName'] ?? ''} is due in 15 minutes.`,
          warnings: [],
        }
      : {
          channel: 'push',
          title: 'Your week',
          body: `${hello}! Here is your week.`,
          warnings: ['No translation for es.'],
        };
  }
  const line =
    entry.id === 'welcome'
      ? `${hello} ${v['firstName'] ?? ''}, confirm your address: ${url ?? ''}`
      : `${hello}, ${v['amount'] ?? ''} on the ${v['plan'] ?? ''} plan is due ${v['dueAt'] ?? ''}.`;
  return {
    channel: 'email',
    subject: entry.id === 'welcome' ? `${hello} ${v['firstName'] ?? ''}` : 'Your invoice is due',
    html: `<!doctype html><html><body style="font-family:sans-serif"><p>${escape(line)}</p></body></html>`,
    text: line,
    warnings: [],
  };
}

export interface FakeClient extends PreviewClient {
  readonly renders: RenderRequest[];
  readonly sends: SendRequest[];
}

/**
 * A client that answers from `CATALOG` with no server. A `verifyUrl` not starting https:// is
 * refused, a send to `refuse@example.com` is refused on its target, and a send to
 * `busy@example.com` is a 429. `extra` adds that many short entries after the four, and each id
 * in `changed` gets another fingerprint than `CATALOG` gives it.
 */
export function fakeClient(
  options: {
    readonly failCatalog?: boolean;
    readonly locales?: Catalog['locales'];
    readonly extra?: number;
    readonly changed?: readonly string[];
  } = {},
): FakeClient {
  const renders: RenderRequest[] = [];
  const sends: SendRequest[] = [];
  const locales = options.locales ?? CATALOG.locales;
  const entries = [...CATALOG.entries, ...extraEntries(options.extra ?? 0)];
  const catalog: Catalog = {locales, entries, fingerprints: fingerprintsOf(entries, locales, options.changed)};
  return {
    renders,
    sends,
    catalog: async () => {
      if (options.failCatalog === true) throw new PreviewClientError('Down.', {status: 503});
      return catalog;
    },
    render: async (request) => {
      renders.push(request);
      return renderOf(catalog, request);
    },
    send: async (request): Promise<SendResponse> => {
      sends.push(request);
      if (request.target === 'refuse@example.com') {
        throw new PreviewClientError('A value was refused.', {
          status: 422,
          fieldErrors: {target: 'Not a test address.'},
        });
      }
      if (request.target === 'busy@example.com') {
        throw new PreviewClientError('Slow down.', {status: 429, retryAfterSeconds: 30});
      }
      const rendered = renderOf(catalog, request);
      return rendered.channel === 'email'
        ? {channel: 'email', messageId: 'msg-1'}
        : {channel: 'push', devices: 2, sent: 2, failed: 0, removed: 0};
    },
  };
}

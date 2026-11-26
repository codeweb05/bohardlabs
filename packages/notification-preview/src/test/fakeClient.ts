import {PreviewClientError} from '../react/client.js';
import type {PreviewClient} from '../react/client.js';
import type {Catalog, RenderRequest, RenderResponse, SendRequest, SendResponse} from '../types.js';

/** A registry with two emails and two pushes, in two languages, for the tests and the stories. */
export const CATALOG: Catalog = {
  languages: ['en', 'es'],
  entries: [
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
  ],
};

const GREETING: Readonly<Record<string, string>> = {en: 'Hello', es: 'Hola'};

const escape = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function renderOf(request: RenderRequest): RenderResponse {
  const entry = CATALOG.entries.find((candidate) => candidate.id === request.id);
  if (entry === undefined) throw new PreviewClientError('Not registered.', {status: 404});
  const v = request.values;
  const url = v['verifyUrl'];
  if (url !== undefined && !url.startsWith('https://')) {
    throw new PreviewClientError('A value was refused.', {
      status: 422,
      fieldErrors: {verifyUrl: 'Must start with https://.'},
    });
  }
  const hello = GREETING[request.lang] ?? 'Hello';
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
 * `busy@example.com` is a 429.
 */
export function fakeClient(options: {readonly failCatalog?: boolean} = {}): FakeClient {
  const renders: RenderRequest[] = [];
  const sends: SendRequest[] = [];
  return {
    renders,
    sends,
    catalog: async () => {
      if (options.failCatalog === true) throw new PreviewClientError('Down.', {status: 503});
      return CATALOG;
    },
    render: async (request) => {
      renders.push(request);
      return renderOf(request);
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
      const rendered = renderOf(request);
      return rendered.channel === 'email'
        ? {channel: 'email', messageId: 'msg-1'}
        : {channel: 'push', devices: 2, sent: 2, failed: 0, removed: 0};
    },
  };
}

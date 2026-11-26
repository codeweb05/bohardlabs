import {InvalidValuesError, UnregisteredNotificationError} from './errors.js';
import type {
  Catalog,
  Channel,
  ChannelProvider,
  Providers,
  RegistryEntry,
  RenderRequest,
  RenderResponse,
  SendRequest,
  SendResponse,
  Values,
} from './types.js';

export interface NotificationPreviewOptions {
  /** Every notification the preview may render or send. Ids must be unique. */
  readonly registry: readonly RegistryEntry[];
  /** The consumer's render and send for each channel. */
  readonly providers: Providers;
  /** The languages every entry renders in, the first being the one the page opens with. */
  readonly languages: readonly string[];
}

/** The three operations a server route hands its request body to. */
export interface NotificationPreview {
  /** The registry and the languages, as `GET catalog` answers them. */
  readonly catalog: () => Catalog;
  /** Renders a registered notification. Refuses anything else before a provider runs. */
  readonly render: (request: RenderRequest) => Promise<RenderResponse>;
  /** Renders and delivers a registered notification. Refuses anything else before a provider runs. */
  readonly send: (request: SendRequest) => Promise<SendResponse>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The declared variables' values from a request body, and nothing else: a name the entry
 * does not declare never reaches the provider. A value that is not a string is refused.
 */
function declaredValues(entry: RegistryEntry, raw: unknown): Values {
  const given = isRecord(raw) ? raw : {};
  const values: Record<string, string> = {};
  const refused: Record<string, string> = {};
  for (const {name} of entry.variables) {
    const value = given[name];
    if (value === undefined) continue;
    if (typeof value === 'string') values[name] = value;
    else refused[name] = 'Must be a string.';
  }
  if (Object.keys(refused).length > 0) throw new InvalidValuesError(refused);
  return values;
}

/** The channel's provider, or the refusal when the consumer configured none. */
function providerFor<C extends Channel>(
  provider: ChannelProvider<C> | undefined,
  entry: RegistryEntry,
): ChannelProvider<C> {
  if (provider === undefined) throw new UnregisteredNotificationError(entry.id, entry.channel);
  return provider;
}

/**
 * The server half of the preview: holds the registry, and passes a render or a send to the
 * provider for the entry's channel only once the id is registered and that provider exists.
 *
 * ```ts
 * const preview = createNotificationPreview({registry, providers: {email, push}, languages: ['en', 'es']});
 * preview.catalog();
 * await preview.render({id: 'password-reset', lang: 'en', values: {resetUrl: 'https://…'}});
 * ```
 */
export function createNotificationPreview(options: NotificationPreviewOptions): NotificationPreview {
  const {providers} = options;
  const byId = new Map<string, RegistryEntry>();
  for (const entry of options.registry) {
    if (byId.has(entry.id)) throw new Error(`Notification "${entry.id}" is registered twice.`);
    byId.set(entry.id, entry);
  }
  const catalog: Catalog = {languages: [...options.languages], entries: [...options.registry]};

  /** The entry for a request, or the refusal, before anything else is read. */
  const entryOf = (id: unknown): RegistryEntry => {
    const entry = typeof id === 'string' ? byId.get(id) : undefined;
    if (entry === undefined) throw new UnregisteredNotificationError(String(id));
    return entry;
  };

  const langOf = (lang: unknown): string =>
    typeof lang === 'string' && lang !== '' ? lang : (catalog.languages[0] ?? 'en');

  return {
    catalog: () => catalog,

    // Each answer copies only the declared fields, so nothing else a provider returns, and
    // no `channel` of its own, reaches the page.
    render: async (request) => {
      const entry = entryOf(request.id);
      if (entry.channel === 'email') {
        const email = providerFor(providers.email, entry);
        const {subject, html, text, warnings} = await email.render(
          entry.id,
          declaredValues(entry, request.values),
          langOf(request.lang),
        );
        return {channel: 'email', subject, html, text, warnings: warnings ?? []};
      }
      const push = providerFor(providers.push, entry);
      const {title, body, warnings} = await push.render(
        entry.id,
        declaredValues(entry, request.values),
        langOf(request.lang),
      );
      return {channel: 'push', title, body, warnings: warnings ?? []};
    },

    send: async (request) => {
      const entry = entryOf(request.id);
      const target = typeof request.target === 'string' ? request.target.trim() : '';
      const deliver = async <C extends Channel>(provider: ChannelProvider<C> | undefined) => {
        const found = providerFor(provider, entry);
        const values = declaredValues(entry, request.values);
        if (target === '') throw new InvalidValuesError({target: 'Required.'});
        return found.send(entry.id, values, langOf(request.lang), target);
      };
      if (entry.channel === 'email') {
        const {messageId} = await deliver(providers.email);
        return {channel: 'email', messageId};
      }
      const {devices, sent, failed, removed} = await deliver(providers.push);
      return {channel: 'push', devices, sent, failed, removed};
    },
  };
}

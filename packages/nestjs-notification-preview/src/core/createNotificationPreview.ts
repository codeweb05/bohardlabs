import {InvalidValuesError, UnregisteredNotificationError} from './errors.js';
import {fingerprint} from './fingerprint.js';
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
}

/** The three operations a server route hands its request body to. */
export interface NotificationPreview {
  /**
   * The registry, each channel's locales and each entry's fingerprints, as `GET catalog` answers
   * them. The fingerprints are rendered on the first call and kept for the life of this preview.
   */
  readonly catalog: () => Promise<Catalog>;
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
    // Own properties only: a variable named `constructor` is not read off the prototype.
    const value = Object.hasOwn(given, name) ? given[name] : undefined;
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
 * const preview = createNotificationPreview({registry, providers: {email, push}});
 * await preview.catalog();
 * await preview.render({id: 'password-reset', locale: 'en', values: {resetUrl: 'https://…'}});
 * ```
 */
export function createNotificationPreview(options: NotificationPreviewOptions): NotificationPreview {
  const {providers} = options;
  const byId = new Map<string, RegistryEntry>();
  for (const entry of options.registry) {
    if (byId.has(entry.id)) throw new Error(`Notification "${entry.id}" is registered twice.`);
    byId.set(entry.id, entry);
  }

  /** The fallback when a request names no locale and the channel lists none. */
  const FALLBACK_LOCALE = 'en';

  /** The channels the consumer gave a provider for, in the order given. */
  const channels = (Object.keys(providers) as Channel[]).filter((channel) => providers[channel] !== undefined);

  /** The locales a configured channel's provider reports, read on each call so they stay current. */
  const localesOf = (channel: Channel): readonly string[] => providers[channel]?.locales() ?? [];

  /** The entry for a request, or the refusal, before anything else is read. */
  const entryOf = (id: unknown): RegistryEntry => {
    const entry = typeof id === 'string' ? byId.get(id) : undefined;
    if (entry === undefined) throw new UnregisteredNotificationError(String(id));
    return entry;
  };

  /**
   * The request's locale, untouched, or the channel's default when none is given. A locale
   * the channel does not list is refused before a provider runs; a channel that lists no
   * locale at all accepts any.
   */
  const localeOf = (entry: RegistryEntry, locale: unknown): string => {
    const offered = localesOf(entry.channel);
    if (typeof locale !== 'string' || locale === '') return offered[0] ?? FALLBACK_LOCALE;
    if (offered.length > 0 && !offered.includes(locale)) {
      throw new InvalidValuesError({locale: 'Not a language this notification renders in.'});
    }
    return locale;
  };

  // Each answer copies only the declared fields, so nothing else a provider returns, and no
  // `channel` of its own, reaches the page.
  const rendered = async (entry: RegistryEntry, values: Values, locale: string): Promise<RenderResponse> => {
    if (entry.channel === 'email') {
      const email = providerFor(providers.email, entry);
      const {subject, html, text, warnings} = await email.render(entry.id, values, locale);
      return {channel: 'email', subject, html, text, warnings: warnings ?? []};
    }
    const push = providerFor(providers.push, entry);
    const {title, body, warnings} = await push.render(entry.id, values, locale);
    return {channel: 'push', title, body, warnings: warnings ?? []};
  };

  /** The entry's fingerprint per locale its channel lists; `null` where the render threw. */
  const fingerprintsOf = async (entry: RegistryEntry): Promise<Record<string, string | null>> => {
    if (providers[entry.channel] === undefined) return {};
    const listed = localesOf(entry.channel);
    const samples = Object.fromEntries(entry.variables.map(({name, sample}) => [name, sample]));
    const found: [string, string | null][] = [];
    // One render at a time, so a long registry never floods the consumer's renderer.
    for (const locale of listed.length === 0 ? [FALLBACK_LOCALE] : listed) {
      try {
        found.push([locale, fingerprint(await rendered(entry, samples, locale))]);
      } catch {
        // A sample the renderer refuses, or a missing template: no fingerprint, and the catalog still answers.
        found.push([locale, null]);
      }
    }
    return Object.fromEntries(found);
  };

  /** Every entry's fingerprints, rendered on the first catalog and kept for the life of this preview. */
  let fingerprints: Promise<Catalog['fingerprints']> | undefined;
  const allFingerprints = async (): Promise<Catalog['fingerprints']> => {
    const found: [string, Record<string, string | null>][] = [];
    for (const entry of options.registry) found.push([entry.id, await fingerprintsOf(entry)]);
    // `fromEntries` defines each id as an own property, so an id such as `__proto__` stays an id.
    return Object.fromEntries(found);
  };

  return {
    catalog: async () => {
      if (fingerprints === undefined) {
        const pending = allFingerprints();
        fingerprints = pending;
        // A failure outside a render, such as a `locales()` that throws, is not kept: the next call tries again.
        void pending.catch(() => {
          if (fingerprints === pending) fingerprints = undefined;
        });
      }
      const locales: Partial<Record<Channel, readonly string[]>> = {};
      for (const channel of channels) locales[channel] = [...localesOf(channel)];
      return {entries: [...options.registry], locales, fingerprints: await fingerprints};
    },

    render: async (request) => {
      const entry = entryOf(request.id);
      // The channel's provider is checked before the values, as a send checks it.
      if (providers[entry.channel] === undefined) throw new UnregisteredNotificationError(entry.id, entry.channel);
      return rendered(entry, declaredValues(entry, request.values), localeOf(entry, request.locale));
    },

    send: async (request) => {
      const entry = entryOf(request.id);
      const target = typeof request.target === 'string' ? request.target.trim() : '';
      const deliver = async <C extends Channel>(provider: ChannelProvider<C> | undefined) => {
        const found = providerFor(provider, entry);
        const values = declaredValues(entry, request.values);
        if (target === '') throw new InvalidValuesError({target: 'Required.'});
        return found.send(entry.id, values, localeOf(entry, request.locale), target);
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

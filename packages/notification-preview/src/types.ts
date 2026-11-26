/**
 * The kinds of notification the preview knows how to draw. Email and push in this release;
 * an in-app kind would join this union with a provider and a canvas of its own. A new channel
 * ships in a minor version, so code that switches on a `channel` keeps a default branch.
 */
export type Channel = 'email' | 'push';

/** How a variable's field is typed in the page. Every value still travels as a string. */
export type VariableType = 'text' | 'url' | 'datetime' | 'number' | 'enum';

/** One value a notification's wording takes, with the sample the page opens with. */
export interface VariableSpec {
  /** The name the template uses, such as `verificationUrl`. */
  readonly name: string;
  readonly type: VariableType;
  /** The values an `enum` takes. Ignored for any other type. */
  readonly options?: readonly string[];
  /**
   * What the field holds when the notification is opened, and what Reset returns to. A
   * `datetime` sample is an ISO instant, such as `2026-01-15T09:30:00.000Z`.
   */
  readonly sample: string;
}

/**
 * One notification the app can send, as the registry declares it. Only an entry in the
 * registry can be rendered or sent through the preview.
 */
export interface RegistryEntry {
  /** Stable and unique across the registry, such as `password-reset`. */
  readonly id: string;
  readonly channel: Channel;
  /** The name the page lists it under. */
  readonly label: string;
  /** Who receives it, in the consumer's own words. Shown in the list and the inspector. */
  readonly recipient?: string;
  /** When the app sends it, in a sentence a tester can act on. */
  readonly trigger: string;
  readonly variables: readonly VariableSpec[];
}

/** A notification's variable values by name, always as strings. */
export type Values = Readonly<Record<string, string>>;

// What a provider returns. A field added to one of these later is optional, so no provider
// written today breaks. Only the fields declared here reach the page; anything else a provider
// returns is left on the server.

/** An email as the consumer's renderer produced it. */
export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** Anything the renderer wants a tester to see, such as a missing translation. None when left out. */
  readonly warnings?: readonly string[];
}

/** A push as the consumer's renderer produced it. */
export interface RenderedPush {
  readonly title: string;
  readonly body: string;
  /** None when left out. */
  readonly warnings?: readonly string[];
}

/** What a test email send did. */
export interface SentEmail {
  /** The mail provider's id for the message, when it gives one. */
  readonly messageId: string | null;
}

/** What a test push send did, across every device the target has registered. */
export interface SentPush {
  /** How many devices the target had registered. */
  readonly devices: number;
  readonly sent: number;
  readonly failed: number;
  /** Devices the push service no longer knows, which the consumer removed. */
  readonly removed: number;
}

/** What each channel renders to and what its send answers. */
export interface ChannelOutput {
  readonly email: {readonly rendered: RenderedEmail; readonly sent: SentEmail};
  readonly push: {readonly rendered: RenderedPush; readonly sent: SentPush};
}

/** The consumer's code for one channel. The preview calls it only for a registered id. */
export interface ChannelProvider<C extends Channel> {
  /**
   * Renders the notification `id` with `values` in `lang`. Validating the values is the
   * provider's job: throw an `InvalidValuesError` naming the refused ones.
   */
  readonly render: (
    id: string,
    values: Values,
    lang: string,
  ) => ChannelOutput[C]['rendered'] | Promise<ChannelOutput[C]['rendered']>;
  /**
   * Renders the notification as `render` would and delivers it to `target`, which is
   * whatever the consumer's channel addresses: an email address, or an account whose
   * devices receive the push.
   */
  readonly send: (
    id: string,
    values: Values,
    lang: string,
    target: string,
  ) => ChannelOutput[C]['sent'] | Promise<ChannelOutput[C]['sent']>;
}

/** One provider per channel. A channel left out cannot be rendered or sent. */
export type Providers = {readonly [C in Channel]?: ChannelProvider<C>};

// The wire: what the server answers and the page asks. Plain JSON, so any HTTP layer
// carries it.

/** `GET catalog`: every registered notification and the languages they render in. */
export interface Catalog {
  readonly languages: readonly string[];
  readonly entries: readonly RegistryEntry[];
}

/** `POST render`. */
export interface RenderRequest {
  readonly id: string;
  readonly lang: string;
  readonly values: Values;
}

/** The answer to `POST render`, tagged with the entry's channel. */
export type RenderResponse =
  | ({readonly channel: 'email'} & Required<RenderedEmail>)
  | ({readonly channel: 'push'} & Required<RenderedPush>);

/** `POST send`: render as `RenderRequest` would, then deliver to `target`. */
export interface SendRequest extends RenderRequest {
  readonly target: string;
}

/** The answer to `POST send`, tagged with the entry's channel. */
export type SendResponse = ({readonly channel: 'email'} & SentEmail) | ({readonly channel: 'push'} & SentPush);

/**
 * The body of a refused request. `fieldErrors` names a refused value by its variable name,
 * or `target` for the send's address; the page shows each under its field.
 */
export interface PreviewErrorBody {
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

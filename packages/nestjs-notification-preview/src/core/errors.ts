import type {Channel, PreviewErrorBody} from './types.js';

/**
 * A render or send asked for an id the registry does not hold, or for an entry whose channel
 * has no provider. Thrown before any provider runs, so nothing outside the registry is ever
 * rendered or sent. Map it to a 404 in the HTTP layer.
 */
export class UnregisteredNotificationError extends Error {
  override readonly name = 'UnregisteredNotificationError';
  readonly id: string;
  /** Set when the id is registered but its channel has no provider. */
  readonly channel: Channel | undefined;

  constructor(id: string, channel?: Channel) {
    super(
      channel === undefined
        ? `No notification "${id}" is registered.`
        : `Notification "${id}" is a ${channel} notification, and no ${channel} provider is configured.`,
    );
    this.id = id;
    this.channel = channel;
  }
}

/**
 * A provider refused one or more values. Throw it from `render` or `send` with each refused
 * variable by name (or `target` for the send's address); map it to a 422 whose body is
 * `toBody()`, and the page shows each message under its field.
 */
export class InvalidValuesError extends Error {
  override readonly name = 'InvalidValuesError';
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(fieldErrors: Readonly<Record<string, string>>, message = 'A value was refused.') {
    super(message);
    this.fieldErrors = fieldErrors;
  }

  /** The `PreviewErrorBody` the page reads. */
  toBody(): Required<PreviewErrorBody> {
    return {message: this.message, fieldErrors: this.fieldErrors};
  }
}

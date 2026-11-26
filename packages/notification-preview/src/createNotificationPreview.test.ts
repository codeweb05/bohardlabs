import {describe, expect, it, vi} from 'vitest';

import {createNotificationPreview} from './createNotificationPreview.js';
import {InvalidValuesError, UnregisteredNotificationError} from './errors.js';
import type {ChannelProvider, RegistryEntry, RenderRequest, SendRequest} from './types.js';

const RESET: RegistryEntry = {
  id: 'password-reset',
  channel: 'email',
  label: 'Password reset',
  recipient: 'The account holder',
  trigger: 'Someone asks to reset a password.',
  variables: [{name: 'resetUrl', type: 'url', sample: 'https://example.com/reset'}],
};
const REMINDER: RegistryEntry = {
  id: 'reminder',
  channel: 'push',
  label: 'Reminder',
  trigger: 'A reminder falls due.',
  variables: [],
};

function emailProvider(): ChannelProvider<'email'> {
  return {
    render: vi.fn((id: string, values: Readonly<Record<string, string>>, lang: string) => ({
      subject: `${id} ${lang}`,
      html: `<p>${values['resetUrl'] ?? ''}</p>`,
      text: values['resetUrl'] ?? '',
      warnings: [],
    })),
    send: vi.fn(async () => ({messageId: 'm-1'})),
  };
}

function pushProvider(): ChannelProvider<'push'> {
  return {
    render: vi.fn(async () => ({title: 'Time', body: 'Your reminder', warnings: ['draft']})),
    send: vi.fn(() => ({devices: 2, sent: 1, failed: 1, removed: 0})),
  };
}

describe('createNotificationPreview', () => {
  it('lists the registry and the languages', () => {
    const preview = createNotificationPreview({registry: [RESET, REMINDER], providers: {}, languages: ['en', 'es']});
    expect(preview.catalog()).toEqual({languages: ['en', 'es'], entries: [RESET, REMINDER]});
  });

  it('refuses an id registered twice', () => {
    expect(() => createNotificationPreview({registry: [RESET, RESET], providers: {}, languages: ['en']})).toThrow(
      'Notification "password-reset" is registered twice.',
    );
  });

  it('renders an email through its provider, tagged with the channel', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['en']});
    await expect(
      preview.render({id: 'password-reset', lang: 'es', values: {resetUrl: 'https://x.test', stray: 'y'}}),
    ).resolves.toEqual({
      channel: 'email',
      subject: 'password-reset es',
      html: '<p>https://x.test</p>',
      text: 'https://x.test',
      warnings: [],
    });
    // A name the entry does not declare never reaches the provider.
    expect(email.render).toHaveBeenCalledWith('password-reset', {resetUrl: 'https://x.test'}, 'es');
  });

  it('renders a push through its provider', async () => {
    const push = pushProvider();
    const preview = createNotificationPreview({registry: [REMINDER], providers: {push}, languages: ['en']});
    await expect(preview.render({id: 'reminder', lang: 'en', values: {}})).resolves.toEqual({
      channel: 'push',
      title: 'Time',
      body: 'Your reminder',
      warnings: ['draft'],
    });
  });

  it('falls back to the first language when none is given', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['fr', 'en']});
    await preview.render({id: 'password-reset', lang: '', values: {}});
    expect(email.render).toHaveBeenCalledWith('password-reset', {}, 'fr');
  });

  it('falls back to en when no language is offered or given', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: []});
    await preview.render({id: 'password-reset', lang: '', values: {}});
    expect(email.render).toHaveBeenCalledWith('password-reset', {}, 'en');
  });

  it('refuses an unregistered id before any provider runs', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['en']});
    const refused = async () => preview.render({id: 'nope', lang: 'en', values: {}});
    await expect(refused()).rejects.toBeInstanceOf(UnregisteredNotificationError);
    await expect(refused()).rejects.toMatchObject({id: 'nope', channel: undefined});
    await expect(preview.send({id: 'nope', lang: 'en', values: {}, target: 'a@b.test'})).rejects.toThrow(
      'No notification "nope" is registered.',
    );
    expect(email.render).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('refuses an id that is not a string, as a body from the wire may carry', async () => {
    const preview = createNotificationPreview({registry: [RESET], providers: {}, languages: ['en']});
    const body: unknown = {id: 42, lang: 'en', values: {}};
    await expect(preview.render(body as RenderRequest)).rejects.toBeInstanceOf(UnregisteredNotificationError);
  });

  it('refuses an entry whose channel has no provider', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET, REMINDER], providers: {email}, languages: ['en']});
    await expect(preview.render({id: 'reminder', lang: 'en', values: {}})).rejects.toMatchObject({
      name: 'UnregisteredNotificationError',
      id: 'reminder',
      channel: 'push',
      message: 'Notification "reminder" is a push notification, and no push provider is configured.',
    });
    await expect(preview.send({id: 'reminder', lang: 'en', values: {}, target: 'a@b.test'})).rejects.toBeInstanceOf(
      UnregisteredNotificationError,
    );
    const noEmail = createNotificationPreview({registry: [RESET], providers: {}, languages: ['en']});
    await expect(noEmail.render({id: 'password-reset', lang: 'en', values: {}})).rejects.toMatchObject({
      channel: 'email',
    });
  });

  it('refuses a value that is not a string, and reads missing values as none', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['en']});
    const body: unknown = {id: 'password-reset', lang: 'en', values: {resetUrl: 7}};
    const refused = async () => preview.render(body as RenderRequest);
    await expect(refused()).rejects.toBeInstanceOf(InvalidValuesError);
    await expect(refused()).rejects.toMatchObject({fieldErrors: {resetUrl: 'Must be a string.'}});
    const noValues: unknown = {id: 'password-reset', lang: 'en'};
    await preview.render(noValues as RenderRequest);
    expect(email.render).toHaveBeenCalledWith('password-reset', {}, 'en');
  });

  it('sends an email to a trimmed target', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['en']});
    await expect(
      preview.send({id: 'password-reset', lang: 'en', values: {resetUrl: 'u'}, target: ' a@b.test '}),
    ).resolves.toEqual({channel: 'email', messageId: 'm-1'});
    expect(email.send).toHaveBeenCalledWith('password-reset', {resetUrl: 'u'}, 'en', 'a@b.test');
  });

  it('sends a push and passes on what the provider counted', async () => {
    const push = pushProvider();
    const preview = createNotificationPreview({registry: [REMINDER], providers: {push}, languages: ['en']});
    await expect(preview.send({id: 'reminder', lang: 'en', values: {}, target: 'tester@x.test'})).resolves.toEqual({
      channel: 'push',
      devices: 2,
      sent: 1,
      failed: 1,
      removed: 0,
    });
  });

  it('answers only the declared fields, whatever else a provider returns', async () => {
    const leaky = {internalId: 'secret', channel: 'push'};
    const email: ChannelProvider<'email'> = {
      render: () => ({...leaky, subject: 'S', html: '<p>h</p>', text: 't'}),
      send: () => ({...leaky, messageId: null}),
    };
    const push: ChannelProvider<'push'> = {
      render: () => ({...leaky, channel: 'email', title: 'T', body: 'B'}),
      send: () => ({...leaky, channel: 'email', devices: 1, sent: 1, failed: 0, removed: 0}),
    };
    const preview = createNotificationPreview({
      registry: [RESET, REMINDER],
      providers: {email, push},
      languages: ['en'],
    });
    const email1 = {id: 'password-reset', lang: 'en', values: {}};
    const push1 = {id: 'reminder', lang: 'en', values: {}};
    await expect(preview.render(email1)).resolves.toStrictEqual({
      channel: 'email',
      subject: 'S',
      html: '<p>h</p>',
      text: 't',
      warnings: [],
    });
    await expect(preview.render(push1)).resolves.toStrictEqual({channel: 'push', title: 'T', body: 'B', warnings: []});
    await expect(preview.send({...email1, target: 'a@x.io'})).resolves.toStrictEqual({
      channel: 'email',
      messageId: null,
    });
    await expect(preview.send({...push1, target: 'acct'})).resolves.toStrictEqual({
      channel: 'push',
      devices: 1,
      sent: 1,
      failed: 0,
      removed: 0,
    });
  });

  it('refuses a send with no target', async () => {
    const email = emailProvider();
    const preview = createNotificationPreview({registry: [RESET], providers: {email}, languages: ['en']});
    const body: unknown = {id: 'password-reset', lang: 'en', values: {}};
    await expect(preview.send(body as SendRequest)).rejects.toMatchObject({
      fieldErrors: {target: 'Required.'},
    });
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('InvalidValuesError', () => {
  it('answers the body the page reads', () => {
    expect(new InvalidValuesError({to: 'Not an address.'}).toBody()).toEqual({
      message: 'A value was refused.',
      fieldErrors: {to: 'Not an address.'},
    });
    expect(new InvalidValuesError({}, 'Nope').message).toBe('Nope');
  });
});

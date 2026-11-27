import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import type {SendResponse} from '../core/types.js';
import {fakeClient} from '../test/fakeClient.js';
import type {PreviewClient} from './client.js';
import {NotificationPreviewPage} from './NotificationPreviewPage.js';

const frame = (): HTMLIFrameElement => screen.getByTitle<HTMLIFrameElement>('Rendered email');

describe('NotificationPreviewPage', () => {
  it('lists the registry by channel and renders the first email', async () => {
    const client = fakeClient();
    render(<NotificationPreviewPage appName="Acme" client={client} environment="staging" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    const list = await screen.findByRole('navigation', {name: 'Notifications'});
    expect(within(within(list).getByRole('region', {name: 'Email'})).getAllByRole('button')).toHaveLength(2);
    expect(within(within(list).getByRole('region', {name: 'Push'})).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('staging')).toBeInTheDocument();
    await waitFor(() => {
      expect(frame().srcdoc).toContain('Hello Ada');
    });
    expect(screen.getByText('An account is created.')).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(client.renders[0]).toEqual({
      id: 'welcome',
      locale: 'en',
      values: {firstName: 'Ada', verifyUrl: 'https://example.com/verify/abc'},
    });
  });

  it('says when the list did not load', async () => {
    render(<NotificationPreviewPage appName="Acme" client={fakeClient({failCatalog: true})} />);
    expect(await screen.findByText('The notification list did not load.')).toBeInTheDocument();
  });

  it('re-renders a moment after an edit, and shows a refusal under its field', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    const name = await screen.findByLabelText(/First name/u);
    await user.clear(name);
    await user.type(name, 'Grace');
    await waitFor(() => {
      expect(frame().srcdoc).toContain('Hello Grace');
    });

    const url = screen.getByLabelText(/Verify URL/u);
    await user.clear(url);
    await user.type(url, 'example.com/x');
    expect(await screen.findByRole('alert')).toHaveTextContent('Must start with https://.');
    expect(screen.getByText(/a value was refused/u)).toBeInTheDocument();
    expect(frame().srcdoc).toContain('Hello Grace');

    await user.click(screen.getByRole('button', {name: 'Reset'}));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', {name: 'Empty'}));
    await waitFor(() => {
      expect(screen.getByLabelText(/First name/u)).toHaveValue('');
    });
  });

  it('switches language, plain text and width', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByTitle('Rendered email');
    await user.selectOptions(screen.getByLabelText('Language'), 'es');
    await waitFor(() => {
      expect(frame().srcdoc).toContain('Hola Ada');
    });
    await user.click(screen.getByRole('radio', {name: 'Phone'}));
    await user.click(screen.getByRole('radio', {name: 'Plain text'}));
    expect(screen.getByLabelText('Plain text', {selector: 'pre'})).toHaveTextContent('Hola Ada');
  });

  it('offers no language picker for one locale, and each channel its own list', async () => {
    const user = userEvent.setup();
    const {unmount} = render(
      <NotificationPreviewPage appName="Acme" client={fakeClient({locales: {email: ['en'], push: ['en']}})} />,
    );
    await screen.findByTitle('Rendered email');
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
    unmount();

    const client = fakeClient({locales: {email: ['en', 'es'], push: ['en']}});
    render(<NotificationPreviewPage appName="Acme" client={client} />);
    await screen.findByTitle('Rendered email');
    await user.selectOptions(screen.getByLabelText('Language'), 'es');
    await user.click(screen.getByRole('button', {name: 'Next notification'}));
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    await screen.findByRole('article', {name: 'Push notification'});
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
    // The push lists only `en`, so the chosen `es` falls back to the channel's default.
    await waitFor(() => {
      expect(client.renders.at(-1)?.locale).toBe('en');
    });
  });

  it('moves between notifications with the pager, the keys and the list, and renders a push', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('button', {name: 'Next notification'}));
    expect(await screen.findByText('2 / 4')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(await screen.findByText('4 / 4')).toBeInTheDocument();
    const push = await screen.findByRole('article', {name: 'Push notification'});
    expect(push).toHaveTextContent('Here is your week.');
    expect(screen.getByRole('region', {name: 'Warnings'})).toHaveTextContent('No translation for es.');
    expect(screen.getByText('This notification takes no variables.')).toBeInTheDocument();

    await user.keyboard('/');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.type(screen.getByRole('searchbox'), 'task');
    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    expect(await screen.findByRole('article', {name: 'Push notification'})).toHaveTextContent('Water the plants');
    await user.click(screen.getByRole('radio', {name: 'Android'}));
    await user.click(screen.getByRole('radio', {name: 'Banner'}));
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No notification matches.')).toBeInTheDocument();
  });

  it('shows details and copies the HTML', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByTitle('Rendered email');
    const tab = screen.getByRole('tab', {name: 'Variables'});
    tab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Hello Ada', {selector: 'dd'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Copy HTML'}));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('<!doctype html>'));
    expect(await screen.findByText('Copied the HTML.')).toBeInTheDocument();
    writeText.mockRejectedValueOnce(new Error('no'));
    await user.click(screen.getByRole('button', {name: 'Copy text'}));
    expect(await screen.findByText('The browser refused the clipboard.')).toBeInTheDocument();
  });

  it('sends a test email, remembers the address, and reports a refusal and a 429', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<NotificationPreviewPage appName="Acme" client={client} />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    await user.type(screen.getByLabelText('To'), ' me@example.com ');
    await user.click(screen.getByRole('button', {name: 'Send test email'}));
    expect(await screen.findByText('Sent to me@example.com.')).toBeInTheDocument();
    expect(client.sends[0]).toMatchObject({id: 'welcome', locale: 'en', target: 'me@example.com'});
    expect(screen.getByRole('button', {name: 'me@example.com'})).toBeInTheDocument();

    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), 'refuse@example.com');
    await user.click(screen.getByRole('button', {name: 'Send test email'}));
    expect(await screen.findByText('Not sent: Not a test address.')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), 'busy@example.com');
    await user.click(screen.getByRole('button', {name: 'Send test email'}));
    expect(await screen.findByText('Too many test sends. Try again in 30 s.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'me@example.com'}));
    expect(screen.getByLabelText('To')).toHaveValue('me@example.com');
  });

  it('sends a test push to an account', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<NotificationPreviewPage appName="Acme" client={client} strings={{sendPush: 'Push it'}} />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    expect(screen.getByText('Every device this account registered receives the push.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Account'), 'account-7');
    await user.click(screen.getByRole('button', {name: 'Push it'}));
    expect(await screen.findByText('Sent to 2 of 2 devices.')).toBeInTheDocument();
    expect(client.sends[0]).toMatchObject({id: 'task-reminder', target: 'account-7'});
  });

  it('refuses an empty target in its own words, before asking the server', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<NotificationPreviewPage appName="Acme" client={client} strings={{targetRequired: 'Falta el destino.'}} />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    await user.click(screen.getByRole('button', {name: 'Send test email'}));
    expect(await screen.findByText('Not sent: Falta el destino.')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');
    expect(client.sends).toHaveLength(0);
  });

  it('keeps recent targets per channel and per environment', async () => {
    const user = userEvent.setup();
    const {unmount} = render(
      <NotificationPreviewPage appName="Acme" client={fakeClient()} environment="staging" storageKey="np" />,
    );
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    await user.type(screen.getByLabelText('Account'), 'account-7');
    await user.click(screen.getByRole('button', {name: 'Send test push'}));
    expect(await screen.findByRole('button', {name: 'account-7'})).toBeInTheDocument();
    expect(localStorage.getItem('np.targets.staging.push')).toBe('["account-7"]');

    await user.click(screen.getByRole('button', {name: /Welcome/u}));
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.queryByRole('button', {name: 'account-7'})).not.toBeInTheDocument();
    unmount();

    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} environment="production" storageKey="np" />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    expect(screen.getByLabelText('Account')).toHaveValue('');
  });

  it('drops the answer to a send still out when another notification opens', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    let answer: ((value: SendResponse) => void) | undefined;
    const slow: PreviewClient = {
      ...client,
      send: async () =>
        new Promise<SendResponse>((resolve) => {
          answer = resolve;
        }),
    };
    render(<NotificationPreviewPage appName="Acme" client={slow} />);
    await screen.findByTitle('Rendered email');
    await user.click(screen.getByRole('tab', {name: 'Send test'}));
    await user.type(screen.getByLabelText('To'), 'me@example.com');
    await user.click(screen.getByRole('button', {name: 'Send test email'}));
    await user.click(screen.getByRole('button', {name: 'Next notification'}));
    answer?.({channel: 'email', messageId: null});
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Send test email'})).toBeEnabled();
    });
    expect(screen.queryByText('Sent to me@example.com.')).not.toBeInTheDocument();
  });

  it('keeps a chosen theme and forgets Auto', async () => {
    const user = userEvent.setup();
    const {unmount} = render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByRole('navigation', {name: 'Notifications'});
    await user.click(screen.getByRole('radio', {name: 'Dark'}));
    expect(localStorage.getItem('vt-labs.notification-preview.theme')).toBe('dark');
    unmount();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByRole('navigation', {name: 'Notifications'});
    expect(screen.getByRole('radio', {name: 'Dark'})).toBeChecked();
    await user.click(screen.getByRole('radio', {name: 'Auto'}));
    expect(screen.getByRole('radio', {name: 'Auto'})).toBeChecked();
    expect(localStorage.getItem('vt-labs.notification-preview.theme')).toBeNull();
  });

  it("names the app on the inbox header, the brand and the phone, and never 'Your app'", async () => {
    const user = userEvent.setup();
    const {container} = render(<NotificationPreviewPage appName="acme" client={fakeClient()} environment="DEV" />);
    await screen.findByTitle('Rendered email');
    const inbox = screen.getByRole('group', {name: 'Inbox header'});
    expect(within(inbox).getByText('acme')).toBeInTheDocument();
    expect(within(inbox).getByText('A')).toHaveAttribute('aria-hidden', 'true');
    expect(within(inbox).getByText('Hello Ada')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('acme');
    expect(screen.getByText('DEV')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    const phone = await screen.findByRole('figure', {name: 'iPhone, Lock screen'});
    expect(within(phone).getByRole('article', {name: 'Push notification'})).toHaveTextContent('Due soon');
    expect(within(phone).getByText('acme')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', {name: 'Android'}));
    const android = screen.getByRole('figure', {name: 'Android, Lock screen'});
    expect(within(android).getByText('acme')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', {name: 'Banner'}));
    expect(screen.getByRole('figure', {name: 'Android, Banner'})).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Your app');
  });

  it('sizes the email frame to its content once the frame has loaded', async () => {
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    const element = await screen.findByTitle<HTMLIFrameElement>('Rendered email');
    await waitFor(() => {
      expect(element.srcdoc).toContain('Hello Ada');
    });
    const body = element.contentDocument?.documentElement;
    expect(body).toBeDefined();
    if (body !== undefined) Object.defineProperty(body, 'scrollHeight', {value: 240, configurable: true});
    element.dispatchEvent(new Event('load'));
    await waitFor(() => {
      expect(element).toHaveStyle({height: '240px'});
    });
    // No script runs in the email; the page only reads its height.
    expect(element).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  it('lets the keyboard reach the stage that scrolls a long email', async () => {
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} />);
    await screen.findByTitle('Rendered email');
    const stage = screen.getByRole('group', {name: 'The notification as it arrives'});
    expect(stage).toHaveAttribute('tabindex', '0');
    stage.focus();
    expect(stage).toHaveFocus();
  });
});

import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it} from 'vitest';

import {fakeClient} from '../../test/fakeClient.js';
import type {PreviewClient} from '../client.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

const KEY = 'np-spec';

const open = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await screen.findByTitle('Rendered email');
  // The mode is remembered, so a second visit opens with it on already.
  const mode = screen.getByRole('switch', {name: 'Test mode'});
  if (mode.getAttribute('aria-checked') !== 'true') await user.click(mode);
  expect(mode).toBeChecked();
};

describe('test mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows nothing of it until it is switched on', async () => {
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await screen.findByTitle('Rendered email');
    expect(screen.getByRole('switch', {name: 'Test mode'})).not.toBeChecked();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', {name: 'Test progress'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Welcome/u})).not.toHaveTextContent('Not tested');
  });

  it('ticks the open notification and counts it', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    const progress = screen.getByRole('group', {name: 'Test progress'});
    expect(within(progress).getByText('0 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Not tested');

    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    expect(within(progress).getByText('1 / 4')).toBeInTheDocument();
    expect(within(progress).getByText('1 / 2', {selector: '[data-channel="email"] b'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Tested');

    await user.click(screen.getByRole('checkbox', {name: 'Tested'}));
    expect(within(progress).getByText('0 / 4')).toBeInTheDocument();
  });

  it('keeps a tick as it is while values are typed', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));

    const name = screen.getByLabelText(/First name/u);
    await user.clear(name);
    await user.type(name, 'Grace');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeEnabled();
    });
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', {name: 'Test progress'})).getByText('1 / 4')).toBeInTheDocument();
  });

  it("asks for a retest when the server's fingerprint for the open one changed since the tick", async () => {
    const user = userEvent.setup();
    const view = render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));
    view.unmount();

    render(<NotificationPreviewPage appName="Acme" client={fakeClient({changed: ['welcome']})} storageKey={KEY} />);
    await open(user);
    expect(await screen.findByText('Changed since you tested it.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).not.toBeChecked();
    expect(screen.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Changed since tested');

    await user.click(screen.getByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
  });

  it('counts a ticked one that is not open as changed, and lists it to test, when its fingerprint changed', async () => {
    const user = userEvent.setup();
    const view = render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(screen.getByRole('button', {name: /Invoice due/u}));
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).toBeEnabled();
    });
    await user.click(screen.getByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    view.unmount();

    render(<NotificationPreviewPage appName="Acme" client={fakeClient({changed: ['invoice-due']})} storageKey={KEY} />);
    await open(user);
    const progress = screen.getByRole('group', {name: 'Test progress'});
    expect(within(progress).getByText('1 changed · 3 not tested')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Invoice due/u})).toHaveTextContent('Changed since tested');

    await user.click(screen.getByRole('radio', {name: 'To test'}));
    expect(screen.getByRole('button', {name: /Invoice due/u})).toBeInTheDocument();
  });

  it('remembers a tick in this browser across visits', async () => {
    const user = userEvent.setup();
    const view = render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));
    view.unmount();

    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    expect(await screen.findByRole('checkbox', {name: 'Tested'})).toBeChecked();
    expect(localStorage.getItem(`${KEY}:tested`)).not.toBeNull();
  });

  it('remembers whether test mode was on', async () => {
    const user = userEvent.setup();
    const view = render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    expect(localStorage.getItem(`${KEY}:testMode`)).not.toBeNull();
    view.unmount();

    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await screen.findByTitle('Rendered email');
    expect(screen.getByRole('switch', {name: 'Test mode'})).toBeChecked();
    await user.click(screen.getByRole('switch', {name: 'Test mode'}));
    expect(localStorage.getItem(`${KEY}:testMode`)).toBeNull();
  });

  it('says how many changed and are not tested, and counts tested over total in each group', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    const progress = screen.getByRole('group', {name: 'Test progress'});
    expect(within(progress).getByText('0 changed · 4 not tested')).toBeInTheDocument();
    const email = screen.getByRole('region', {name: 'Email'});
    expect(within(email).getByRole('heading')).toHaveTextContent('0 / 2');

    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));
    expect(within(progress).getByText('0 changed · 3 not tested')).toBeInTheDocument();
    expect(within(email).getByRole('heading')).toHaveTextContent('1 / 2');
  });

  it('filters the list to what is left to test, or what is tested', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));

    await user.click(screen.getByRole('radio', {name: 'To test'}));
    expect(screen.queryByRole('button', {name: /Welcome/u})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Invoice due/u})).toBeInTheDocument();

    await user.click(screen.getByRole('radio', {name: 'Tested'}));
    expect(screen.getByRole('button', {name: /Welcome/u})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Invoice due/u})).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', {name: 'All'}));
    expect(screen.getByRole('button', {name: /Invoice due/u})).toBeInTheDocument();
  });

  it('never ticks one language with the render of another', async () => {
    const user = userEvent.setup();
    const base = fakeClient();
    let release: () => void = () => undefined;
    const client: PreviewClient = {
      ...base,
      render: (request) =>
        request.locale === 'es'
          ? new Promise((resolve) => {
              release = () => {
                resolve(base.render(request));
              };
            })
          : base.render(request),
    };
    render(<NotificationPreviewPage appName="Acme" client={client} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));

    await user.selectOptions(screen.getByLabelText('Language'), 'es');
    // The Spanish render is on its way: nothing to tick, and the English tick is not called stale.
    expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).toBeDisabled();
    expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();

    release();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).toBeEnabled();
    });
    await user.click(screen.getByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
  });

  it('keeps the tick off while a render is in flight', async () => {
    const user = userEvent.setup();
    const base = fakeClient();
    const client: PreviewClient = {
      ...base,
      render: (request) =>
        request.values['firstName'] === 'Grace' ? new Promise(() => undefined) : base.render(request),
    };
    render(<NotificationPreviewPage appName="Acme" client={client} storageKey={KEY} />);
    await open(user);
    const name = await screen.findByLabelText(/First name/u);
    await user.clear(name);
    await user.type(name, 'Grace');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).toBeDisabled();
    });
  });

  it("judges each entry in its own channel's locale, so a Spanish email leaves an English-only push tested", async () => {
    const user = userEvent.setup();
    const client = fakeClient({locales: {email: ['en', 'es'], push: ['en']}});
    render(<NotificationPreviewPage appName="Acme" client={client} storageKey={KEY} />);
    await open(user);
    await user.click(screen.getByRole('button', {name: /Task reminder/u}));
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).toBeEnabled();
    });
    await user.click(screen.getByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();

    await user.click(screen.getByRole('button', {name: /Welcome/u}));
    await screen.findByTitle('Rendered email');
    await user.selectOptions(screen.getByLabelText('Language'), 'es');
    await waitFor(() => {
      expect(client.renders.at(-1)).toMatchObject({id: 'welcome', locale: 'es'});
    });
    expect(screen.getByRole('button', {name: /Task reminder/u})).toHaveTextContent('Tested');
    expect(within(screen.getByRole('group', {name: 'Test progress'})).getByText('1 / 4')).toBeInTheDocument();
  });
});

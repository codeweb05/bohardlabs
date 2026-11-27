import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it} from 'vitest';

import {fakeClient} from '../../test/fakeClient.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

const KEY = 'np-spec';

const open = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await screen.findByTitle('Rendered email');
  await user.click(screen.getByRole('switch', {name: 'Test mode'}));
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

  it('asks for a retest when an edit changes the render', async () => {
    const user = userEvent.setup();
    render(<NotificationPreviewPage appName="Acme" client={fakeClient()} storageKey={KEY} />);
    await open(user);
    await user.click(await screen.findByRole('checkbox', {name: 'Mark as tested'}));
    expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();

    const name = screen.getByLabelText(/First name/u);
    await user.clear(name);
    await user.type(name, 'Grace');
    expect(await screen.findByText('Changed since you tested it.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Mark as tested'})).not.toBeChecked();
    expect(screen.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Changed since tested');
    expect(within(screen.getByRole('group', {name: 'Test progress'})).getByText('0 / 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Reset'}));
    await waitFor(() => {
      expect(screen.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
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
});

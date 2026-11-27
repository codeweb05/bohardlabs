import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, waitFor, within} from 'storybook/test';

import {fakeClient} from '../../test/fakeClient.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

import styles from '../style.css?inline';

/** The rendered email's HTML, as the sandboxed frame holds it. */
function frame(root: HTMLElement): string {
  const element = within(root).getByTitle('Rendered email');
  return element instanceof HTMLIFrameElement ? element.srcdoc : '';
}

const meta = {
  title: 'NotificationPreview/NotificationPreviewPage',
  component: NotificationPreviewPage,
  // Each story in a frame of its own on the docs page too: the page holds the whole document, so
  // its stylesheet stops the document scrolling, and inlined there it would stop the docs page.
  parameters: {layout: 'fullscreen', docs: {story: {inline: false, height: '720px'}}},
  // The stylesheet the served page links, inlined here so it reaches only these stories.
  decorators: [
    (Story) => (
      <>
        <style>{styles}</style>
        <Story />
      </>
    ),
  ],
  args: {client: fakeClient(), appName: 'Acme', environment: 'staging'},
} satisfies Meta<typeof NotificationPreviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The registry listed by channel, with the first email rendered. */
export const Email: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole('navigation', {name: 'Notifications'});
    await expect(within(list).getByRole('region', {name: 'Email'})).toBeInTheDocument();
    await expect(within(list).getByRole('region', {name: 'Push'})).toBeInTheDocument();
    await waitFor(() => expect(frame(canvasElement)).toContain('Hello Ada'));
    await expect(canvas.getByText('An account is created.')).toBeInTheDocument();
  },
};

/** An edit re-renders a moment later; a refused value shows under its field and the last render stays. */
export const EditAVariable: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const name = await canvas.findByLabelText(/First name/u);
    await userEvent.clear(name);
    await userEvent.type(name, 'Grace');
    await waitFor(() => expect(frame(canvasElement)).toContain('Hello Grace'));
    const url = canvas.getByLabelText(/Verify URL/u);
    await userEvent.clear(url);
    await userEvent.type(url, 'example.com/x');
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Must start with https://.');
    await expect(frame(canvasElement)).toContain('Hello Grace');
  },
};

/** The language select renders the same notification in another language. */
export const SwitchLanguage: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.selectOptions(canvas.getByLabelText('Language'), 'es');
    await waitFor(() => expect(frame(canvasElement)).toContain('Hola Ada'));
    await userEvent.click(canvas.getByRole('radio', {name: 'Plain text'}));
    await expect(canvas.getByLabelText('Plain text', {selector: 'pre'})).toHaveTextContent('Hola Ada');
  },
};

/** A push entry draws its title and body on a phone. */
export const Push: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('button', {name: /Task reminder/u}));
    const push = await canvas.findByRole('article', {name: 'Push notification'});
    await expect(push).toHaveTextContent('Due soon');
    await expect(push).toHaveTextContent('Water the plants is due in 15 minutes.');
    await userEvent.click(canvas.getByRole('radio', {name: 'Android'}));
    await userEvent.click(canvas.getByRole('radio', {name: 'Banner'}));
    await expect(canvas.getByRole('article', {name: 'Push notification'})).toBeVisible();
  },
};

/** The Send test tab mails the open notification to an address. */
export const SendAnEmail: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('tab', {name: 'Send test'}));
    const to = canvas.getByLabelText('To');
    await userEvent.clear(to);
    await userEvent.type(to, 'me@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Send test email'}));
    await expect(await canvas.findByText('Sent to me@example.com.')).toBeInTheDocument();
  },
};

/** A push goes to every device the account registered. */
export const SendAPush: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('button', {name: /Task reminder/u}));
    await userEvent.click(canvas.getByRole('tab', {name: 'Send test'}));
    await userEvent.clear(canvas.getByLabelText('Account'));
    await userEvent.type(canvas.getByLabelText('Account'), 'account-7');
    await userEvent.click(canvas.getByRole('button', {name: 'Send test push'}));
    await expect(await canvas.findByText('Sent to 2 of 2 devices.')).toBeInTheDocument();
  },
};

/** The server refused the target: the field says why. */
export const SendRefused: Story = {
  args: {client: fakeClient()},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('tab', {name: 'Send test'}));
    const to = canvas.getByLabelText('To');
    await userEvent.clear(to);
    await userEvent.type(to, 'refuse@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Send test email'}));
    await expect(await canvas.findByText('Not sent: Not a test address.')).toBeInTheDocument();
    await expect(to).toHaveAttribute('aria-invalid', 'true');
  },
};

/** Every word is a prop; here in Spanish, in the dark theme. */
export const Translated: Story = {
  args: {
    client: fakeClient(),
    strings: {title: 'Vista previa de notificaciones', list: 'Notificaciones', search: 'Buscar una notificación'},
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', {name: 'Vista previa de notificaciones'})).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('radio', {name: 'Dark'}));
    await expect(canvasElement.querySelector('.np-root')).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(canvas.getByRole('radio', {name: 'Auto'}));
    await expect(screen.getByRole('navigation', {name: 'Notificaciones'})).toBeInTheDocument();
  },
};

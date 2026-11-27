import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, waitFor, within} from 'storybook/test';

import {fakeClient} from '../../test/fakeClient.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

import styles from '../style.css?inline';

/** The rendered email's HTML, as the sandboxed frame holds it. */
function frame(root: HTMLElement): string {
  const element = within(root).getByTitle('Rendered email');
  return element instanceof HTMLIFrameElement ? element.srcdoc : '';
}

const meta = {
  title: 'NotificationPreview/TestMode',
  component: NotificationPreviewPage,
  parameters: {layout: 'fullscreen', docs: {story: {inline: false, height: '720px'}}},
  decorators: [
    (Story) => (
      <>
        <style>{styles}</style>
        <Story />
      </>
    ),
  ],
  // Each story starts with no ticks and test mode off, which the page remembers between visits.
  args: {client: fakeClient({extra: 35}), appName: 'Acme', storageKey: 'np-story-test-mode'},
  beforeEach: () => {
    try {
      localStorage.removeItem('np-story-test-mode:tested');
      localStorage.removeItem('np-story-test-mode:testMode');
    } catch {
      // Nothing was kept.
    }
  },
} satisfies Meta<typeof NotificationPreviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A tester switches test mode on, ticks the open notification, and the progress counts it of all 39. */
export const TickANotification: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('switch', {name: 'Test mode'}));
    const progress = canvas.getByRole('group', {name: 'Test progress'});
    await expect(within(progress).getByText('0 / 39')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('checkbox', {name: 'Mark as tested'}));
    await expect(within(progress).getByText('1 / 39')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Tested');
  },
};

/**
 * Typing other values into a ticked notification leaves its tick as it is. The checks wait for the
 * render of the typed value, so a tick reset by typing, or judged by the open render, fails here.
 */
export const TypingKeepsTheTick: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await waitFor(() => expect(frame(canvasElement)).toContain('Hello Ada'));
    await userEvent.click(canvas.getByRole('switch', {name: 'Test mode'}));
    const tick = await canvas.findByRole('checkbox', {name: 'Mark as tested'});
    await waitFor(() => expect(tick).toBeEnabled());
    await userEvent.click(tick);
    await expect(canvas.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
    const name = canvas.getByLabelText(/First name/u);
    await userEvent.clear(name);
    await userEvent.type(name, 'Grace');
    await waitFor(() => expect(frame(canvasElement)).toContain('Hello Grace'));
    await waitFor(() => {
      expect(canvas.getByRole('checkbox', {name: 'Tested'})).toBeChecked();
      expect(canvas.getByRole('checkbox', {name: 'Tested'})).toBeEnabled();
      expect(canvas.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
    });
    await expect(canvas.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Tested');
  },
};

/**
 * Welcome was ticked on an earlier visit, and its template has changed since: the catalog now gives
 * another fingerprint for it. The page shows it as changed, counts it and lists it to test.
 */
export const RetestAfterATemplateChange: Story = {
  args: {client: fakeClient({extra: 35, changed: ['welcome']})},
  beforeEach: () => {
    try {
      // The tick as the earlier visit stored it, with the fingerprint the catalog gave then.
      localStorage.setItem('np-story-test-mode:tested', JSON.stringify([['welcome', 'en', 'welcome.en.v1']]));
      localStorage.setItem('np-story-test-mode:testMode', '1');
    } catch {
      // Without storage the story shows no tick.
    }
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await expect(await canvas.findByText('Changed since you tested it.')).toBeInTheDocument();
    await expect(canvas.getByRole('checkbox', {name: 'Mark as tested'})).not.toBeChecked();
    await expect(canvas.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Changed since tested');
    const progress = canvas.getByRole('group', {name: 'Test progress'});
    await expect(within(progress).getByText(/1 changed/u)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('radio', {name: 'To test'}));
    await expect(await canvas.findByRole('button', {name: /Welcome/u})).toBeInTheDocument();
  },
};

import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, waitFor, within} from 'storybook/test';

import {fakeClient} from '../../test/fakeClient.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

import styles from '../style.css?inline';

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

/** A variable that changes the render after a tick turns the notice to retest. */
export const RetestAfterAnEdit: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('switch', {name: 'Test mode'}));
    await userEvent.click(await canvas.findByRole('checkbox', {name: 'Mark as tested'}));
    const name = canvas.getByLabelText(/First name/u);
    await userEvent.clear(name);
    await userEvent.type(name, 'Grace');
    await waitFor(() => expect(canvas.getByText('Changed since you tested it.')).toBeInTheDocument());
    await expect(canvas.getByRole('button', {name: /Welcome/u})).toHaveTextContent('Changed since tested');
    await expect(canvas.getByRole('checkbox', {name: 'Mark as tested'})).not.toBeChecked();
  },
};

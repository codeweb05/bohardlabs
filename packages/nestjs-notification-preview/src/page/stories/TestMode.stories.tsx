import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

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

/** Typing other values into a ticked notification leaves its tick as it is. */
export const TypingKeepsTheTick: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Rendered email');
    await userEvent.click(canvas.getByRole('switch', {name: 'Test mode'}));
    await userEvent.click(await canvas.findByRole('checkbox', {name: 'Mark as tested'}));
    const name = canvas.getByLabelText(/First name/u);
    await userEvent.clear(name);
    await userEvent.type(name, 'Grace');
    await expect(await canvas.findByRole('checkbox', {name: 'Tested'})).toBeChecked();
    await expect(canvas.queryByText('Changed since you tested it.')).not.toBeInTheDocument();
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

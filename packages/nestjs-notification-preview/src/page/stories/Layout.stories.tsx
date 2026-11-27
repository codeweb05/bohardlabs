import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, waitFor, within} from 'storybook/test';

import {fakeClient} from '../../test/fakeClient.js';
import {NotificationPreviewPage} from '../NotificationPreviewPage.js';

import styles from '../style.css?inline';

/** The rendered email's frame, once it holds `text`. */
async function emailFrame(root: HTMLElement, text: string): Promise<HTMLIFrameElement> {
  const element = await within(root).findByTitle('Rendered email');
  if (!(element instanceof HTMLIFrameElement)) throw new Error('The rendered email is not a frame');
  await waitFor(() => expect(element.srcdoc).toContain(text));
  return element;
}

/** A region of the page by its name. */
function region(root: HTMLElement, role: 'navigation' | 'region' | 'complementary', name: string): HTMLElement {
  return within(root).getByRole(role, {name});
}

const noBorder = (element: Element): boolean => {
  const style = getComputedStyle(element);
  return ['Top', 'Right', 'Bottom', 'Left'].every(
    (side) => style.getPropertyValue(`border-${side.toLowerCase()}-width`) === '0px',
  );
};

/** An email long enough to need more than the canvas. */
const longEmail = fakeClient();
const longClient = {
  ...longEmail,
  render: async (request: Parameters<typeof longEmail.render>[0]) => {
    const rendered = await longEmail.render(request);
    if (rendered.channel !== 'email') return rendered;
    const paragraphs = Array.from({length: 80}, (_, index) => `<p>Paragraph ${String(index + 1)}.</p>`).join('');
    return {...rendered, html: rendered.html.replace('</body>', `${paragraphs}</body>`)};
  },
};

/**
 * The six layout rules of the page, each checked in a real browser at a laptop's size. The
 * viewport is the one the screenshots are taken at.
 */
const meta = {
  title: 'NotificationPreview/Layout',
  component: NotificationPreviewPage,
  parameters: {
    layout: 'fullscreen',
    docs: {story: {inline: false, height: '720px'}},
    viewport: {
      options: {laptop: {name: 'Laptop', styles: {width: '1440px', height: '900px'}, type: 'desktop'}},
    },
  },
  globals: {viewport: {value: 'laptop', isRotated: false}},
  decorators: [
    (Story) => (
      <>
        <style>{styles}</style>
        <Story />
      </>
    ),
  ],
  args: {client: fakeClient(), appName: 'Acme', environment: 'DEV'},
} satisfies Meta<typeof NotificationPreviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 1. The document never scrolls. With 40 notifications the list scrolls inside itself, as do
 * the canvas and the inspector.
 */
export const DocumentNeverScrolls: Story = {
  args: {client: fakeClient({extra: 36})},
  // The story's note and code block would sit below the page and make the document taller
  // than the page it is checking, so this story shows neither.
  parameters: {docs: {description: {story: null}, source: {originalSource: null}}},
  play: async ({canvasElement}) => {
    await emailFrame(canvasElement, 'Hello Ada');
    const list = region(canvasElement, 'navigation', 'Notifications');
    await expect(within(list).getAllByRole('button')).toHaveLength(40);
    const scrolling = document.scrollingElement;
    await expect(scrolling?.scrollHeight).toBe(window.innerHeight);
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await expect(getComputedStyle(list).overflowY).toBe('auto');
    const stage = canvasElement.querySelector('.np-stage');
    await expect(stage === null ? '' : getComputedStyle(stage).overflowY).toBe('auto');
    const panel = within(region(canvasElement, 'complementary', 'Inspector')).getByRole('tabpanel');
    await expect(getComputedStyle(panel).overflowY).toBe('auto');
  },
};

/** 2. No card around the canvas: the email sits on the canvas's dotted background. */
export const NoCardAroundTheCanvas: Story = {
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Hello Ada');
    const canvas = region(canvasElement, 'region', 'Preview');
    await expect(noBorder(canvas)).toBe(true);
    await expect(getComputedStyle(canvas).backgroundImage).toContain('radial-gradient');
    // Nothing between the canvas and the email draws a box of its own.
    for (let element = frame.parentElement; element !== null && element !== canvas; element = element.parentElement) {
      await expect(noBorder(element)).toBe(true);
    }
  },
};

/** 3. The frame is as tall as the email in it: no white box under a short email. */
export const FrameFitsAShortEmail: Story = {
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Hello Ada');
    await waitFor(() => {
      const content = frame.contentDocument?.documentElement.scrollHeight ?? 0;
      return expect(Math.abs(frame.getBoundingClientRect().height - content)).toBeLessThanOrEqual(1);
    });
    const stage = canvasElement.querySelector('.np-stage');
    await expect(stage === null ? 0 : stage.getBoundingClientRect().height).toBeGreaterThan(
      frame.getBoundingClientRect().height,
    );
    await expect(stage === null ? 0 : stage.scrollHeight - stage.clientHeight).toBe(0);
  },
};

/** 3. A long email grows the frame past the canvas, and the canvas scrolls. */
export const FrameGrowsWithALongEmail: Story = {
  args: {client: longClient},
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Paragraph 80.');
    await waitFor(() => {
      const content = frame.contentDocument?.documentElement.scrollHeight ?? 0;
      return expect(Math.abs(frame.getBoundingClientRect().height - content)).toBeLessThanOrEqual(1);
    });
    const stage = canvasElement.querySelector('.np-stage');
    await expect(stage === null ? 0 : stage.scrollHeight).toBeGreaterThan(stage?.clientHeight ?? 0);
    await expect(document.scrollingElement?.scrollHeight).toBe(window.innerHeight);
  },
};

/** 4. The inbox header names the app, with its initial, and no stand-in name. */
export const InboxHeaderNamesTheApp: Story = {
  args: {appName: 'Promptiva'},
  play: async ({canvasElement}) => {
    await emailFrame(canvasElement, 'Hello Ada');
    const inbox = within(canvasElement).getByRole('group', {name: 'Inbox header'});
    await expect(within(inbox).getByText('Promptiva')).toBeVisible();
    await expect(within(inbox).getByText('P')).toBeVisible();
    await expect(within(inbox).getByText('Hello Ada')).toBeVisible();
    await expect(canvasElement).not.toHaveTextContent('Your app');
  },
};

/** 5. A push is drawn on a phone's lock screen, under the app's name. */
export const PushOnAPhone: Story = {
  args: {appName: 'Promptiva'},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await emailFrame(canvasElement, 'Hello Ada');
    await userEvent.click(canvas.getByRole('button', {name: /Task reminder/u}));
    const phone = await canvas.findByRole('figure', {name: 'iPhone, Lock screen'});
    const push = within(phone).getByRole('article', {name: 'Push notification'});
    await expect(within(push).getByText('Promptiva')).toBeVisible();
    await expect(push).toHaveTextContent('Due soon');
    await expect(within(phone).getAllByText('9:41').length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('radio', {name: 'Android'}));
    const android = canvas.getByRole('figure', {name: 'Android, Lock screen'});
    await expect(within(android).getByText('Promptiva')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', {name: 'Banner'}));
    await expect(canvas.getByRole('figure', {name: 'Android, Banner'})).toBeVisible();
  },
};

/** 6. One locale: no language picker. */
export const OneLocaleNoPicker: Story = {
  args: {client: fakeClient({locales: {email: ['en'], push: ['en']}})},
  play: async ({canvasElement}) => {
    await emailFrame(canvasElement, 'Hello Ada');
    await expect(within(canvasElement).queryByRole('combobox', {name: 'Language'})).not.toBeInTheDocument();
  },
};

/** 6. Each channel its own list: the picker shows on the email, which has two, and not on the push. */
export const PickerFollowsTheChannel: Story = {
  args: {client: fakeClient({locales: {email: ['en', 'es'], push: ['en']}})},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await emailFrame(canvasElement, 'Hello Ada');
    await expect(canvas.getByRole('combobox', {name: 'Language'})).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {name: /Task reminder/u}));
    await canvas.findByRole('figure', {name: 'iPhone, Lock screen'});
    await expect(canvas.queryByRole('combobox', {name: 'Language'})).not.toBeInTheDocument();
  },
};

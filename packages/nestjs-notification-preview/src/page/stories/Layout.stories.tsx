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

/**
 * The height the email's own content takes, read from the root's box: inside a frame the root's
 * `scrollHeight` is never less than the frame, so it cannot tell a measured frame from one left
 * at its CSS height.
 */
const contentOf = (frame: HTMLIFrameElement): number =>
  Math.ceil(frame.contentDocument?.documentElement.getBoundingClientRect().height ?? 0);

/** The frame's CSS height before it is measured, in `style.css`. */
const UNMEASURED = 160;

/** 3. The frame is as tall as the email in it: no white box under a short email. */
export const FrameFitsAShortEmail: Story = {
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Hello Ada');
    await waitFor(() => expect(frame.style.height).not.toBe(''));
    // One paragraph is far shorter than the unmeasured frame: this fails if nothing measures.
    await expect(frame.getBoundingClientRect().height).toBeLessThan(UNMEASURED);
    await expect(Math.abs(frame.getBoundingClientRect().height - contentOf(frame))).toBeLessThanOrEqual(1);
    const stage = canvasElement.querySelector('.np-stage');
    await expect(stage === null ? 0 : stage.scrollHeight - stage.clientHeight).toBe(0);
  },
};

/**
 * 3. A long email grows the frame past the canvas, and the canvas scrolls. The stage takes focus
 * and has a name, so the keyboard can scroll it.
 */
export const FrameGrowsWithALongEmail: Story = {
  args: {client: longClient},
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Paragraph 80.');
    await waitFor(() => expect(frame.getBoundingClientRect().height).toBeGreaterThan(1000));
    await expect(Math.abs(frame.getBoundingClientRect().height - contentOf(frame))).toBeLessThanOrEqual(1);
    const stage = within(canvasElement).getByRole('group', {name: 'The notification as it arrives'});
    await expect(stage.scrollHeight).toBeGreaterThan(stage.clientHeight);
    await expect(stage).toHaveAttribute('tabindex', '0');
    stage.focus();
    await expect(stage).toHaveFocus();
    await expect(document.scrollingElement?.scrollHeight).toBe(window.innerHeight);
  },
};

/** `html` with its root and body made `height: 100%`, as some email templates are. */
const fullHeight = (html: string): string =>
  html.replace('<html>', '<html style="height:100%">').replace('<body style="', '<body style="height:100%;margin:0;');

/** The render of `client`, its email made full-height. */
const fullHeightClient = (client: typeof longClient): typeof longClient => ({
  ...client,
  render: async (request: Parameters<typeof longClient.render>[0]) => {
    const rendered = await client.render(request);
    return rendered.channel === 'email' ? {...rendered, html: fullHeight(rendered.html)} : rendered;
  },
});

/**
 * Where the email's last paragraph ends, in the frame's own coordinates. A full-height email's
 * root box is the frame, so this, not the root, says how tall the content is.
 */
const lastLineOf = (frame: HTMLIFrameElement): number => {
  const paragraphs = frame.contentDocument?.querySelectorAll('p');
  const last = paragraphs?.item(paragraphs.length - 1);
  return last === null || last === undefined ? 0 : Math.ceil(last.getBoundingClientRect().bottom);
};

/**
 * The frame holds the whole email, and leaves no white box under it beyond the last
 * paragraph's own bottom margin (16px). The frame is tested, not the stage: the stage scrolls a
 * long email by design. The frame's document may still scroll by the body's collapsed top
 * margin: a `height: 100%` body pushed down by its first paragraph's margin ends 16px below
 * the root at every frame height, so no height makes that scroll go away, and it scrolls only
 * the body's empty tail, never content.
 */
const holdsTheWholeEmail = async (frame: HTMLIFrameElement): Promise<void> => {
  const height = frame.getBoundingClientRect().height;
  const lastLine = lastLineOf(frame);
  await expect(lastLine).toBeGreaterThan(0);
  await expect(height).toBeGreaterThanOrEqual(lastLine - 1);
  await expect(height).toBeLessThanOrEqual(lastLine + 17);
};

/**
 * 3. An email whose html and body are `height: 100%` is measured by its content, not by the
 * frame: a long one grows the frame past the canvas.
 */
export const FrameMeasuresAFullHeightEmail: Story = {
  args: {client: fullHeightClient(longClient)},
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Paragraph 80.');
    // A frame measured by its own viewport, or its root's box, stays short.
    await waitFor(() => expect(frame.getBoundingClientRect().height).toBeGreaterThan(1000));
    await holdsTheWholeEmail(frame);
  },
};

/**
 * 3. A short full-height email shrinks the frame below its unmeasured height. Measured at the
 * frame's current height, its root and body would answer that height back and the frame would
 * never shrink; this fails unless the frame is reset before it is measured.
 */
export const FrameShrinksToAShortFullHeightEmail: Story = {
  args: {client: fullHeightClient(fakeClient())},
  play: async ({canvasElement}) => {
    const frame = await emailFrame(canvasElement, 'Hello Ada');
    await waitFor(() => expect(frame.getBoundingClientRect().height).toBeLessThan(UNMEASURED));
    await holdsTheWholeEmail(frame);
  },
};

/** 3. At phone width a short email still sits in a whole handset, the paper filling its screen. */
export const PhoneWidthKeepsTheHandset: Story = {
  play: async ({canvasElement}) => {
    await emailFrame(canvasElement, 'Hello Ada');
    await userEvent.click(within(canvasElement).getByRole('radio', {name: 'Phone'}));
    const screen = await waitFor(() => {
      const found = canvasElement.querySelector('.np-viewport[data-width="phone"] .np-viewport-screen');
      if (found === null) throw new Error('No phone viewport');
      return found;
    });
    await expect(screen.getBoundingClientRect().height).toBeGreaterThanOrEqual(560);
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

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {createTheme, ThemeProvider, type Theme} from '@mui/material/styles';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {expect, fn, mocked, screen, userEvent, waitFor, within} from 'storybook/test';

import {ImageEditor, type ImageEditorProps, type ImageEditorResult} from '../index.js';
import {noiseUrl, pixelAt, QUADRANT_COLOURS, quadrantsUrl, rgba, urlToFile} from './fixtures.js';

type DemoProps = ImageEditorProps & {
  /** Start on the built-in picker instead of the test picture. */
  readonly picker?: boolean;
};

/**
 * The editor hangs off the button that would open it in an app. `open` and `source`
 * belong to the caller, so the demo owns them and passes the rest through.
 */
function EditPhoto({source, onApply, onClose, picker, ...props}: Readonly<DemoProps>) {
  const [open, setOpen] = useState(false);
  const [fixture] = useState(() => (picker ? null : (source ?? quadrantsUrl())));
  const [result, setResult] = useState<{url: string; width: number; height: number} | null>(null);

  const apply = async (edited: ImageEditorResult) => {
    await onApply(edited);
    setResult({url: URL.createObjectURL(edited.file), width: edited.width, height: edited.height});
    setOpen(false);
  };

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2}}>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Edit photo
      </Button>
      {result && (
        <Box
          component="img"
          src={result.url}
          alt="Edited photo"
          sx={{maxWidth: 240, border: 1, borderColor: 'divider'}}
        />
      )}
      <ImageEditor
        {...props}
        open={open}
        source={fixture}
        onApply={apply}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
    </Box>
  );
}

const meta = {
  title: 'ImageEditor/ImageEditor',
  component: ImageEditor,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          'A dialog that crops, rotates, flips and adjusts one image and hands back a `File` that',
          'fits your upload rules. Give it a `File`, a `Blob` or a URL as `source`, or `null` for',
          'the built-in picker. Tools are switched on one by one through `features`.',
        ].join(' '),
      },
    },
  },
  args: {
    open: false,
    source: null,
    onApply: fn(),
    onClose: fn(),
    onError: fn(),
  },
  render: (args) => <EditPhoto {...args} />,
} satisfies Meta<typeof ImageEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controls for the stories that are about one prop group. */
function showcase(...props: (keyof ImageEditorProps)[]) {
  return {controls: {include: props}, docs: {controls: {include: props}}};
}

/** Opens the editor from the demo button and waits for the cropper to draw its selection. */
async function openEditor(canvasElement: HTMLElement, title = 'Edit image') {
  await userEvent.click(within(canvasElement).getByRole('button', {name: 'Edit photo'}));
  const dialog = await screen.findByRole('dialog', {name: title});
  const stage = await within(dialog).findByTestId('image-editor-stage');
  await waitFor(() => expect(stage.querySelector('cropper-selection')).not.toBeNull());
  return dialog;
}

/** Presses the apply button and returns the one file `onApply` received. */
async function applyEdits(dialog: HTMLElement, onApply: ImageEditorProps['onApply'], name = 'Apply') {
  await userEvent.click(within(dialog).getByRole('button', {name}));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  const [result] = mocked(onApply).mock.calls[0] ?? [];
  if (!result) throw new Error('onApply had no result');
  return result;
}

/** The defaults: crop with four ratios, zoom, rotate and flip. Apply returns the cropped file. */
export const Basic: Story = {
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const result = await applyEdits(dialog, args.onApply);

    // The first ratio is free, so the untouched crop is the whole 1200 × 800 picture.
    await expect(result).toEqual(expect.objectContaining({type: 'image/png', width: 1200, height: 800}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(await within(canvasElement).findByRole('img', {name: 'Edited photo'})).toBeVisible();
  },
};

/**
 * A profile picture: a round crop, no flip, and a 256 px PNG. The corners outside the circle
 * are transparent, so the avatar sits on any background.
 */
export const Avatar: Story = {
  parameters: showcase('features', 'output'),
  args: {
    features: {crop: {shape: 'circle'}, flip: false},
    output: {type: 'image/png', maxWidth: 256, maxHeight: 256},
  },
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    await expect(within(dialog).queryByRole('group', {name: 'Aspect ratio'})).not.toBeInTheDocument();
    await expect(within(dialog).queryByRole('button', {name: 'Flip horizontally'})).not.toBeInTheDocument();

    const result = await applyEdits(dialog, args.onApply);
    await expect(result).toEqual(expect.objectContaining({type: 'image/png', width: 256, height: 256}));
    const [, , , cornerAlpha] = await pixelAt(result.file, 2, 2);
    const [, , , centreAlpha] = await pixelAt(result.file, 128, 128);
    await expect(cornerAlpha).toBe(0);
    await expect(centreAlpha).toBe(255);
  },
};

/** A round crop in a type without transparency: the corners take `output.background`. */
export const RoundJpeg: Story = {
  parameters: showcase('output'),
  args: {
    features: {crop: {shape: 'circle'}},
    output: {type: 'image/jpeg', maxWidth: 256, maxHeight: 256, background: '#ff00ff'},
  },
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const result = await applyEdits(dialog, args.onApply);
    await expect(result).toEqual(expect.objectContaining({type: 'image/jpeg', width: 256, height: 256}));
    // JPEG is lossy, so each channel is compared within a tolerance.
    const corner = await pixelAt(result.file, 2, 2);
    const drift = rgba('#ff00ff').map((channel, index) => Math.abs((corner[index] ?? 0) - channel));
    await expect(Math.max(...drift)).toBeLessThan(12);
  },
};

/**
 * Every tool at once: ratios, the zoom slider, straighten, the Adjust tab with presets, undo
 * and redo, Reset and Replace. Most apps want a handful of these; this is the ceiling.
 */
export const Everything: Story = {
  parameters: showcase('features'),
  args: {
    features: {zoom: {slider: true}, straighten: true, adjust: true, history: true, replace: true},
  },
  play: async ({canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const ui = within(dialog);
    await expect(ui.getByRole('slider', {name: 'Straighten'})).toBeInTheDocument();
    await expect(ui.getByRole('slider', {name: 'Zoom'})).toBeInTheDocument();
    await expect(ui.getByRole('button', {name: 'Replace image'})).toBeInTheDocument();
    const reset = ui.getByRole('button', {name: 'Reset'});
    await expect(reset).toBeDisabled();

    await userEvent.click(ui.getByRole('tab', {name: 'Adjust'}));
    await userEvent.click(await ui.findByRole('button', {name: 'Vivid'}));
    await expect(ui.getByRole('button', {name: 'Vivid'})).toHaveAttribute('aria-pressed', 'true');
    await expect(ui.getByRole('button', {name: 'Undo'})).toBeEnabled();

    await userEvent.click(reset);
    await expect(ui.getByRole('button', {name: 'Original'})).toHaveAttribute('aria-pressed', 'true');
    await expect(reset).toBeDisabled();
  },
};

/**
 * Ratios come from `features.crop.ratios`, the first one is where the crop starts. Here the
 * picture is flipped, zoomed and the crop pushed into a corner with the keyboard; the file
 * holds exactly the corner the user sees, which after the flip is the green one.
 */
export const CropRatios: Story = {
  parameters: showcase('features'),
  args: {
    features: {crop: {ratios: ['1:1', '4:3', '16:9', 'free']}},
    output: {type: 'image/png'},
  },
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const ui = within(dialog);
    await expect(ui.getByRole('button', {name: '1:1'})).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(ui.getByRole('button', {name: 'Flip horizontally'}));
    ui.getByRole('group', {name: 'Image crop area'}).focus();
    // Nine steps of 10% takes the square to about 340 px, well inside one 600 × 400 quadrant.
    await userEvent.keyboard('+++++++++');
    await userEvent.keyboard('{ArrowLeft>60/}{ArrowUp>60/}');

    const result = await applyEdits(dialog, args.onApply);
    await expect(result.width).toBe(result.height);
    await expect(result.width).toBeLessThan(400);
    await expect(await pixelAt(result.file, result.width / 2, result.height / 2)).toEqual(
      rgba(QUADRANT_COLOURS.topRight),
    );
  },
};

/**
 * Fine rotation for a crooked horizon, within ±`range` degrees. The crop stays inside the
 * turned picture, so the file never has empty corners.
 */
export const Straighten: Story = {
  parameters: showcase('features'),
  args: {features: {straighten: {range: 30}}, output: {type: 'image/png'}},
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const slider = within(dialog).getByRole('slider', {name: 'Straighten'});
    await expect(slider).toHaveAttribute('aria-valuemin', '-30');
    slider.focus();
    await userEvent.keyboard('{ArrowRight>8/}');
    await expect(slider).toHaveAttribute('aria-valuenow', '4');
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Straightened 4°'));

    const result = await applyEdits(dialog, args.onApply);
    for (const [x, y] of [
      [0, 0],
      [result.width - 1, 0],
      [0, result.height - 1],
      [result.width - 1, result.height - 1],
    ] as const) {
      const [, , , alpha] = await pixelAt(result.file, x, y);
      await expect(alpha).toBe(255);
    }
  },
};

/**
 * Brightness, contrast and saturation, one slider at a time, plus five presets. The preview is
 * a CSS filter and the export uses the same filter string, so the file matches the screen.
 */
export const Adjust: Story = {
  parameters: showcase('features'),
  args: {features: {adjust: true}, output: {type: 'image/png'}},
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const ui = within(dialog);
    await userEvent.click(ui.getByRole('tab', {name: 'Adjust'}));
    await userEvent.click(await ui.findByRole('button', {name: 'Mono'}));
    await expect(ui.getByRole('button', {name: /^Saturation/})).toHaveTextContent('-100');

    const result = await applyEdits(dialog, args.onApply);
    const [r = 0, g = 0, b = 0] = await pixelAt(result.file, 300, 200);
    // The red quadrant, drained of colour.
    await expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
    await expect([r, g, b]).not.toEqual(rgba(QUADRANT_COLOURS.topLeft).slice(0, 3));
  },
};

/**
 * Undo and redo as buttons and as Ctrl/Cmd + Z. The canvas takes keys only while it has
 * focus, so typing elsewhere on the page never rotates the picture.
 */
export const History: Story = {
  parameters: showcase('features'),
  args: {features: {history: true}},
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const ui = within(dialog);
    const status = ui.getByRole('status');
    const undo = ui.getByRole('button', {name: 'Undo'});

    await userEvent.keyboard('r');
    await expect(status).toBeEmptyDOMElement();
    await expect(undo).toBeDisabled();

    ui.getByRole('group', {name: 'Image crop area'}).focus();
    await userEvent.keyboard('r');
    await expect(status).toHaveTextContent('Rotated 90°');
    await userEvent.click(undo);
    await expect(status).toHaveTextContent('Undone');
    await userEvent.click(ui.getByRole('button', {name: 'Redo'}));
    await expect(status).toHaveTextContent('Redone');

    // A quarter turn swaps the sides.
    const result = await applyEdits(dialog, args.onApply);
    await expect(result).toEqual(expect.objectContaining({width: 800, height: 1200}));
  },
};

/**
 * `source={null}` opens on a drop zone. With `features.replace` the user can swap the picture
 * later; the new one starts with a clean history.
 */
export const PickerAndReplace: Story = {
  parameters: showcase('source', 'features', 'input'),
  args: {features: {replace: true}},
  render: (args) => <EditPhoto {...args} picker />,
  play: async ({args, canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: 'Edit photo'}));
    const dialog = await screen.findByRole('dialog', {name: 'Edit image'});
    const ui = within(dialog);
    await waitFor(() => expect(ui.getByText('Drop an image here')).toBeVisible());

    await userEvent.upload(ui.getByLabelText('Choose image'), await urlToFile(quadrantsUrl(), 'wide.png'));
    await ui.findByTestId('image-editor-stage');
    await userEvent.upload(ui.getByLabelText('Replace image'), await urlToFile(quadrantsUrl(600, 600), 'square.png'));
    await waitFor(() => expect(ui.getByTestId('image-editor-stage').querySelector('cropper-selection')).not.toBeNull());

    const result = await applyEdits(dialog, args.onApply);
    await expect(result).toEqual(expect.objectContaining({width: 600, height: 600}));
  },
};

/**
 * When `onApply` rejects (the upload failed, say) the editor stays open with every edit in
 * place, shows a message, and Apply can be pressed again.
 */
export const Errors: Story = {
  args: {
    onApply: fn(async () => {
      throw new Error('Upload failed');
    }),
  },
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', {name: 'Rotate right'}));
    await userEvent.click(within(dialog).getByRole('button', {name: 'Apply'}));

    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the image. Try again.');
    await expect(args.onApply).toHaveBeenCalledTimes(1);
    await expect(screen.getByRole('dialog', {name: 'Edit image'})).toBeVisible();
    await expect(within(dialog).getByRole('button', {name: 'Apply'})).toBeEnabled();
    await expect(within(dialog).getByRole('button', {name: 'Reset'})).toBeEnabled();
  },
};

/**
 * Upload rules. Random pixels barely compress, and the file still fits `maxBytes`: the editor
 * lowers the quality, then the size, until it does.
 */
export const UploadRules: Story = {
  parameters: showcase('output'),
  args: {source: noiseUrl(), output: {type: 'image/jpeg', maxBytes: 80_000}},
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const result = await applyEdits(dialog, args.onApply);
    await expect(result.type).toBe('image/jpeg');
    await expect(result.file.size).toBeLessThanOrEqual(80_000);
  },
};

/**
 * Every word on screen and in the announcements comes from `labels`. Pass the ones you want
 * to change; the rest stay English.
 */
export const CustomLabels: Story = {
  parameters: showcase('labels'),
  args: {
    labels: {
      title: 'Recadrer la photo',
      apply: 'Appliquer',
      cancel: 'Annuler',
      ratio: 'Format',
      rotateLeft: 'Pivoter à gauche',
      rotateRight: 'Pivoter à droite',
      rotated: (degrees) => `Pivoté de ${degrees}°`,
    },
  },
  play: async ({canvasElement}) => {
    const dialog = await openEditor(canvasElement, 'Recadrer la photo');
    const ui = within(dialog);
    await expect(ui.getByRole('group', {name: 'Format'})).toBeInTheDocument();
    await userEvent.click(ui.getByRole('button', {name: 'Pivoter à droite'}));
    await expect(ui.getByRole('status')).toHaveTextContent('Pivoté de 90°');
    await userEvent.click(ui.getByRole('button', {name: 'Annuler'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  },
};

// The phone layout is chosen by the theme's `sm` breakpoint. Raising it past any screen puts
// the test run, whatever its window, on the same layout a phone gets.
const phoneTheme = (outer: Theme): Theme => ({
  ...outer,
  breakpoints: createTheme({breakpoints: {values: {xs: 0, sm: 100_000, md: 100_001, lg: 100_002, xl: 100_003}}})
    .breakpoints,
});

/**
 * Below `sm` the editor fills the screen: Cancel, the title and Done across the top, a
 * floating pill over the picture, and the tools at the bottom.
 */
export const Mobile: Story = {
  parameters: {...showcase('features'), layout: 'fullscreen'},
  globals: {viewport: {value: 'iphone14', isRotated: false}},
  args: {features: {history: true}},
  decorators: [
    (Story) => (
      <ThemeProvider theme={phoneTheme}>
        <Box sx={{p: 2}}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
  play: async ({args, canvasElement}) => {
    const dialog = await openEditor(canvasElement);
    const toolbar = within(dialog).getByRole('toolbar', {name: 'Image tools'});
    await userEvent.click(within(toolbar).getByRole('button', {name: 'Rotate right'}));
    await expect(within(toolbar).getByRole('button', {name: 'Undo'})).toBeEnabled();

    const result = await applyEdits(dialog, args.onApply, 'Done');
    await expect(result).toEqual(expect.objectContaining({width: 800, height: 1200}));
  },
};

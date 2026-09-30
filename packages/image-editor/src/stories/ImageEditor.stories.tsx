import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {expect, fn, screen, userEvent, waitFor, within} from 'storybook/test';

import {ImageEditor, type ImageEditorProps, type ImageEditorResult} from '../index';
import {quadrantsUrl} from './fixtures';

/**
 * The editor hangs off the button that would open it in an app. `open` and `source`
 * belong to the caller, so the demo owns them and passes the rest through.
 */
function EditPhoto({source, onApply, onClose, ...props}: Readonly<ImageEditorProps>) {
  const [open, setOpen] = useState(false);
  const [fixture] = useState(() => source ?? quadrantsUrl());
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

/** The defaults: crop with four ratios, zoom, rotate and flip. Apply returns the cropped file. */
export const Basic: Story = {
  play: async ({args, canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: 'Edit photo'}));
    const dialog = await screen.findByRole('dialog', {name: 'Edit image'});
    const apply = await within(dialog).findByRole('button', {name: 'Apply'});
    const stage = await within(dialog).findByTestId('image-editor-stage');
    await waitFor(() => expect(stage.querySelector('cropper-selection')).not.toBeNull());
    await userEvent.click(apply);

    // The first ratio is free, so the untouched crop is the whole 1200 × 800 picture.
    await waitFor(() =>
      expect(args.onApply).toHaveBeenCalledWith(expect.objectContaining({type: 'image/png', width: 1200, height: 800})),
    );
    await expect(args.onApply).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(await within(canvasElement).findByRole('img', {name: 'Edited photo'})).toBeVisible();
  },
};

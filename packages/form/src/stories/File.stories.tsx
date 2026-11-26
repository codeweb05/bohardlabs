import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, fn, userEvent, within} from 'storybook/test';

import {FileField} from '../fields/FileField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/File',
  component: FileField,
  tags: ['autodocs'],
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <FileField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof FileField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A small PNG drawn on a canvas, so the preview shows a real image. */
async function storefront(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'steelblue';
    context.fillRect(0, 0, 360, 360);
    context.fillStyle = 'white';
    context.fillRect(60, 140, 240, 160);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob ?? new Blob()], 'storefront.png', {type: 'image/png'});
}

/**
 * Choose a file or drop one on the dashed area. A file that is too big or of the wrong type is
 * refused with a message and never reaches the value. The hint under the field is the
 * consumer's own `description`.
 */
export const Certificate: Story = {
  args: {
    label: 'Insurance certificate',
    description: 'PDF or PNG, up to 5 MB',
    accept: '.pdf,image/png',
    maxBytes: 5_000_000,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Insurance certificate');

    await userEvent.upload(input, new File([new Uint8Array(6_000_000)], 'scan.png', {type: 'image/png'}));
    await expect(canvas.getByText('“scan.png” is 6 MB. The limit is 5 MB.')).toBeVisible();

    await userEvent.upload(input, new File(['%PDF-1.4'], 'certificate-2026.pdf', {type: 'application/pdf'}));
    await expect(canvas.getByText('certificate-2026.pdf')).toBeVisible();
    await expect(canvas.getByText('PDF or PNG, up to 5 MB')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', {name: 'Remove certificate-2026.pdf'}));
    await expect(canvas.getByRole('button', {name: 'Choose file'})).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('null');
  },
};

/**
 * The photo variant previews the image. `onEdit` adds an Edit button: it receives the current
 * file and resolves the edited one, or `null` to keep it. Here it only renames the file; in an
 * app it opens `@vt-labs/image-editor` (see the README).
 */
export const Photo: Story = {
  args: {
    label: 'Store photo',
    variant: 'photo',
    accept: 'image/*',
    maxBytes: 5_000_000,
    onEdit: fn(async (file: File) => new File([file], 'storefront-edited.png', {type: file.type})),
  },
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);

    await userEvent.upload(canvas.getByLabelText('Store photo'), await storefront());
    await expect(await canvas.findByRole('img', {name: 'storefront.png'})).toBeVisible();

    await userEvent.click(canvas.getByRole('button', {name: 'Edit photo'}));
    await expect(args.onEdit).toHaveBeenCalled();
    await expect(await canvas.findByRole('img', {name: 'storefront-edited.png'})).toBeVisible();

    await userEvent.click(canvas.getByRole('button', {name: 'Remove photo'}));
    await expect(canvas.getByRole('button', {name: 'Add photo'})).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('null');
  },
};

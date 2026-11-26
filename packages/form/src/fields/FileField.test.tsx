import type {AnyFormApi} from '@tanstack/react-form';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';
import type {Mock} from 'vitest';

import {FormConfigProvider} from '../config/FormConfigContext.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {FileField} from './FileField.js';
import type {FileFieldProps} from './FileField.js';

/** A file that reports `bytes` as its size without holding that many. */
function fileOf(name: string, type: string, bytes = 1_200_000) {
  const file = new File(['x'], name, {type});
  Object.defineProperty(file, 'size', {value: bytes});
  return file;
}

function setup(props: Partial<FileFieldProps> = {}, defaultValue: unknown = null) {
  const user = userEvent.setup();
  const formRef = createRef<AnyFormApi>();
  const onSubmit = vi.fn();
  render(
    <FieldHarness defaultValue={defaultValue} formRef={formRef} onSubmit={onSubmit}>
      <FileField label="Certificate" {...props} />
    </FieldHarness>,
  );
  return {user, formRef, onSubmit, input: screen.getByLabelText('Certificate')};
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: 'Submit'}));
}

let createUrl: Mock<(file: Blob) => string>;
let revokeUrl: Mock<(url: string) => void>;

beforeEach(() => {
  let count = 0;
  createUrl = vi.fn<(file: Blob) => string>(() => `blob:preview-${++count}`);
  revokeUrl = vi.fn<(url: string) => void>();
  // jsdom has neither.
  Object.defineProperty(URL, 'createObjectURL', {configurable: true, writable: true, value: createUrl});
  Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, writable: true, value: revokeUrl});
});

describe('FileField', () => {
  it('keeps a chosen file and shows its name and size', async () => {
    const {user, input, onSubmit} = setup();
    const file = fileOf('certificate.pdf', 'application/pdf');
    await user.upload(input, file);

    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.2 MB')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Choose file'})).not.toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(file);
  });

  it('keeps a dropped file', async () => {
    const {user, onSubmit} = setup();
    const file = fileOf('certificate.pdf', 'application/pdf');
    fireEvent.drop(screen.getByRole('button', {name: 'Choose file'}), {dataTransfer: {files: [file]}});

    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(file);
  });

  it('refuses a file over maxBytes and keeps it out of the value', async () => {
    const {user, input, onSubmit} = setup({maxBytes: 5_000_000});
    await user.upload(input, fileOf('scan.tiff', 'image/tiff', 18_000_000));

    expect(screen.getByText('“scan.tiff” is 18 MB. The limit is 5 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Choose file'})).toHaveAttribute('aria-invalid', 'true');
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  it('refuses a dropped file that accept does not allow', () => {
    setup({accept: '.pdf,image/png'});
    fireEvent.drop(screen.getByRole('button', {name: 'Choose file'}), {
      dataTransfer: {files: [fileOf('photo.gif', 'image/gif')]},
    });

    expect(screen.getByText('“photo.gif” is not a file type this field accepts.')).toBeInTheDocument();
    expect(screen.queryByText('photo.gif')).not.toBeInTheDocument();
  });

  it('matches accept by extension, exact type and wildcard', () => {
    setup({accept: '.pdf, image/*', multiple: true});
    fireEvent.drop(screen.getByRole('button', {name: 'Choose file'}), {
      dataTransfer: {files: [fileOf('a.PDF', ''), fileOf('b.png', 'image/png'), fileOf('c.txt', 'text/plain')]},
    });

    expect(screen.getByText('a.PDF')).toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
    expect(screen.getByText('“c.txt” is not a file type this field accepts.')).toBeInTheDocument();
  });

  it('removes the file and offers the button again', async () => {
    const {user, onSubmit} = setup({}, fileOf('certificate.pdf', 'application/pdf'));
    await user.click(screen.getByRole('button', {name: 'Remove certificate.pdf'}));

    expect(screen.getByRole('button', {name: 'Choose file'})).toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  it('replaces the file with the next one chosen', async () => {
    const {user, input, onSubmit} = setup({}, fileOf('old.pdf', 'application/pdf'));
    expect(screen.getByRole('button', {name: 'Replace'})).toBeInTheDocument();
    const next = fileOf('new.pdf', 'application/pdf');
    await user.upload(input, next);

    expect(screen.queryByText('old.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('new.pdf')).toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(next);
  });

  it('keeps the current file when its replacement is refused', async () => {
    const current = fileOf('old.pdf', 'application/pdf', 1000);
    const {user, input, onSubmit} = setup({maxBytes: 2000}, current);
    await user.upload(input, fileOf('huge.pdf', 'application/pdf', 3000));

    expect(screen.getByText('old.pdf')).toBeInTheDocument();
    expect(screen.getByText('“huge.pdf” is 3 KB. The limit is 2 KB.')).toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(current);
  });

  it('adds to a File[] with multiple and removes one at a time', async () => {
    const {user, input, onSubmit} = setup({multiple: true});
    const [a, b, c] = [fileOf('a.pdf', 'application/pdf'), fileOf('b.pdf', 'application/pdf'), fileOf('c.pdf', '')];
    await user.upload(input, [a, b]);
    await user.upload(input, c);
    await user.click(screen.getByRole('button', {name: 'Remove b.pdf'}));

    expect(screen.getByRole('button', {name: 'Choose file'})).toBeInTheDocument();
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith([a, c]);
  });

  it('clears a refusal when the form resets', async () => {
    const {user, input, formRef} = setup({maxBytes: 10});
    await user.upload(input, fileOf('big.pdf', 'application/pdf', 100));
    expect(screen.getByText('“big.pdf” is 100 B. The limit is 10 B.')).toBeInTheDocument();

    act(() => formRef.current?.reset());
    expect(screen.queryByText('“big.pdf” is 100 B. The limit is 10 B.')).not.toBeInTheDocument();
  });

  it('warns once in development when the value is not a File', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup({}, 'certificate.pdf');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a File, an array of Files or null'));
  });

  describe('photo variant', () => {
    it('previews the chosen photo and revokes its URL on remove', async () => {
      const {user, input, onSubmit} = setup({variant: 'photo'});
      await user.upload(input, fileOf('storefront.jpg', 'image/jpeg', 840_000));

      expect(screen.getByRole('img', {name: 'storefront.jpg'})).toHaveAttribute('src', 'blob:preview-1');
      expect(screen.getByText('storefront.jpg · 840 KB')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Edit photo'})).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', {name: 'Remove photo'}));
      expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
      expect(screen.getByRole('button', {name: 'Add photo'})).toBeInTheDocument();
      await submit(user);
      expect(onSubmit).toHaveBeenCalledWith(null);
    });

    it('takes images only unless accept says otherwise', () => {
      setup({variant: 'photo'});
      fireEvent.drop(screen.getByRole('button', {name: 'Add photo'}), {
        dataTransfer: {files: [fileOf('notes.pdf', 'application/pdf')]},
      });
      expect(screen.getByText('“notes.pdf” is not a file type this field accepts.')).toBeInTheDocument();
    });

    it('swaps in the file onEdit resolves', async () => {
      const original = fileOf('storefront.jpg', 'image/jpeg');
      const edited = fileOf('storefront-cropped.jpg', 'image/jpeg');
      const onEdit = vi.fn(async () => edited);
      const {user, onSubmit} = setup({variant: 'photo', onEdit}, original);

      await user.click(screen.getByRole('button', {name: 'Edit photo'}));
      expect(onEdit).toHaveBeenCalledWith(original);
      expect(await screen.findByRole('img', {name: 'storefront-cropped.jpg'})).toBeInTheDocument();
      expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
      await submit(user);
      expect(onSubmit).toHaveBeenCalledWith(edited);
    });

    it('keeps the original when onEdit resolves null', async () => {
      const original = fileOf('storefront.jpg', 'image/jpeg');
      const onEdit = vi.fn(async () => null);
      const {user, onSubmit} = setup({variant: 'photo', onEdit}, original);

      await user.click(screen.getByRole('button', {name: 'Edit photo'}));
      expect(onEdit).toHaveBeenCalledWith(original);
      await submit(user);
      expect(onSubmit).toHaveBeenCalledWith(original);
      expect(screen.getByRole('img', {name: 'storefront.jpg'})).toBeInTheDocument();
    });
  });

  describe('size', () => {
    it("is MUI's default with no size anywhere", () => {
      setup();
      expect(screen.getByRole('button', {name: 'Choose file'})).not.toHaveClass('MuiButton-sizeSmall');
    });

    it('takes small from the field', () => {
      setup({size: 'small'});
      expect(screen.getByRole('button', {name: 'Choose file'})).toHaveClass('MuiButton-sizeSmall');
    });

    it('takes small from the provider', () => {
      render(
        <FormConfigProvider size="small">
          <FieldHarness defaultValue={fileOf('a.pdf', 'application/pdf')}>
            <FileField label="Certificate" />
          </FieldHarness>
        </FormConfigProvider>,
      );
      expect(screen.getByRole('button', {name: 'Replace'})).toHaveClass('MuiButton-sizeSmall');
    });
  });
});

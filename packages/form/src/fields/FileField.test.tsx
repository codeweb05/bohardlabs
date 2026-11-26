import {createTheme} from '@mui/material/styles';
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

  it('shows a size of a gigabyte or more in GB', () => {
    setup({}, fileOf('backup.zip', 'application/zip', 2_500_000_000));
    expect(screen.getByText('2.5 GB')).toBeInTheDocument();
  });

  describe('drop zone', () => {
    const {palette} = createTheme();
    const zoneOf = (button: HTMLElement) => {
      const zone = button.parentElement;
      if (!zone) throw new Error('Expected the button to sit inside the drop zone');
      return zone;
    };
    /** A dragleave whose pointer moves onto `into`. Built by hand so `relatedTarget` survives. */
    const leave = (from: HTMLElement, into: Element | null) =>
      fireEvent(from, new MouseEvent('dragleave', {bubbles: true, relatedTarget: into}));

    it('highlights while a file is dragged over it and accepts the drop', () => {
      setup();
      const button = screen.getByRole('button', {name: 'Choose file'});
      expect(zoneOf(button)).toHaveStyle({borderColor: palette.text.disabled});

      // fireEvent returns false when the handler called preventDefault, which is what lets a drop land.
      expect(fireEvent.dragOver(button)).toBe(false);
      expect(zoneOf(button)).toHaveStyle({borderColor: palette.primary.main});
    });

    it('stays highlighted when the drag moves onto a child, and clears when it leaves', () => {
      setup();
      const button = screen.getByRole('button', {name: 'Choose file'});
      const zone = zoneOf(button);
      fireEvent.dragOver(button);

      leave(zone, button);
      expect(zone).toHaveStyle({borderColor: palette.primary.main});

      leave(zone, document.body);
      expect(zone).toHaveStyle({borderColor: palette.text.disabled});
    });

    it('neither highlights nor takes a drop while disabled', async () => {
      const {user, onSubmit} = setup({disabled: true});
      const zone = zoneOf(screen.getByRole('button', {name: 'Choose file'}));

      expect(fireEvent.dragOver(zone)).toBe(true);
      expect(zone).toHaveStyle({borderColor: palette.text.disabled});
      expect(fireEvent.drop(zone, {dataTransfer: {files: [fileOf('a.pdf', 'application/pdf')]}})).toBe(true);
      expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
      await submit(user);
      expect(onSubmit).toHaveBeenCalledWith(null);
    });

    it('ignores a drop that carries no file, such as dragged text', () => {
      setup();
      const button = screen.getByRole('button', {name: 'Choose file'});
      fireEvent.drop(button, {dataTransfer: {files: []}});
      expect(button).toHaveAttribute('aria-invalid', 'false');
    });

    it('highlights the current file, which a drop would replace', () => {
      setup({}, fileOf('old.pdf', 'application/pdf'));
      const row = zoneOf(screen.getByRole('button', {name: 'Replace'}));
      expect(row).toHaveStyle({borderColor: palette.divider});
      fireEvent.dragOver(row);
      expect(row).toHaveStyle({borderColor: palette.primary.main});
    });

    it('highlights only the drop zone in a list, since a drop adds rather than replaces', () => {
      setup({multiple: true}, [fileOf('a.pdf', 'application/pdf')]);
      const row = zoneOf(screen.getByRole('button', {name: 'Remove a.pdf'}));
      const zone = zoneOf(screen.getByRole('button', {name: 'Choose file'}));
      fireEvent.dragOver(zone);
      expect(zone).toHaveStyle({borderColor: palette.primary.main});
      expect(row).toHaveStyle({borderColor: palette.divider});
    });

    it('outlines the photo while a replacement is dragged over it', () => {
      setup({variant: 'photo'}, fileOf('storefront.jpg', 'image/jpeg'));
      const frame = screen.getByRole('img', {name: 'storefront.jpg'}).parentElement;
      if (!frame) throw new Error('Expected the photo inside its frame');
      const highlight = {outline: `2px solid ${palette.primary.main}`};
      expect(frame).not.toHaveStyle(highlight);
      fireEvent.dragOver(frame);
      expect(frame).toHaveStyle(highlight);
    });
  });

  it('ignores an empty entry in accept, such as a trailing comma', () => {
    setup({accept: '.pdf,'});
    fireEvent.drop(screen.getByRole('button', {name: 'Choose file'}), {
      dataTransfer: {files: [fileOf('notes.txt', 'text/plain')]},
    });
    expect(screen.getByText('“notes.txt” is not a file type this field accepts.')).toBeInTheDocument();
  });

  it.each([
    ['Choose file', {}, null],
    ['Replace', {}, fileOf('old.pdf', 'application/pdf')],
    ['Add photo', {variant: 'photo'}, null],
    ['Replace photo', {variant: 'photo'}, fileOf('storefront.jpg', 'image/jpeg')],
  ] as const)('opens the file picker from "%s"', async (name, props, value) => {
    const {user, input} = setup(props, value);
    const opened = vi.fn();
    input.addEventListener('click', opened);
    await user.click(screen.getByRole('button', {name}));
    expect(opened).toHaveBeenCalledTimes(1);
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

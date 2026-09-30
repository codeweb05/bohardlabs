import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {EditorError} from '../errors';
import type {LoadedImage} from '../input/loadSource';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels';
import type {ImageEditorProps, ImageEditorResult} from '../types';
import {ImageEditor} from './ImageEditor';

const loadSource = vi.hoisted(() => vi.fn());
const exportImage = vi.hoisted(() => vi.fn());

vi.mock(import('../input/loadSource'), async (original) => ({
  ...(await original()),
  loadSource,
}));
vi.mock('../output/exportImage', () => ({exportImage}));
vi.mock('../engine/CropperView', () => ({CropperView: () => null}));

function loaded(overrides: Partial<LoadedImage> = {}): LoadedImage {
  return {
    url: 'blob:working',
    image: {} as CanvasImageSource,
    width: 800,
    height: 600,
    type: 'image/jpeg',
    revoke: vi.fn(),
    ...overrides,
  };
}

const result: ImageEditorResult = {
  file: new File(['x'], 'image.jpg', {type: 'image/jpeg'}),
  width: 800,
  height: 600,
  type: 'image/jpeg',
};

function setup(props: Partial<ImageEditorProps> = {}) {
  const all: ImageEditorProps = {
    open: true,
    source: new Blob(['x'], {type: 'image/jpeg'}),
    onClose: vi.fn(),
    onApply: vi.fn(),
    onError: vi.fn(),
    ...props,
  };
  const view = render(<ImageEditor {...all} />);
  return {...view, props: all, user: userEvent.setup()};
}

beforeEach(() => {
  loadSource.mockReset();
  exportImage.mockReset();
  loadSource.mockResolvedValue(loaded());
  exportImage.mockResolvedValue(result);
});

describe('ImageEditor', () => {
  it('renders nothing while closed', () => {
    setup({open: false});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('shows the picker, filtered by accept, when there is no source', () => {
    setup({source: null, input: {accept: ['image/png']}});
    expect(screen.getByText(L.pickerPrompt)).toBeInTheDocument();
    expect(screen.getByLabelText(L.pickerChoose)).toHaveAttribute('accept', 'image/png');
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('loads a picked file', async () => {
    const {user} = setup({source: null});
    const file = new File(['x'], 'photo.png', {type: 'image/png'});
    await user.upload(screen.getByLabelText(L.pickerChoose), file);
    await waitFor(() => expect(loadSource).toHaveBeenCalledWith(file, {}));
    expect(await screen.findByRole('button', {name: L.apply})).toBeEnabled();
  });

  it('shows a load error and reports it once', async () => {
    loadSource.mockRejectedValue(new EditorError('too-small'));
    const {props} = setup();
    expect(await screen.findByText(L.errorTooSmall)).toBeInTheDocument();
    expect(props.onError).toHaveBeenCalledTimes(1);
    expect(props.onError).toHaveBeenCalledWith({code: 'too-small'});
    expect(screen.queryByRole('button', {name: L.apply})).not.toBeInTheDocument();
  });

  it('offers the picker again after a picked file fails', async () => {
    loadSource.mockRejectedValue(new EditorError('unsupported-type'));
    const {user} = setup({source: null});
    await user.upload(screen.getByLabelText(L.pickerChoose), new File(['x'], 'a.jpg', {type: 'image/jpeg'}));
    expect(await screen.findByText(L.errorUnsupportedType)).toBeInTheDocument();
    expect(screen.getByLabelText(L.pickerChoose)).toBeInTheDocument();
  });

  it('hands the exported file to onApply', async () => {
    const {user, props} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    await waitFor(() => expect(props.onApply).toHaveBeenCalledWith(result));
    expect(exportImage).toHaveBeenCalledWith(expect.objectContaining({shape: 'rect', sourceType: 'image/jpeg'}));
  });

  it('exports once when Apply is pressed twice', async () => {
    let finish: () => void = () => undefined;
    const onApply = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const {user} = setup({onApply});
    const apply = await screen.findByRole('button', {name: L.apply});
    await user.dblClick(apply);
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', {name: L.applying})).toBeDisabled();
    finish();
    expect(await screen.findByRole('button', {name: L.apply})).toBeEnabled();
    expect(exportImage).toHaveBeenCalledTimes(1);
  });

  it('stays open and says so when onApply rejects, without calling onError', async () => {
    const {user, props} = setup({onApply: vi.fn().mockRejectedValue(new Error('network'))});
    await user.click(await screen.findByRole('button', {name: L.apply}));
    expect(await screen.findByText(L.applyFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.apply})).toBeEnabled();
    expect(props.onError).not.toHaveBeenCalled();
  });

  it('reports an output that cannot fit', async () => {
    exportImage.mockRejectedValue(new EditorError('output-too-large'));
    const {user, props} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    expect(await screen.findByText(L.errorOutputTooLarge)).toBeInTheDocument();
    expect(props.onError).toHaveBeenCalledWith({code: 'output-too-large'});
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('calls onClose from Cancel and from Escape', async () => {
    const {user, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    await user.click(screen.getByRole('button', {name: L.cancel}));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('takes a label override for one string and keeps the rest', async () => {
    setup({labels: {apply: 'Save photo'}});
    expect(await screen.findByRole('button', {name: 'Save photo'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.cancel})).toBeInTheDocument();
  });

  it('revokes the working URL on close', async () => {
    const image = loaded();
    loadSource.mockResolvedValue(image);
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    rerender(<ImageEditor {...props} open={false} />);
    expect(image.revoke).toHaveBeenCalledTimes(1);
  });

  it('loads a new source and revokes the old one', async () => {
    const first = loaded({url: 'blob:first'});
    const second = loaded({url: 'blob:second'});
    loadSource.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    const next = new Blob(['y'], {type: 'image/png'});
    rerender(<ImageEditor {...props} source={next} />);
    await waitFor(() => expect(loadSource).toHaveBeenLastCalledWith(next, {}));
    expect(first.revoke).toHaveBeenCalledTimes(1);
    expect(second.revoke).not.toHaveBeenCalled();
  });
});

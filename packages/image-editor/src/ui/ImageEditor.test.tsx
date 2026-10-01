import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {EditorError} from '../errors.js';
import type {LoadedImage} from '../input/loadSource.js';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import type {ImageEditorProps, ImageEditorResult} from '../types.js';
import {ImageEditor} from './ImageEditor.js';

const loadSource = vi.hoisted(() => vi.fn());
const exportImage = vi.hoisted(() => vi.fn());

vi.mock(import('../input/loadSource.js'), async (original) => ({
  ...(await original()),
  loadSource,
}));
vi.mock('../output/exportImage.js', () => ({exportImage}));
vi.mock('../engine/CropperView.js', () => ({CropperView: () => null}));

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

// A promise settled by the test, for a load or an export that is still running.
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {promise, resolve, reject};
}

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

  it('shows a load error without the picker when replacing is off', async () => {
    loadSource.mockRejectedValue(new EditorError('load-failed'));
    setup({features: {replace: false}});
    expect(await screen.findByRole('alert')).toHaveTextContent(L.errorLoadFailed);
    expect(screen.queryByLabelText(L.pickerChoose)).not.toBeInTheDocument();
  });

  it('still shows the load error when onError throws', async () => {
    loadSource.mockRejectedValue(new EditorError('too-large'));
    const onError = vi.fn(() => {
      throw new Error('consumer bug');
    });
    setup({onError});
    expect(await screen.findByText(L.errorTooLarge)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('drops a load that finishes after the source has changed', async () => {
    const slow = deferred<LoadedImage>();
    const stale = loaded({url: 'blob:stale'});
    loadSource.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(loaded({type: 'image/png'}));
    const {rerender, props, user} = setup();
    rerender(<ImageEditor {...props} source={new Blob(['y'], {type: 'image/png'})} />);
    const apply = await screen.findByRole('button', {name: L.apply});
    await act(async () => slow.resolve(stale));
    expect(stale.revoke).toHaveBeenCalledTimes(1);
    await user.click(apply);
    expect(exportImage).toHaveBeenCalledWith(expect.objectContaining({sourceType: 'image/png'}));
  });

  it('does not report a load that fails after the source has changed', async () => {
    const slow = deferred<LoadedImage>();
    loadSource.mockReturnValueOnce(slow.promise);
    const {rerender, props} = setup();
    rerender(<ImageEditor {...props} source={new Blob(['y'], {type: 'image/png'})} />);
    await screen.findByRole('button', {name: L.apply});
    await act(async () => slow.reject(new EditorError('load-failed')));
    expect(props.onError).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.apply})).toBeEnabled();
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

  it('exports once when Apply is clicked twice before the first click has rendered', async () => {
    const {props} = setup();
    const apply = await screen.findByRole('button', {name: L.apply});
    act(() => {
      apply.click();
      apply.click();
    });
    await waitFor(() => expect(props.onApply).toHaveBeenCalledTimes(1));
    expect(exportImage).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', {name: L.apply})).toBeEnabled();
  });

  it('says the apply failed when the export breaks for a reason it has no message for', async () => {
    exportImage.mockRejectedValue(new Error('Encode failed'));
    const {user, props} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    expect(await screen.findByText(L.applyFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.apply})).toBeEnabled();
    expect(props.onError).not.toHaveBeenCalled();
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('hands nothing over when the editor is gone before the export finishes', async () => {
    const pending = deferred<ImageEditorResult>();
    exportImage.mockReturnValue(pending.promise);
    const {user, props, unmount} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    unmount();
    await act(async () => pending.resolve(result));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('hands nothing over when the editor is closed before the export finishes', async () => {
    const pending = deferred<ImageEditorResult>();
    exportImage.mockReturnValue(pending.promise);
    const {user, props, rerender} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    // Cancelled mid-export: the dialog is still fading out, and still mounted.
    rerender(<ImageEditor {...props} open={false} />);
    await act(async () => pending.resolve(result));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('reports no export error once the editor is closed', async () => {
    const pending = deferred<ImageEditorResult>();
    exportImage.mockReturnValue(pending.promise);
    const {user, props, rerender} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    rerender(<ImageEditor {...props} open={false} />);
    await act(async () => pending.reject(new EditorError('output-too-large')));
    expect(props.onError).not.toHaveBeenCalled();
  });

  it('reports nothing when the export breaks after the editor is gone', async () => {
    const pending = deferred<ImageEditorResult>();
    exportImage.mockReturnValue(pending.promise);
    const {user, props, unmount} = setup();
    await user.click(await screen.findByRole('button', {name: L.apply}));
    unmount();
    await act(async () => pending.reject(new Error('Encode failed')));
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onError).not.toHaveBeenCalled();
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

  it('keeps the default for a label passed as undefined', async () => {
    setup({labels: {apply: undefined, cancel: 'Back'}});
    expect(await screen.findByRole('button', {name: L.apply})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Back'})).toBeInTheDocument();
  });

  it('loads a source again when it comes back after being cleared', async () => {
    const first = loaded({url: 'blob:first'});
    const second = deferred<LoadedImage>();
    loadSource.mockResolvedValueOnce(first).mockReturnValueOnce(second.promise);
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    rerender(<ImageEditor {...props} source={null} />);
    await waitFor(() => expect(first.revoke).toHaveBeenCalledTimes(1));
    rerender(<ImageEditor {...props} />);
    // The first working copy is revoked, so the editor waits for the new one.
    expect(screen.queryByRole('button', {name: L.apply})).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', {name: L.loading})).toBeInTheDocument();
    await act(async () => second.resolve(loaded({url: 'blob:second'})));
    expect(await screen.findByRole('button', {name: L.apply})).toBeInTheDocument();
  });

  it('revokes the working URL on close', async () => {
    const image = loaded();
    loadSource.mockResolvedValue(image);
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    rerender(<ImageEditor {...props} open={false} />);
    // The content stays through the fade-out, so the dialog never shows empty.
    expect(screen.getByRole('button', {name: L.apply})).toBeInTheDocument();
    await waitFor(() => expect(image.revoke).toHaveBeenCalledTimes(1));
  });

  it('keeps the image on screen while closing, when the source is cleared with open', async () => {
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    // What `open={file !== null} source={file}` does when the consumer clears the file.
    rerender(<ImageEditor {...props} open={false} source={null} />);
    expect(screen.getByRole('button', {name: L.apply})).toBeInTheDocument();
    expect(screen.queryByText(L.pickerPrompt)).not.toBeInTheDocument();
  });

  it('follows a source that changes while open', async () => {
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    rerender(<ImageEditor {...props} source={null} />);
    expect(await screen.findByText(L.pickerPrompt)).toBeInTheDocument();
  });

  it('starts a fresh session when reopened while fading out', async () => {
    const {rerender, props} = setup();
    await screen.findByRole('button', {name: L.apply});
    rerender(<ImageEditor {...props} open={false} />);
    rerender(<ImageEditor {...props} open />);
    await waitFor(() => expect(loadSource).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', {name: L.apply})).toBeInTheDocument();
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

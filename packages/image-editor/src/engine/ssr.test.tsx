import {renderToString} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';

import {resolveFeatures} from '../features.js';
import {initialEditorState} from '../state/editorState.js';
import {layoutStage} from '../state/geometry.js';
import {ImageEditor} from '../ui/ImageEditor.js';
import {CropperView} from './CropperView.js';
import {loadCropper} from './loadCropper.js';

vi.mock('./loadCropper.js', () => ({loadCropper: vi.fn(async () => undefined)}));

describe('server rendering', () => {
  it('renders the editor open and closed without reaching cropperjs', () => {
    const source = new Blob(['x'], {type: 'image/png'});
    const props = {source, onClose: vi.fn(), onApply: vi.fn()};
    expect(() => renderToString(<ImageEditor open {...props} />)).not.toThrow();
    expect(() => renderToString(<ImageEditor open={false} {...props} />)).not.toThrow();
    expect(loadCropper).not.toHaveBeenCalled();
  });

  it('renders the view as an empty stage', () => {
    const state = initialEditorState({width: 400, height: 300}, resolveFeatures(undefined));
    const stage = {width: 600, height: 400};
    const layout = layoutStage(stage, 24, state.image, state.orientation, state.straighten, state.crop);
    const view = renderToString(
      <CropperView
        src="blob:x"
        state={state}
        stage={stage}
        layout={layout}
        shape="rect"
        filter="none"
        editable
        onAction={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(view).toContain('image-editor-stage');
    expect(view).not.toContain('cropper-canvas');
    expect(loadCropper).not.toHaveBeenCalled();
  });
});

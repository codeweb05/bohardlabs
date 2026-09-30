import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {resolveFeatures} from '../features.js';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import {editorReducer, initialEditorState} from '../state/editorState.js';
import type {ImageEditorFeatures} from '../types.js';
import {CropControls} from './CropControls.js';

function setup(given: ImageEditorFeatures = {}, rotated = false) {
  const features = resolveFeatures(given);
  let state = initialEditorState({width: 800, height: 600}, features);
  if (rotated) state = editorReducer(state, {type: 'rotate', direction: 1});
  const onAction = vi.fn();
  const onCommit = vi.fn();
  const announce = vi.fn();
  render(
    <CropControls
      state={state}
      features={features}
      onAction={onAction}
      onCommit={onCommit}
      announce={announce}
      disabled={false}
    />,
  );
  return {onAction, onCommit, announce, user: userEvent.setup()};
}

describe('CropControls', () => {
  it('shows ratio, rotate, flip and both sliders by default', () => {
    setup();
    expect(screen.getByRole('group', {name: L.ratio})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.rotateLeft})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.flipVertical})).toBeInTheDocument();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('has no sliders when straighten and the zoom slider are off', () => {
    setup({straighten: false, zoom: {slider: false}});
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('hides the ratio control for a circle and for a single ratio', () => {
    setup({crop: {shape: 'circle'}});
    expect(screen.queryByRole('group', {name: L.ratio})).not.toBeInTheDocument();
  });

  it('hides the ratio control when crop is off', () => {
    setup({crop: false});
    expect(screen.queryByRole('group', {name: L.ratio})).not.toBeInTheDocument();
  });

  it('shows only the enabled tools', () => {
    setup({crop: {ratios: ['1:1']}, rotate: false, flip: {vertical: false}});
    expect(screen.queryByRole('group', {name: L.ratio})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: L.rotateLeft})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.flipHorizontal})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: L.flipVertical})).not.toBeInTheDocument();
  });

  it('shows the straighten and zoom sliders when asked', () => {
    setup({straighten: {range: 30}, zoom: {slider: true}});
    expect(screen.getByRole('slider', {name: L.straighten})).toHaveAttribute('aria-valuemin', '-30');
    expect(screen.getByRole('slider', {name: L.zoom})).toBeInTheDocument();
  });

  it('marks the ratio in use, reading a rotated ratio as the same one', () => {
    setup({crop: {ratios: ['4:3', '1:1']}}, true);
    expect(screen.getByRole('button', {name: '4:3'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('dispatches a ratio, a rotation and a flip', async () => {
    const {user, onAction} = setup();
    await user.click(screen.getByRole('button', {name: '16:9'}));
    expect(onAction).toHaveBeenLastCalledWith({type: 'setRatio', ratio: 16 / 9});
    await user.click(screen.getByRole('button', {name: L.rotateRight}));
    expect(onAction).toHaveBeenLastCalledWith({type: 'rotate', direction: 1});
    await user.click(screen.getByRole('button', {name: L.flipHorizontal}));
    expect(onAction).toHaveBeenLastCalledWith({type: 'flip', axis: 'horizontal'});
  });

  it('moves the straighten slider as one gesture and announces the end', () => {
    const {onAction, onCommit, announce} = setup({straighten: true});
    const slider = screen.getByRole('slider', {name: L.straighten});
    fireEvent.keyDown(slider, {key: 'ArrowRight'});
    expect(onAction).toHaveBeenCalledWith({type: 'straighten', degrees: 0.5}, {transient: true});
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(L.straightened(0.5));
  });
});

import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import {NEUTRAL_ADJUSTMENTS, type Adjustments} from '../state/editorState.js';
import {AdjustControls, type AdjustControlsProps} from './AdjustControls.js';

const ALL = {brightness: true, contrast: true, saturation: true, presets: true};

function setup(tools: AdjustControlsProps['tools'] = ALL, adjust: Adjustments = NEUTRAL_ADJUSTMENTS) {
  const onAction = vi.fn();
  const onCommit = vi.fn();
  render(<AdjustControls adjust={adjust} tools={tools} onAction={onAction} onCommit={onCommit} disabled={false} />);
  return {onAction, onCommit, user: userEvent.setup()};
}

describe('AdjustControls', () => {
  it('lists each enabled value with its number and starts on the first', () => {
    setup(ALL, {brightness: 0, contrast: 20, saturation: -5});
    const group = screen.getByRole('group', {name: L.adjustment});
    expect(group).toHaveTextContent(`${L.brightness}0`);
    expect(group).toHaveTextContent(`${L.contrast}20`);
    expect(screen.getByRole('slider', {name: L.brightness})).toHaveValue('0');
  });

  it('shows only the enabled values, and no presets when they are off', () => {
    setup({brightness: false, contrast: true, saturation: false, presets: false});
    expect(screen.queryByRole('button', {name: /brightness/i})).not.toBeInTheDocument();
    expect(screen.getByRole('slider', {name: L.contrast})).toBeInTheDocument();
    expect(screen.queryByRole('group', {name: L.presets})).not.toBeInTheDocument();
  });

  it('shows only the presets when every value is off', async () => {
    const {user, onAction} = setup({brightness: false, contrast: false, saturation: false, presets: true});
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', {name: L.adjustment})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: L.presetFade}));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first value when the picked one is turned off', async () => {
    const user = userEvent.setup();
    const props = {adjust: NEUTRAL_ADJUSTMENTS, onAction: vi.fn(), onCommit: vi.fn(), disabled: false};
    const {rerender} = render(<AdjustControls {...props} tools={ALL} />);
    await user.click(screen.getByRole('button', {name: new RegExp(L.saturation)}));
    expect(screen.getByRole('slider', {name: L.saturation})).toBeInTheDocument();
    rerender(<AdjustControls {...props} tools={{...ALL, saturation: false}} />);
    expect(screen.getByRole('slider', {name: L.brightness})).toBeInTheDocument();
  });

  it('moves the slider for the picked value as one gesture', async () => {
    const {user, onAction, onCommit} = setup();
    await user.click(screen.getByRole('button', {name: new RegExp(L.saturation)}));
    fireEvent.keyDown(screen.getByRole('slider', {name: L.saturation}), {key: 'ArrowRight'});
    expect(onAction).toHaveBeenCalledWith({type: 'adjust', values: {saturation: 1}}, {transient: true});
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('sets all three values from a preset and marks the one in use', async () => {
    const {user, onAction} = setup(ALL, {brightness: 0, contrast: 10, saturation: -100});
    expect(screen.getByRole('button', {name: L.presetMono})).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', {name: L.presetVivid}));
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'adjust',
      values: {brightness: 5, contrast: 15, saturation: 35},
    });
  });

  it('keeps the picked value and the preset when the pressed button is clicked again', async () => {
    const {user, onAction} = setup(ALL, {brightness: 0, contrast: 10, saturation: -100});
    await user.click(screen.getByRole('button', {name: new RegExp(L.brightness)}));
    expect(screen.getByRole('slider', {name: L.brightness})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: L.presetMono}));
    expect(onAction).not.toHaveBeenCalled();
  });
});

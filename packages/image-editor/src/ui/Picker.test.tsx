import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import {Picker} from './Picker.js';

const onPick = vi.fn();

function zone() {
  render(<Picker accept={['image/png']} onPick={onPick} />);
  // Drag events bubble, so the prompt stands in for the drop zone around it.
  return screen.getByText(L.pickerPrompt);
}

describe('Picker', () => {
  it('picks the first dropped file', () => {
    onPick.mockClear();
    const box = zone();
    const file = new File(['x'], 'a.png', {type: 'image/png'});
    fireEvent.dragOver(box);
    fireEvent.dragLeave(box);
    fireEvent.drop(box, {dataTransfer: {files: [file]}});
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it('ignores a drop that carries no file', () => {
    onPick.mockClear();
    fireEvent.drop(zone(), {dataTransfer: {files: []}});
    expect(onPick).not.toHaveBeenCalled();
  });
});

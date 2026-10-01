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

  it('opens the file dialog from the button', () => {
    zone();
    const input = screen.getByLabelText(L.pickerChoose);
    const opened = vi.fn();
    // A click on a file input is what opens the browser's dialog.
    input.addEventListener('click', opened);
    fireEvent.click(screen.getByRole('button', {name: L.pickerChoose}));
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('ignores a dialog that is closed without a file', () => {
    onPick.mockClear();
    zone();
    fireEvent.change(screen.getByLabelText(L.pickerChoose), {target: {files: []}});
    expect(onPick).not.toHaveBeenCalled();
  });

  it('ignores a drop that carries no file', () => {
    onPick.mockClear();
    fireEvent.drop(zone(), {dataTransfer: {files: []}});
    expect(onPick).not.toHaveBeenCalled();
  });
});

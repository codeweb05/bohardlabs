/**
 * jsdom has no Fullscreen API, so these install a small one: `requestFullscreen` and
 * `exitFullscreen` move `document.fullscreenElement` and fire `fullscreenchange`, the way a
 * browser does once the request is granted.
 */
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {useFullscreen} from './useFullscreen';

let fullscreenElement: Element | null = null;

function setFullscreen(element: Element | null) {
  fullscreenElement = element;
  document.dispatchEvent(new Event('fullscreenchange'));
}

const requestFullscreen = vi.fn(() => {
  setFullscreen(document.documentElement);
  return Promise.resolve();
});
const exitFullscreen = vi.fn(() => {
  setFullscreen(null);
  return Promise.resolve();
});

beforeEach(() => {
  fullscreenElement = null;
  requestFullscreen.mockClear();
  exitFullscreen.mockClear();
  Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => fullscreenElement});
  Object.defineProperty(document, 'exitFullscreen', {configurable: true, value: exitFullscreen});
  Object.defineProperty(document.documentElement, 'requestFullscreen', {configurable: true, value: requestFullscreen});
});

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
});

describe('useFullscreen', () => {
  it('puts the page in fullscreen and takes it out again', async () => {
    const {result} = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(false);

    await act(async () => result.current.toggle());
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => result.current.toggle());
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(result.current.isFullscreen).toBe(false);
  });

  it('follows the browser out when the user presses Escape', async () => {
    const {result} = renderHook(() => useFullscreen());
    await act(async () => result.current.toggle());

    // Escape is handled by the browser, which only reports the change.
    act(() => setFullscreen(null));

    expect(result.current.isFullscreen).toBe(false);
  });

  it('stays put when something else on the page goes fullscreen', () => {
    const {result} = renderHook(() => useFullscreen());

    act(() => setFullscreen(document.body));

    expect(result.current.isFullscreen).toBe(false);
  });

  it('stays put when the browser refuses, and does not react to a later change', async () => {
    requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('Permissions check failed')));
    const {result} = renderHook(() => useFullscreen());

    await act(async () => result.current.toggle());
    act(() => setFullscreen(document.body));

    expect(result.current.isFullscreen).toBe(false);
  });

  it('leaves fullscreen when the table unmounts in it', async () => {
    const {result, unmount} = renderHook(() => useFullscreen());
    await act(async () => result.current.toggle());

    unmount();

    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it('leaves the page alone on unmount when it is not fullscreen', async () => {
    const {result, unmount} = renderHook(() => useFullscreen());
    await act(async () => result.current.toggle());
    // The user left with Escape after the request; nothing is left to exit.
    fullscreenElement = null;

    unmount();

    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});

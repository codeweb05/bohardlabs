import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

import {clearAllTestQueryClients} from './test-utils';

afterEach(() => {
  cleanup();
  clearAllTestQueryClients();
  vi.restoreAllMocks();
});

// jsdom implements none of the three browser APIs the table reads at mount: the toolbar
// asks `matchMedia` whether it is on a phone, the header watches cells with a
// `ResizeObserver` to decide when a label needs a tooltip, and the virtualizer scrolls
// the container. Without stubs every one of those throws before an assertion is reached.

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver;

Element.prototype.scrollTo = vi.fn();
window.scrollTo = vi.fn();

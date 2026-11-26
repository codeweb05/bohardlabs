/**
 * The measurement pass behind "Fit columns to content". jsdom has no layout, so each test
 * gives the elements the widths a browser would report: `offsetWidth` reads a
 * `data-width` attribute, and a content box set to `max-content` reports `data-natural`.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {fitColumnSizing, headerCells, measureContentWidths, type FittableColumn} from './measureColumns';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    const natural = this.style.width === 'max-content' ? this.dataset.natural : undefined;
    return Number(natural ?? this.dataset.width ?? 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function table(html: string): HTMLTableElement {
  const el = document.createElement('table');
  el.innerHTML = html;
  return el;
}

describe('headerCells', () => {
  it('reads the first header row only, and only cells that name a column', () => {
    const el = table(`
      <thead>
        <tr><th data-column-id="a"></th><th></th><th data-column-id="b"></th></tr>
        <tr><th data-column-id="c"></th></tr>
      </thead>`);

    expect(headerCells(el).map((cell) => cell.dataset.columnId)).toEqual(['a', 'b']);
  });
});

describe('measureContentWidths', () => {
  it('takes the widest cell per column, header included, plus its padding and icons', () => {
    const el = table(`
      <thead><tr>
        <th data-column-id="name" data-width="150"><div class="header-content" data-width="110" data-natural="40"></div></th>
        <th data-column-id="select" data-width="48"><input type="checkbox" /></th>
      </tr></thead>
      <tbody>
        <tr><td data-column-id="name" data-width="150"><div class="cell-content" data-width="134" data-natural="90.2"></div></td></tr>
        <tr><td data-column-id="name" data-width="150"><div class="cell-content" data-width="134" data-natural="60"></div></td></tr>
      </tbody>`);

    // The widest body cell wins: 90.2 of text and 16 of padding, rounded up.
    expect(measureContentWidths(el)).toEqual(new Map([['name', 107]]));
  });

  it('puts every content box back the way it was', () => {
    const el = table(
      `<tbody><tr><td data-column-id="name"><div class="cell-content" style="color: red"></div></td></tr></tbody>`,
    );

    measureContentWidths(el);

    expect(el.querySelector<HTMLElement>('.cell-content')?.getAttribute('style')).toBe('color: red;');
  });
});

function column(id: string, columnDef: FittableColumn['columnDef'], canResize = true): FittableColumn {
  return {id, columnDef, getCanResize: () => canResize};
}

describe('fitColumnSizing', () => {
  it('clamps each width to the column’s own limits', () => {
    const widths = new Map([
      ['narrow', 12],
      ['wide', 900],
      ['fits', 230],
    ]);

    expect(
      fitColumnSizing(
        [
          column('narrow', {minSize: 50, maxSize: 500}),
          column('wide', {minSize: 50, maxSize: 500}),
          column('fits', {minSize: 50, maxSize: 500}),
        ],
        widths,
      ),
    ).toEqual({narrow: 50, wide: 500, fits: 230});
  });

  it('leaves alone a column it cannot resize or did not measure', () => {
    const widths = new Map([['select', 300]]);

    expect(fitColumnSizing([column('select', {}, false), column('hidden', {})], widths)).toEqual({});
  });

  it('uses the measured width as is when the column sets no limits', () => {
    expect(fitColumnSizing([column('free', {})], new Map([['free', 640]]))).toEqual({free: 640});
  });
});

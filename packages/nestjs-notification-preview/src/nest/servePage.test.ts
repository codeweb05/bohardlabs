// @vitest-environment node
import {describe, expect, it} from 'vitest';

import type {PageConfig} from '../pageSettings.js';
import {pageHtml} from './servePage.js';

const TEMPLATE =
  '<link href="./assets/a.css"><script type="application/json" id="np-config">{}</script><script src="./assets/a.js"></script>';

const CONFIG: PageConfig = {apiBase: '/p/api', appName: 'A $& B', environment: null, strings: {}, storageKey: 'k'};

describe('pageHtml', () => {
  it('writes a $ in the settings as itself, never as a replacement pattern', () => {
    expect(pageHtml(TEMPLATE, '/p', CONFIG)).toContain('"appName":"A $& B"');
  });

  it('links every asset under the path', () => {
    const html = pageHtml(TEMPLATE, '/p', CONFIG);
    expect(html).toContain('href="/p/assets/a.css"');
    expect(html).toContain('src="/p/assets/a.js"');
  });

  it('refuses a page with no settings block', () => {
    expect(() => pageHtml('<html></html>', '/p', CONFIG)).toThrow('no settings block');
  });
});

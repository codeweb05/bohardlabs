import {describe, expect, it} from 'vitest';

import {fingerprint} from './fingerprint.js';
import type {RenderResponse} from './types.js';

const email: RenderResponse = {channel: 'email', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', warnings: []};

describe('fingerprint', () => {
  it('is the same whatever order the keys come in', () => {
    const shuffled = {warnings: [], text: 'Hi', html: '<p>Hi</p>', subject: 'Hi', channel: 'email'} as RenderResponse;
    expect(fingerprint(shuffled)).toBe(fingerprint(email));
  });

  it('is eight hex digits and changes with any part of the render', () => {
    expect(fingerprint(email)).toMatch(/^[0-9a-f]{8}$/u);
    expect(fingerprint({...email, subject: 'Hello'})).not.toBe(fingerprint(email));
    expect(fingerprint({...email, html: '<p>Hi!</p>'})).not.toBe(fingerprint(email));
    expect(fingerprint({...email, warnings: ['Missing es.']})).not.toBe(fingerprint(email));
  });

  it('tells a push from an email and one push from another', () => {
    const push: RenderResponse = {channel: 'push', title: 'Due', body: 'Soon', warnings: []};
    expect(fingerprint(push)).not.toBe(fingerprint(email));
    expect(fingerprint({...push, body: 'Later'})).not.toBe(fingerprint(push));
  });
});

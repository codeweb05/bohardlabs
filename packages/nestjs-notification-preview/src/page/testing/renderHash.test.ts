import {describe, expect, it} from 'vitest';

import type {RenderResponse} from '../../core/types.js';
import {renderHash} from './renderHash.js';

const email: RenderResponse = {channel: 'email', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', warnings: []};

describe('renderHash', () => {
  it('is the same whatever order the keys come in', () => {
    const shuffled = {warnings: [], text: 'Hi', html: '<p>Hi</p>', subject: 'Hi', channel: 'email'} as RenderResponse;
    expect(renderHash(shuffled)).toBe(renderHash(email));
  });

  it('is eight hex digits and changes with any part of the render', () => {
    expect(renderHash(email)).toMatch(/^[0-9a-f]{8}$/u);
    expect(renderHash({...email, subject: 'Hello'})).not.toBe(renderHash(email));
    expect(renderHash({...email, html: '<p>Hi!</p>'})).not.toBe(renderHash(email));
    expect(renderHash({...email, warnings: ['Missing es.']})).not.toBe(renderHash(email));
  });

  it('tells a push from an email and one push from another', () => {
    const push: RenderResponse = {channel: 'push', title: 'Due', body: 'Soon', warnings: []};
    expect(renderHash(push)).not.toBe(renderHash(email));
    expect(renderHash({...push, body: 'Later'})).not.toBe(renderHash(push));
  });
});

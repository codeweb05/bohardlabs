import {describe, expect, it, vi} from 'vitest';

import {createPageClient, PreviewClientError} from './client.js';
import {DEFAULT_PAGE_STRINGS} from './strings.js';

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}, ...init});

const refusal = async (promise: Promise<unknown>): Promise<unknown> => promise.catch((caught: unknown) => caught);

describe('createPageClient', () => {
  it('calls the three routes under the API base with JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ok: true}));
    const client = createPageClient('/notification-preview/api/', fetch);

    await client.catalog();
    await client.render({id: 'a', locale: 'en', values: {x: '1'}});
    await client.send({id: 'a', locale: 'en', values: {}, target: 't@example.com'});

    const calls = fetch.mock.calls.map(([url, init]) => [url, init?.method, init?.body]);
    expect(calls).toEqual([
      ['/notification-preview/api/catalog', 'GET', undefined],
      ['/notification-preview/api/render', 'POST', JSON.stringify({id: 'a', locale: 'en', values: {x: '1'}})],
      [
        '/notification-preview/api/send',
        'POST',
        JSON.stringify({id: 'a', locale: 'en', values: {}, target: 't@example.com'}),
      ],
    ]);
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBeNull();
    // The page is served from the same origin as its API; the browser's own cookies go with each call.
    expect(fetch.mock.calls[0]?.[1]?.credentials).toBe('same-origin');
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({locales: {}, entries: [], fingerprints: {}}));
    await expect(createPageClient('/p').catalog()).resolves.toEqual({locales: {}, entries: [], fingerprints: {}});
    expect(spy).toHaveBeenCalledOnce();
  });

  it("reads a guard's 429 with its Retry-After and its own message", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({message: 'Too many requests'}, {status: 429, headers: {'Retry-After': '120'}}),
    );
    const error = await refusal(createPageClient('/p', fetch).send({id: 'a', locale: 'en', values: {}, target: 't'}));
    expect(error).toBeInstanceOf(PreviewClientError);
    expect(error).toMatchObject({status: 429, message: 'Too many requests', retryAfterSeconds: 120, fieldErrors: {}});
  });

  it('says what a 401 means when the body says nothing', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}, {status: 401}));
    const error = await refusal(createPageClient('/p', fetch).catalog());
    expect(error).toMatchObject({status: 401, message: DEFAULT_PAGE_STRINGS.failure[401]});
    expect(DEFAULT_PAGE_STRINGS.failure[401]).toEqual(expect.any(String));
  });

  it('falls back to the default failure for a status with no sentence, and for a body that is not JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('nope', {status: 418, statusText: "I'm a teapot"}),
    );
    const error = await refusal(createPageClient('/p', fetch).catalog());
    expect(error).toMatchObject({
      status: 418,
      message: DEFAULT_PAGE_STRINGS.failure.default,
      fieldErrors: {},
      retryAfterSeconds: undefined,
    });
  });

  it("takes the consumer's failure sentences over the English ones", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({message: 42}, {status: 403}));
    const error = await refusal(createPageClient('/p', fetch, {default: 'Falló.', 403: 'Prohibido.'}).catalog());
    expect(error).toMatchObject({status: 403, message: 'Prohibido.'});
  });

  it('reads the field errors of a refused value, and nothing that is not a string', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({message: 'Refused.', fieldErrors: {url: 'Must be a link.', count: 3}}, {status: 422}),
    );
    const error = await refusal(createPageClient('/p', fetch).render({id: 'a', locale: 'en', values: {}}));
    expect(error).toMatchObject({status: 422, message: 'Refused.', fieldErrors: {url: 'Must be a link.'}});
  });

  it('reads a network failure as status 0 with the default sentence', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(createPageClient('/p', fetch).catalog()).rejects.toMatchObject({
      status: 0,
      message: DEFAULT_PAGE_STRINGS.failure.default,
    });
  });

  it('rethrows an abort as it came', async () => {
    const controller = new AbortController();
    const abort = new DOMException('Aborted', 'AbortError');
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      controller.abort();
      throw abort;
    });
    await expect(createPageClient('/p', fetch).catalog({signal: controller.signal})).rejects.toBe(abort);
  });
});

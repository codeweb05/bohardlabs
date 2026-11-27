import {describe, expect, it, vi} from 'vitest';

import {createFetchClient, PreviewClientError} from './client.js';

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}, ...init});

describe('createFetchClient', () => {
  it('calls the three routes under the base URL with JSON and the given headers', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ok: true}));
    const client = createFetchClient({
      baseUrl: 'https://api.test/preview/',
      headers: {Authorization: 'Bearer t'},
      fetch,
    });

    await client.catalog();
    await client.render({id: 'a', locale: 'en', values: {x: '1'}});
    await client.send({id: 'a', locale: 'en', values: {}, target: 't@example.com'});

    const calls = fetch.mock.calls.map(([url, init]) => [url, init?.method, init?.body]);
    expect(calls).toEqual([
      ['https://api.test/preview/catalog', 'GET', undefined],
      ['https://api.test/preview/render', 'POST', JSON.stringify({id: 'a', locale: 'en', values: {x: '1'}})],
      [
        'https://api.test/preview/send',
        'POST',
        JSON.stringify({id: 'a', locale: 'en', values: {}, target: 't@example.com'}),
      ],
    ]);
    const headers = new Headers(fetch.mock.calls[1]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer t');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBeNull();
  });

  it('asks a header function on every request', async () => {
    let n = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}));
    const client = createFetchClient({
      baseUrl: '/p',
      headers: async () => {
        n += 1;
        return {'X-N': String(n)};
      },
      fetch,
    });
    await client.catalog();
    await client.catalog();
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('X-N')).toBe('2');
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({locales: {}, entries: []}));
    await expect(createFetchClient({baseUrl: '/p'}).catalog()).resolves.toEqual({locales: {}, entries: []});
    expect(spy).toHaveBeenCalledOnce();
  });

  it('reads a refusal as a PreviewClientError with its field errors and Retry-After', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json(
        {message: 'Refused.', fieldErrors: {url: 'Must be a link.', count: 3}},
        {status: 422, headers: {'Retry-After': '12'}},
      ),
    );
    const error = await createFetchClient({baseUrl: '/p', fetch})
      .render({id: 'a', locale: 'en', values: {}})
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PreviewClientError);
    expect(error).toMatchObject({
      status: 422,
      message: 'Refused.',
      fieldErrors: {url: 'Must be a link.'},
      retryAfterSeconds: 12,
    });
  });

  it('falls back to the status text when the body is not JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('nope', {status: 500, statusText: 'Server Error'}),
    );
    const error = await createFetchClient({baseUrl: '/p', fetch})
      .catalog()
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({status: 500, message: 'Server Error', fieldErrors: {}, retryAfterSeconds: undefined});
  });

  it('reads a network failure as status 0', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(createFetchClient({baseUrl: '/p', fetch}).catalog()).rejects.toMatchObject({
      status: 0,
      message: 'Failed to fetch',
    });
    const notError = vi.fn<typeof globalThis.fetch>(() => Promise.reject('down'));
    await expect(createFetchClient({baseUrl: '/p', fetch: notError}).catalog()).rejects.toMatchObject({
      message: 'down',
    });
  });

  it('rethrows an abort as it came', async () => {
    const controller = new AbortController();
    const abort = new DOMException('Aborted', 'AbortError');
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      controller.abort();
      throw abort;
    });
    await expect(createFetchClient({baseUrl: '/p', fetch}).catalog({signal: controller.signal})).rejects.toBe(abort);
  });
});

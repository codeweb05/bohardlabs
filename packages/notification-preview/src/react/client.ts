import type {Catalog, RenderRequest, RenderResponse, SendRequest, SendResponse} from '../types.js';

/**
 * What the page asks of the server. `createFetchClient` is one; a consumer with its own HTTP
 * client writes another. A refusal should reject with a `PreviewClientError`, so the page can
 * put each refused value under its field.
 */
export interface PreviewClient {
  readonly catalog: (options?: {readonly signal?: AbortSignal}) => Promise<Catalog>;
  readonly render: (request: RenderRequest, options?: {readonly signal?: AbortSignal}) => Promise<RenderResponse>;
  readonly send: (request: SendRequest) => Promise<SendResponse>;
}

/** A refused or failed request, as the page reads it. */
export class PreviewClientError extends Error {
  override readonly name = 'PreviewClientError';
  /** The HTTP status, or 0 when no answer came. */
  readonly status: number;
  /** Each refused value by variable name, or `target` for the send's address. */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** From a 429's `Retry-After` header, when it gave a number of seconds. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options: {
      readonly status: number;
      readonly fieldErrors?: Readonly<Record<string, string>>;
      readonly retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.status = options.status;
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface FetchClientOptions {
  /** Where the three routes live: `${baseUrl}/catalog`, `/render` and `/send`. */
  readonly baseUrl: string;
  /** Sent with every request, such as an `Authorization` header. A function runs per request. */
  readonly headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** The `fetch` to call. Defaults to the global one. */
  readonly fetch?: typeof fetch;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The string-valued entries of a `fieldErrors` object, and nothing else. */
function fieldErrorsOf(body: unknown): Record<string, string> {
  const raw = isRecord(body) ? body['fieldErrors'] : undefined;
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

async function errorOf(response: Response): Promise<PreviewClientError> {
  const body: unknown = await response.json().catch(() => undefined);
  const message = isRecord(body) && typeof body['message'] === 'string' ? body['message'] : response.statusText;
  const retryAfter = Number(response.headers.get('Retry-After') ?? Number.NaN);
  return new PreviewClientError(message, {
    status: response.status,
    fieldErrors: fieldErrorsOf(body),
    ...(Number.isFinite(retryAfter) ? {retryAfterSeconds: retryAfter} : {}),
  });
}

/**
 * A `PreviewClient` over `fetch`, for a server that mounts the three routes under one base
 * URL: `GET catalog`, `POST render` and `POST send`, each answering JSON. A refusal's body is
 * read as `PreviewErrorBody`.
 */
export function createFetchClient(options: FetchClientOptions): PreviewClient {
  let base = options.baseUrl;
  while (base.endsWith('/')) base = base.slice(0, -1);
  const call = async <T>(path: string, init: RequestInit): Promise<T> => {
    const doFetch = options.fetch ?? fetch;
    const extra = typeof options.headers === 'function' ? await options.headers() : options.headers;
    const headers = new Headers(extra);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await doFetch(`${base}/${path}`, {...init, headers});
    } catch (error: unknown) {
      if (init.signal?.aborted === true) throw error;
      throw new PreviewClientError(error instanceof Error ? error.message : String(error), {status: 0});
    }
    if (!response.ok) throw await errorOf(response);
    return (await response.json()) as T;
  };
  return {
    catalog: (callOptions) => call<Catalog>('catalog', {method: 'GET', signal: callOptions?.signal ?? null}),
    render: (request, callOptions) =>
      call<RenderResponse>('render', {
        method: 'POST',
        body: JSON.stringify(request),
        signal: callOptions?.signal ?? null,
      }),
    send: (request) => call<SendResponse>('send', {method: 'POST', body: JSON.stringify(request)}),
  };
}

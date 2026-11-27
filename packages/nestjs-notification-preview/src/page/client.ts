import type {Catalog, RenderRequest, RenderResponse, SendRequest, SendResponse} from '../core/types.js';
import {DEFAULT_PAGE_STRINGS} from './strings.js';
import type {FailureStrings} from './strings.js';

/** What the page asks of the server. A refusal rejects with a `PreviewClientError`. */
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

/** The sentence for `status`: its own, else the default. */
const sentenceFor = (failure: FailureStrings, status: number): string => failure[status] ?? failure.default;

/**
 * A refusal as the page reads it. The body may be the app's own shape, as when a guard of the
 * consumer's answers first: its string `message` is used when there is one, else the status's
 * sentence.
 */
async function errorOf(response: Response, failure: FailureStrings): Promise<PreviewClientError> {
  const body: unknown = await response.json().catch(() => undefined);
  const own = isRecord(body) ? body['message'] : undefined;
  const message = typeof own === 'string' && own !== '' ? own : sentenceFor(failure, response.status);
  const retryAfter = Number(response.headers.get('Retry-After') ?? Number.NaN);
  return new PreviewClientError(message, {
    status: response.status,
    fieldErrors: fieldErrorsOf(body),
    ...(Number.isFinite(retryAfter) ? {retryAfterSeconds: retryAfter} : {}),
  });
}

/**
 * The page's client for the three routes under `apiBase`: `GET catalog`, `POST render` and
 * `POST send`, each answering JSON. The page is served from the API's own origin, so the
 * browser's cookies go with each call. `failure` names each refusal the body does not.
 */
export function createPageClient(
  apiBase: string,
  fetchImpl?: typeof fetch,
  failure: FailureStrings = DEFAULT_PAGE_STRINGS.failure,
): PreviewClient {
  let base = apiBase;
  while (base.endsWith('/')) base = base.slice(0, -1);
  const call = async <T>(path: string, init: RequestInit): Promise<T> => {
    const doFetch = fetchImpl ?? fetch;
    const headers = new Headers({Accept: 'application/json'});
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await doFetch(`${base}/${path}`, {...init, headers, credentials: 'same-origin'});
    } catch (error: unknown) {
      if (init.signal?.aborted === true) throw error;
      throw new PreviewClientError(sentenceFor(failure, 0), {status: 0});
    }
    if (!response.ok) throw await errorOf(response, failure);
    return (await response.json()) as T;
  };
  return {
    catalog: (options) => call<Catalog>('catalog', {method: 'GET', signal: options?.signal ?? null}),
    render: (request, options) =>
      call<RenderResponse>('render', {method: 'POST', body: JSON.stringify(request), signal: options?.signal ?? null}),
    send: (request) => call<SendResponse>('send', {method: 'POST', body: JSON.stringify(request)}),
  };
}

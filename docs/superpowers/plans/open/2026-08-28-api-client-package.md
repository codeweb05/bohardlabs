# @bohar/api-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the axios client, the token service and the React Query layer that two of the four admin apps each maintain their own copy of, with everything the app supplied (env, storage keys, endpoints, i18n, toasts, routes) turned into configuration.

**Architecture:** One `createApiClient(config)` factory returns `{api, axiosInstance, tokenService}`. Everything currently read from a module-scope import becomes a field on that config. The package has two entry points: the root is framework-free and works in Node, `./react` adds the query client, the provider and the two hooks. Permission helpers are pure functions plus a guard factory that takes the consumer's `redirect`, so the package never imports a router.

**Tech Stack:** axios 1, `@tanstack/react-query` 5 (optional peer, `./react` only), React 19 (optional peer), Vite lib mode with two entries, Vitest (node for core, jsdom for storage and hooks).

**Spec:** [`docs/extraction/README.md`](../../../extraction/README.md), section "4. `@bohar/api-client`"

**Source being ported:** `skipwash-latest/skipwash-admin/src/lib/axios/` (617 loc with tests), `src/lib/auth/token-service.ts` (460), `src/lib/react-query/` (158), `src/contexts/AuthContext/permissions.ts` (63). Around 1200 lines of source, plus 1900 lines of existing tests worth reading before rewriting them.

## Precondition, to settle before Task 1

This is the only plan in the set that encodes a backend contract rather than a UI. Before starting, confirm that `skipwash-api` and `smarthip-backend` agree on all five of these:

1. The success envelope is `{success, data, message?}`.
2. A handler that returns its own top-level `message` is passed through flat, with no `data` wrapper. This is what `unwrapResponse` exists for.
3. The refresh endpoint takes `{refreshToken}` and returns `{accessToken, refreshToken, expiresIn}` inside the envelope.
4. `x-tenant-id` is a real header the API reads.
5. The error body is `{success: false, message, errorCode?, errors?}`.

If they disagree on any of them, stop and record the divergence in
[`docs/extraction/README.md`](../../../extraction/README.md). The fallback is a smaller
package: Tasks 1, 3, 4 and 6 (errors, storage, token service, permissions) are backend
contract in only one place, the refresh endpoint, which is already configurable. Tasks 2, 5
and 7 are the ones that assume the envelope.

Write the answer into the README's "Backend contract" section either way, so the next
person does not have to re-derive it.

## Global Constraints

- Package name `@bohar/api-client`, `"private": true`, version `0.0.0`.
- No `@/…` imports. `env`, `STORAGE_KEYS`, `API_ENDPOINTS`, `ROUTES`, `i18next` and
  `toastUtil` are all app-supplied and all become config.
- **No module-scope mutable state.** The app's token service keeps `refreshPromise`,
  `sessionGeneration`, `refreshTimer` and `refreshBlockedUntil` at module scope, which is
  fine for one app and wrong for a library: two clients in one process would share a
  refresh lock and a session counter. All of it moves inside the factory closure.
- **No `console` calls.** The app logs requests and errors directly. A library that writes
  to a consumer's console is a nuisance. Everything goes through an injected
  `logger?: {debug?, error?}` that defaults to no-ops.
- **No `globalThis.dispatchEvent`.** The `auth:unauthorized` CustomEvent becomes an
  `onUnauthorized()` callback in config. A consumer who wants the event dispatches it
  themselves in one line, and the package stops depending on a DOM global.
- No hardcoded user-facing string. Error messages come from a `messages` config block with
  English defaults.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`. The one exception the
  source already relies on is `unwrapResponse`'s `body as T`, which is an unavoidable
  unchecked cast at a parse boundary; keep it, and keep it to that one function.
- `@tanstack/react-query` and `react` are **optional** peers, needed only by the `./react`
  entry.
- ESM only, `formats: ['es']`, `preserveModules: true`.
- No stories. This package has no UI, so Storybook is not involved anywhere in this plan.
- Never run a git command. Tasks end with a handoff step.

---

### Task 1: Scaffolding, config types, and the error layer

**Files:**

- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/tsconfig.build.json`
- Create: `packages/api-client/vite.config.ts`
- Create: `packages/api-client/src/types.ts`
- Create: `packages/api-client/src/messages.ts`
- Create: `packages/api-client/src/error.ts`
- Create: `packages/api-client/src/index.ts`
- Test: `packages/api-client/src/error.test.ts`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `ErrorCode` (enum), `ApiError` (class), `createApiError`, `isApiError`,
    `isNetworkOrTimeoutError`, `getErrorMessage`, `getErrorCode`.
  - `interface ErrorMessages`, `DEFAULT_MESSAGES`.
  - `interface SuccessResponse<T>`, `ErrorResponse`, `PaginatedResponse<T>`,
    `ApiRequestConfig`, `ApiResponse<T>`.

`ApiError` is the type that leaks furthest: a consumer catches it, a React Query retry
predicate reads its `status`, a form reads `getValidationErrors()`. It goes first because
everything else imports it.

- [ ] **Step 1: Catalog and package.json**

Add to the `catalog:` block in `pnpm-workspace.yaml`:

```yaml
  axios: ^1.13.2
```

`@tanstack/react-query` is already in the catalog from the datatable work. Check before
adding; if the range differs from `^5`, use whatever is there.

`packages/api-client/package.json`:

```json
{
  "name": "@bohar/api-client",
  "version": "0.0.0",
  "private": true,
  "description": "Axios client, refresh-token service and React Query layer for the admin APIs",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "default": "./dist/react/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": {"access": "public"},
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "dev": "vite build --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "axios": "catalog:"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^19.0.0"
  },
  "peerDependenciesMeta": {
    "@tanstack/react-query": {"optional": true},
    "react": {"optional": true}
  },
  "devDependencies": {
    "@tanstack/react-query": "catalog:",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^26.4.0",
    "@types/react": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "jsdom": "^28.0.1",
    "react": "catalog:",
    "react-dom": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`axios` is a real dependency, not a peer: a consumer does not hold an axios instance the
package needs to share, and two copies of axios in a tree are harmless. React and React
Query are peers for the usual reason.

- [ ] **Step 2: Write `vite.config.ts` with two entries**

```ts
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react({babel: {plugins: [['babel-plugin-react-compiler', {}]]}})],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'react/index': resolve(__dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {preserveModules: true, entryFileNames: '[name].js'},
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.dom.test.ts', 'jsdom'],
      ['**/react/**', 'jsdom'],
    ],
    globals: true,
  },
});
```

Two environments on purpose. The core is Node code and should be tested as Node code, so a
`window` leaking into it fails the test rather than passing by accident. Storage and hooks
opt into jsdom by filename.

Create `src/react/index.ts` as an empty file now so the second entry resolves; Task 7 fills
it in.

- [ ] **Step 3: Copy the tsconfigs**

From `packages/datatable`, unchanged.

- [ ] **Step 4: Write `src/types.ts`**

Port `lib/axios/types.ts` verbatim: `ApiRequestConfig`, `ApiResponse`, `SuccessResponse`,
`ErrorResponse`, `PaginatedResponse`. Nothing in it is app-specific.

- [ ] **Step 5: Write the failing error test**

```ts
import {AxiosError, AxiosHeaders} from 'axios';
import {describe, expect, it} from 'vitest';

import {ApiError, ErrorCode, createApiError, getErrorCode, isNetworkOrTimeoutError} from './error';

function axiosError(options: {status?: number; code?: string; data?: unknown; message?: string}): AxiosError {
  const error = new AxiosError(options.message ?? 'Request failed', options.code);
  if (options.status !== undefined) {
    error.response = {
      status: options.status,
      statusText: '',
      headers: new AxiosHeaders(),
      config: {headers: new AxiosHeaders()},
      data: options.data,
    };
  }
  return error;
}

describe('createApiError', () => {
  it('maps a timeout code to TIMEOUT', () => {
    expect(createApiError(axiosError({code: 'ECONNABORTED'})).code).toBe(ErrorCode.TIMEOUT);
  });

  it('maps a missing response to NETWORK_ERROR', () => {
    expect(createApiError(axiosError({})).code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it.each([
    [401, ErrorCode.UNAUTHORIZED],
    [403, ErrorCode.FORBIDDEN],
    [404, ErrorCode.NOT_FOUND],
    [422, ErrorCode.VALIDATION_ERROR],
    [500, ErrorCode.SERVER_ERROR],
    [503, ErrorCode.SERVER_ERROR],
    [418, ErrorCode.UNKNOWN],
  ])('maps status %i to %s', (status, expected) => {
    expect(createApiError(axiosError({status})).code).toBe(expected);
  });

  it('prefers the body message over the axios message', () => {
    const error = createApiError(axiosError({status: 400, message: 'Request failed', data: {message: 'Email taken'}}));
    expect(error.message).toBe('Email taken');
  });

  it('falls back to the first entry of an errors array', () => {
    const error = createApiError(axiosError({status: 400, data: {errors: [{message: 'Too short'}]}}));
    expect(error.message).toBe('Too short');
  });

  it('extracts errorCode from the body', () => {
    const error = createApiError(axiosError({status: 409, data: {errorCode: 'HOLIDAY_DATE_CONFLICT'}}));
    expect(getErrorCode(error)).toBe('HOLIDAY_DATE_CONFLICT');
  });

  it('returns an existing ApiError unchanged', () => {
    const original = new ApiError(404, ErrorCode.NOT_FOUND, 'Gone');
    expect(createApiError(original)).toBe(original);
  });

  it('wraps a plain Error', () => {
    const error = createApiError(new Error('boom'));
    expect(error.code).toBe(ErrorCode.UNKNOWN);
    expect(error.status).toBe(0);
  });

  it('wraps a thrown non-error', () => {
    expect(createApiError('nope').message).toBe('An unexpected error occurred');
  });
});

describe('ApiError', () => {
  it('reports validation errors', () => {
    const error = new ApiError(422, ErrorCode.VALIDATION_ERROR, 'Invalid', {errors: {email: ['Required']}});
    expect(error.isValidationError()).toBe(true);
    expect(error.getValidationErrors()).toEqual({email: ['Required']});
  });

  it('returns an empty map when the body carries no errors', () => {
    const error = new ApiError(422, ErrorCode.VALIDATION_ERROR, 'Invalid', {});
    expect(error.getValidationErrors()).toEqual({});
  });

  it('returns an empty map for a non-validation error', () => {
    const error = new ApiError(500, ErrorCode.SERVER_ERROR, 'Boom', {errors: {email: ['Required']}});
    expect(error.getValidationErrors()).toEqual({});
  });
});

describe('getUserMessage', () => {
  it('uses the timeout message for a timeout', () => {
    const error = new ApiError(0, ErrorCode.TIMEOUT, 'timeout of 0ms exceeded');
    expect(error.getUserMessage()).toBe('The request took too long. Please try again.');
  });

  it('uses the network message for a dropped connection', () => {
    const error = new ApiError(0, ErrorCode.NETWORK_ERROR, 'Network Error');
    expect(error.getUserMessage()).toBe('Could not reach the server. Check your connection.');
  });

  it('falls back to the unexpected message for an empty message', () => {
    const error = new ApiError(500, ErrorCode.SERVER_ERROR, '   ');
    expect(error.getUserMessage()).toBe('Something went wrong. Please try again.');
  });

  it('passes a human message through', () => {
    const error = new ApiError(409, ErrorCode.UNKNOWN, 'That email is already registered');
    expect(error.getUserMessage()).toBe('That email is already registered');
  });

  it('resolves an ALL_CAPS backend key through the resolver', () => {
    const error = new ApiError(409, ErrorCode.UNKNOWN, 'HOLIDAY_DATE_CONFLICT', undefined, {
      ...DEFAULT_MESSAGES,
      resolveBackendKey: (key) => (key === 'HOLIDAY_DATE_CONFLICT' ? 'That date already has a holiday' : undefined),
    });
    expect(error.getUserMessage()).toBe('That date already has a holiday');
  });

  it('shows the raw key when the resolver has nothing for it', () => {
    const error = new ApiError(409, ErrorCode.UNKNOWN, 'HOLIDAY_UNKNOWN_THING', undefined, {
      ...DEFAULT_MESSAGES,
      resolveBackendKey: () => undefined,
    });
    expect(error.getUserMessage()).toBe('HOLIDAY_UNKNOWN_THING');
  });

  it('does not send a normal sentence to the resolver', () => {
    const seen: string[] = [];
    const error = new ApiError(409, ErrorCode.UNKNOWN, 'That email is already registered', undefined, {
      ...DEFAULT_MESSAGES,
      resolveBackendKey: (key) => {
        seen.push(key);
        return undefined;
      },
    });
    error.getUserMessage();
    expect(seen).toEqual([]);
  });
});
```

Import `DEFAULT_MESSAGES` alongside the rest.

The last case is the one the app's regex exists for and never states: `resolveBackendKey`
is only consulted for `/^[A-Z][A-Z0-9_]*$/`, so a real sentence is never fed to a
translation lookup that would return a miss and lose it.

- [ ] **Step 6: Run and watch it fail**

Run: `pnpm --filter @bohar/api-client test error`
Expected: FAIL, cannot resolve `./error`.

- [ ] **Step 7: Write `src/messages.ts`**

```ts
export interface ErrorMessages {
  readonly networkTimeout: string;
  readonly networkError: string;
  readonly unexpectedError: string;
  /**
   * Turns an ALL_CAPS key the backend put in `message` into a sentence.
   *
   * The API signals some semantic failures with a key rather than prose
   * (`HOLIDAY_DATE_CONFLICT`). Only strings matching `/^[A-Z][A-Z0-9_]*$/` reach this;
   * return `undefined` for a key you do not recognise and the key itself is shown.
   */
  readonly resolveBackendKey?: (key: string) => string | undefined;
}

export const DEFAULT_MESSAGES: ErrorMessages = {
  networkTimeout: 'The request took too long. Please try again.',
  networkError: 'Could not reach the server. Check your connection.',
  unexpectedError: 'Something went wrong. Please try again.',
};
```

The app hardcodes a `HOLIDAY_` prefix and an i18next path inside `error.ts`. Both are
Skipwash facts. A consumer writes:

```ts
resolveBackendKey: (key) =>
  key.startsWith('HOLIDAY_') ? i18n.t(`settings.holidays.errors.${key}`, {defaultValue: ''}) || undefined : undefined,
```

- [ ] **Step 8: Write `src/error.ts`**

Port the app file with three changes: `i18n.t` calls become `this.messages.*`, the
`BACKEND_KEY_NAMESPACES` array becomes the single injected `resolveBackendKey`, and
`ApiError`'s constructor gains a fifth parameter.

```ts
export class ApiError extends Error {
  public readonly errorCode: string | undefined;

  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly data?: unknown,
    private readonly messages: ErrorMessages = DEFAULT_MESSAGES,
  ) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = extractErrorCode(data);
  }
  // ...
}
```

`createApiError(error, messages = DEFAULT_MESSAGES)` threads the same argument through, and
the client from Task 2 passes its configured messages in. Keep every one of the status
mappings exactly as the app has them; the test above pins all seven.

- [ ] **Step 9: Run the tests**

Run: `pnpm --filter @bohar/api-client test error`
Expected: PASS, 24 tests.

- [ ] **Step 10: Write the temporary entry point, install, build**

```ts
export {ApiError, ErrorCode, createApiError, getErrorCode, getErrorMessage, isApiError, isNetworkOrTimeoutError} from './error';
export {DEFAULT_MESSAGES} from './messages';
export type {ErrorMessages} from './messages';
export type {ApiRequestConfig, ApiResponse, ErrorResponse, PaginatedResponse, SuccessResponse} from './types';
```

Run: `pnpm install && pnpm --filter @bohar/api-client build`

- [ ] **Step 11: Hand off for commit**

```
feat(api-client): scaffold the package and port the error layer
```

---

### Task 2: unwrapResponse and the request methods

**Files:**

- Create: `packages/api-client/src/unwrap.ts`
- Create: `packages/api-client/src/methods.ts`
- Test: `packages/api-client/src/unwrap.test.ts`
- Test: `packages/api-client/src/methods.test.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**

- Consumes: `ApiRequestConfig`, `SuccessResponse` (Task 1).
- Produces:
  - `unwrapResponse<T>(body: unknown): T`.
  - `createApiMethods(instance: AxiosInstance): ApiMethods`, where `ApiMethods` is the ten
    methods the app exposes: `get`, `post`, `put`, `patch`, `delete`, `putFormData`,
    `postFormData`, `getBlob`, `postBlob`.
  - `interface ApiMethods`, exported, because a consumer types their service layer against it.

Split from the client factory so the envelope logic can be tested against a stub axios
instance with no interceptors, no tokens and no timers.

- [ ] **Step 1: Write the failing unwrap test**

```ts
import {describe, expect, it} from 'vitest';

import {unwrapResponse} from './unwrap';

describe('unwrapResponse', () => {
  it('unwraps the standard envelope', () => {
    expect(unwrapResponse({success: true, data: {id: '1'}})).toEqual({id: '1'});
  });

  it('returns a flat body that carries no data key', () => {
    const body = {vendor: {id: '1'}, message: 'Approved', stripeAccountCreated: true};
    expect(unwrapResponse(body)).toEqual(body);
  });

  it('unwraps a null data payload rather than treating it as flat', () => {
    expect(unwrapResponse({success: true, data: null})).toBeNull();
  });

  it('unwraps an array payload', () => {
    expect(unwrapResponse({success: true, data: [1, 2]})).toEqual([1, 2]);
  });

  it('returns null unchanged', () => {
    expect(unwrapResponse(null)).toBeNull();
  });

  it('returns a primitive body unchanged', () => {
    expect(unwrapResponse('ok')).toBe('ok');
  });
});
```

The third case is why the check is `'data' in body` and not `body.data !== undefined`. An
endpoint that legitimately returns `data: null` must yield `null`, not the whole envelope.

- [ ] **Step 2: Run, fail, write unwrap.ts**

Port the function and, importantly, port the comment above it. It is the only record of why
the flat fallback exists, and without it the next reader deletes the branch as dead code.

Run: PASS, 6 tests.

- [ ] **Step 3: Write the failing methods test**

Use `axios.create()` with a stub adapter rather than a mock library, so the real axios
config pipeline runs:

```ts
import type {AxiosAdapter} from 'axios';
import axios, {AxiosHeaders} from 'axios';
import {describe, expect, it, vi} from 'vitest';

import {createApiMethods} from './methods';

function stubInstance(respond: (config: Parameters<AxiosAdapter>[0]) => unknown) {
  const seen: Array<Parameters<AxiosAdapter>[0]> = [];
  const instance = axios.create({
    adapter: async (config) => {
      seen.push(config);
      return {
        data: respond(config),
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    },
  });
  return {api: createApiMethods(instance), seen};
}

describe('createApiMethods', () => {
  it('returns the unwrapped payload from get', async () => {
    const {api} = stubInstance(() => ({success: true, data: {id: '1'}}));
    await expect(api.get('/things/1')).resolves.toEqual({id: '1'});
  });

  it('sends the body on post', async () => {
    const {api, seen} = stubInstance(() => ({success: true, data: null}));
    await api.post('/things', {name: 'x'});
    expect(JSON.parse(String(seen[0]?.data))).toEqual({name: 'x'});
  });

  it.each(['put', 'patch', 'delete'] as const)('unwraps %s', async (method) => {
    const {api} = stubInstance(() => ({success: true, data: 'done'}));
    const result = method === 'delete' ? await api.delete('/things/1') : await api[method]('/things/1', {});
    expect(result).toBe('done');
  });

  it('clears the JSON content type for postFormData', async () => {
    const {api, seen} = stubInstance(() => ({success: true, data: null}));
    await api.postFormData('/upload', new FormData());
    expect(seen[0]?.headers?.['Content-Type']).toBeUndefined();
  });

  it('clears the JSON content type for putFormData', async () => {
    const {api, seen} = stubInstance(() => ({success: true, data: null}));
    await api.putFormData('/upload', new FormData());
    expect(seen[0]?.headers?.['Content-Type']).toBeUndefined();
  });

  it('returns a blob unwrapped for getBlob', async () => {
    const blob = new Blob(['x']);
    const {api, seen} = stubInstance(() => blob);
    await expect(api.getBlob('/export')).resolves.toBe(blob);
    expect(seen[0]?.responseType).toBe('blob');
  });

  it('does not unwrap an envelope-shaped blob response', async () => {
    // A blob download must never go through unwrapResponse: a JSON error page that
    // happens to have a `data` key would come back as its inner value instead of a Blob.
    const body = {data: 'not a blob'};
    const {api} = stubInstance(() => body);
    await expect(api.getBlob('/export')).resolves.toBe(body);
  });

  it('sets responseType blob on postBlob', async () => {
    const {api, seen} = stubInstance(() => new Blob(['x']));
    await api.postBlob('/export', {ids: ['1']});
    expect(seen[0]?.responseType).toBe('blob');
  });

  it('passes a caller config through', async () => {
    const {api, seen} = stubInstance(() => ({success: true, data: null}));
    await api.get('/things', {params: {page: 2}});
    expect(seen[0]?.params).toEqual({page: 2});
  });
});
```

`FormData` and `Blob` exist in Node 18+, so these stay in the node environment.

- [ ] **Step 4: Run, fail, write methods.ts**

Port the `api` object from `instance.ts` into a factory that takes the instance. Extract the
`ApiMethods` interface from it explicitly rather than inferring it, so the published `.d.ts`
reads as documentation instead of as a wall of inferred generics.

Run: PASS, 12 tests.

- [ ] **Step 5: Export and hand off**

```ts
export {createApiMethods, unwrapResponse} from './methods';
export type {ApiMethods} from './methods';
```

```
feat(api-client): request methods and envelope unwrapping
```

---

### Task 3: The storage adapter

**Files:**

- Create: `packages/api-client/src/storage.ts`
- Test: `packages/api-client/src/storage.dom.test.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface TokenStorage {getItem(key): string | null; setItem(key, value): void; removeItem(key): void}`.
  - `createLocalStorageAdapter(): TokenStorage`: a `localStorage` wrapper that swallows
    throws.
  - `createMemoryStorage(): TokenStorage`: the fallback, and what tests use.
  - `interface StorageKeys`, `DEFAULT_STORAGE_KEYS`.
  - `createTokenStore(storage, keys)` returning
    `{getAccessToken, getRefreshToken, getExpiry, isAccessTokenValid, secondsUntilExpiry, store, clear}`.

The app reads `localStorage` directly in eight places and imports its keys from
`@/constants/storage`. Both become injectable, which is also what makes Task 4 testable
without touching a DOM.

- [ ] **Step 1: Write the failing test**

```ts
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_STORAGE_KEYS, createLocalStorageAdapter, createMemoryStorage, createTokenStore} from './storage';

describe('createLocalStorageAdapter', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a value', () => {
    const storage = createLocalStorageAdapter();
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('removes a value', () => {
    const storage = createLocalStorageAdapter();
    storage.setItem('k', 'v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('returns null instead of throwing when storage is unavailable', () => {
    // Safari in private mode throws on setItem once the quota is hit, and some
    // embedded webviews throw on read. A token read must never take the app down.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(createLocalStorageAdapter().getItem('k')).toBeNull();
  });

  it('swallows a throwing write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => createLocalStorageAdapter().setItem('k', 'v')).not.toThrow();
  });
});

describe('createTokenStore', () => {
  it('reports an unset token as invalid', () => {
    const store = createTokenStore(createMemoryStorage(), DEFAULT_STORAGE_KEYS);
    expect(store.getAccessToken()).toBeNull();
    expect(store.isAccessTokenValid()).toBe(false);
  });

  it('stores a token with an absolute expiry', () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));
    const store = createTokenStore(createMemoryStorage(), DEFAULT_STORAGE_KEYS);
    store.store('access', 'refresh', 3600);

    expect(store.getAccessToken()).toBe('access');
    expect(store.getRefreshToken()).toBe('refresh');
    expect(store.getExpiry()).toBe(Date.parse('2026-08-28T13:00:00Z'));
  });

  it('treats a token as invalid inside the 30 second skew window', () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));
    const store = createTokenStore(createMemoryStorage(), DEFAULT_STORAGE_KEYS);
    store.store('access', 'refresh', 20);

    expect(store.isAccessTokenValid()).toBe(false);
  });

  it('treats a token comfortably ahead of expiry as valid', () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));
    const store = createTokenStore(createMemoryStorage(), DEFAULT_STORAGE_KEYS);
    store.store('access', 'refresh', 300);

    expect(store.isAccessTokenValid()).toBe(true);
    expect(store.secondsUntilExpiry()).toBeCloseTo(300, 0);
  });

  it('never reports a negative time to expiry', () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));
    const store = createTokenStore(createMemoryStorage(), DEFAULT_STORAGE_KEYS);
    store.store('access', 'refresh', 60);
    vi.setSystemTime(new Date('2026-08-28T13:00:00Z'));

    expect(store.secondsUntilExpiry()).toBe(0);
  });

  it('clears all three keys', () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage, DEFAULT_STORAGE_KEYS);
    store.store('access', 'refresh', 300);
    store.clear();

    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getExpiry()).toBe(0);
  });

  it('uses the configured key names', () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage, {...DEFAULT_STORAGE_KEYS, accessToken: 'my-access'});
    store.store('access', 'refresh', 300);

    expect(storage.getItem('my-access')).toBe('access');
  });
});
```

Add `vi.useFakeTimers()` in a `beforeEach` and `vi.useRealTimers()` in an `afterEach` for
the second describe block.

- [ ] **Step 2: Run, fail, write storage.ts**

`DEFAULT_STORAGE_KEYS` matches the app so a migrating consumer keeps their users signed in:

```ts
export const DEFAULT_STORAGE_KEYS: StorageKeys = {
  accessToken: 'auth-access-token',
  refreshToken: 'auth-refresh-token',
  tokenExpiry: 'auth-token-expiry',
};
```

Keep the 30 second skew as an exported `TOKEN_EXPIRY_SKEW_MS = 30_000`, referenced by name
rather than repeated.

Run: PASS, 12 tests.

- [ ] **Step 3: Export and hand off**

```ts
export {DEFAULT_STORAGE_KEYS, createLocalStorageAdapter, createMemoryStorage, createTokenStore} from './storage';
export type {StorageKeys, TokenStorage} from './storage';
```

```
feat(api-client): storage adapter and token store
```

---

### Task 4: The token service

**Files:**

- Create: `packages/api-client/src/token-service.ts`
- Test: `packages/api-client/src/token-service.test.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**

- Consumes: `createTokenStore` (Task 3), `createApiError` (Task 1).
- Produces:
  - `createTokenService(config): TokenService` with
    `login`, `getAccessToken`, `restoreSession`, `logout`, `forceRefresh`, `clearTokens`,
    `storeSession`, `hasTokens`, and a new `dispose()`.
  - `interface TokenService`, `interface AuthTokens`, `interface AuthEndpoints`.

The largest task, and the one carrying the most encoded knowledge. Read
`skipwash-admin/src/lib/auth/token-service.test.ts` (780 lines) before writing: it already
covers most of these cases, and the ones it covers are the bugs that produced the design.

**What changes on the way in:**

| App | Package |
| --- | --- |
| module-scope `refreshTimer`, `refreshPromise`, `sessionGeneration`, `refreshRunId`, `refreshBlockedUntil` | closure state inside the factory |
| `authAxios` built from `env` | built from `config.baseURL`, `config.timeout`, `config.headers` |
| `API_ENDPOINTS.AUTH.*` | `config.endpoints`, defaulting to the `/v1/auth/*` paths |
| `localStorage` directly | the `TokenStorage` from Task 3 |
| `globalThis.dispatchEvent(new CustomEvent('auth:unauthorized'))` | `config.onUnauthorized?.()` |
| `REFRESH_LOCK_NAME = 'skipwash-token-refresh'` | `config.lockName`, default `'bohar-token-refresh'` |
| no teardown | `dispose()`, clearing the timer |

`dispose()` is new and not optional. A module singleton lives as long as the page; an
instance a test creates leaves a `setTimeout` behind that fires into a torn-down suite.

**What must not change:** the four mechanisms the comments in the source explain at length.
Port those comments verbatim. They are the only surviving record of why the code is shaped
this way:

1. `sessionGeneration` + `stillOwnsSession`, so a refresh that lands after a logout cannot
   resurrect a dead session, and one that lands after a different account logs in cannot
   clobber the new one.
2. `isTransientFailure`, so an offline blip does not sign the user out, and a deterministic
   400 does not strand the tab retrying forever.
3. `refreshBlockedUntil`, so an outage produces one refresh POST per backoff rather than one
   per outgoing request.
4. The `refreshRunId` check in the `finally`, so a run that outlived a logout does not free
   the dedupe slot a newer run is using.

- [ ] **Step 1: Write the test scaffolding**

```ts
import type {AxiosAdapter} from 'axios';
import {AxiosHeaders} from 'axios';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_STORAGE_KEYS, createMemoryStorage} from './storage';
import {createTokenService} from './token-service';

interface StubCall {
  readonly url: string;
  readonly body: unknown;
}

function setup(options: {respond?: (call: StubCall) => {status: number; data?: unknown}} = {}) {
  const calls: StubCall[] = [];
  const storage = createMemoryStorage();
  const onUnauthorized = vi.fn();

  const adapter: AxiosAdapter = async (config) => {
    const call = {url: config.url ?? '', body: config.data ? JSON.parse(String(config.data)) : undefined};
    calls.push(call);
    const result = options.respond?.(call) ?? {status: 200, data: {success: true, data: tokens('fresh')}};
    if (result.status >= 400) {
      const error = Object.assign(new Error('failed'), {
        isAxiosError: true,
        response: {status: result.status, data: result.data, headers: new AxiosHeaders(), config, statusText: ''},
        config,
        toJSON: () => ({}),
      });
      throw error;
    }
    return {data: result.data, status: result.status, statusText: 'OK', headers: new AxiosHeaders(), config};
  };

  const service = createTokenService({
    baseURL: 'https://api.test',
    storage,
    storageKeys: DEFAULT_STORAGE_KEYS,
    onUnauthorized,
    axiosConfig: {adapter},
  });

  return {service, storage, calls, onUnauthorized};
}

function tokens(prefix: string, expiresIn = 3600) {
  return {accessToken: `${prefix}-access`, refreshToken: `${prefix}-refresh`, expiresIn};
}
```

`axiosConfig` is a config field whose only purpose is letting a test supply an adapter.
That is a legitimate seam, not a test hook bolted on: a consumer behind a corporate proxy
needs it too. Document it as such.

- [ ] **Step 2: Write the failing happy-path tests**

```ts
describe('login', () => {
  it('stores the tokens it receives', async () => {
    const {service, storage} = setup();
    await service.login('a@b.c', 'pw');

    expect(storage.getItem(DEFAULT_STORAGE_KEYS.accessToken)).toBe('fresh-access');
    expect(storage.getItem(DEFAULT_STORAGE_KEYS.refreshToken)).toBe('fresh-refresh');
  });

  it('posts to the configured login endpoint', async () => {
    const {service, calls} = setup();
    await service.login('a@b.c', 'pw');

    expect(calls[0]?.url).toBe('/v1/auth/login');
    expect(calls[0]?.body).toEqual({email: 'a@b.c', password: 'pw'});
  });

  it('throws an ApiError carrying the backend message', async () => {
    const {service} = setup({respond: () => ({status: 401, data: {message: 'Bad credentials'}})});

    await expect(service.login('a@b.c', 'pw')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Bad credentials',
    });
  });
});

describe('getAccessToken', () => {
  it('returns a stored token that is still valid without a request', async () => {
    const {service, calls} = setup();
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await expect(service.getAccessToken()).resolves.toBe('fresh-access');
    expect(calls).toHaveLength(0);
  });

  it('refreshes when the stored token has expired', async () => {
    const {service, calls} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 200, data: {success: true, data: tokens('second')}},
    });
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await expect(service.getAccessToken()).resolves.toBe('second-access');
    expect(calls[0]?.url).toBe('/v1/auth/refresh-token');
  });

  it('returns null with nothing stored', async () => {
    const {service, calls} = setup();
    await expect(service.getAccessToken()).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('sends one refresh POST for many concurrent callers', async () => {
    const {service, calls} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 200, data: {success: true, data: tokens('second')}},
    });
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await Promise.all([service.getAccessToken(), service.getAccessToken(), service.getAccessToken()]);

    expect(calls.filter((c) => c.url === '/v1/auth/refresh-token')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run, fail, write the first half of token-service.ts**

The config type, the closure state, `authAxios`, the storage helpers wired to the token
store, `login`, `getAccessToken`, `hasTokens`, `storeSession`, `clearTokens`, and the
dedupe in `refreshAccessToken`. Leave the transient backoff and the session-generation
checks for the next step; the tests above do not reach them.

Run: PASS, 9 tests.

- [ ] **Step 4: Write the failing tests for the four mechanisms**

```ts
describe('a refresh that outlives its session', () => {
  it('does not write tokens back after logout', async () => {
    let releaseRefresh: (() => void) | undefined;
    const {service, storage} = setup({
      respond: (call) => {
        if (call.url !== '/v1/auth/refresh-token') return {status: 200, data: {success: true, data: tokens('first', 10)}};
        return {status: 200, data: {success: true, data: tokens('late')}};
      },
    });
    // Hold the refresh open with a deferred adapter; see the note below.
    await service.login('a@b.c', 'pw');
    const pending = service.getAccessToken();
    await service.logout();
    releaseRefresh?.();
    await pending;

    expect(storage.getItem(DEFAULT_STORAGE_KEYS.accessToken)).toBeNull();
  });

  it('does not clear tokens a newer session owns when a stale refresh fails', async () => {
    // Same shape: start a refresh, log in as someone else while it is in flight,
    // fail the refresh, assert the new session's tokens survive.
  });
});

describe('transient failures', () => {
  it('keeps the session alive when the refresh cannot reach the server', async () => {
    const {service, storage, onUnauthorized} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 503},
    });
    await service.login('a@b.c', 'pw');

    await expect(service.getAccessToken()).resolves.toBeNull();
    expect(storage.getItem(DEFAULT_STORAGE_KEYS.refreshToken)).toBe('first-refresh');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([408, 429, 500, 503])('treats %i as transient', async (status) => {
    // assert the refresh token survives
  });

  it('ends the session on a deterministic rejection', async () => {
    const {service, storage, onUnauthorized} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 400, data: {message: 'refreshToken must be a UUID'}},
    });
    await service.login('a@b.c', 'pw');
    await service.getAccessToken();

    expect(storage.getItem(DEFAULT_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('sends one refresh POST during the backoff, not one per caller', async () => {
    vi.useFakeTimers();
    const {service, calls} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 503},
    });
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await service.getAccessToken();
    await service.getAccessToken();
    await service.getAccessToken();

    expect(calls.filter((c) => c.url === '/v1/auth/refresh-token')).toHaveLength(1);
    service.dispose();
  });

  it('retries once the backoff elapses', async () => {
    // advance 30_000 with fake timers, assert a second refresh POST goes out
  });

  it('ends the session on a malformed 2xx body', async () => {
    const {service, storage} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 200, data: {success: true, data: {accessToken: 'x'}}},
    });
    await service.login('a@b.c', 'pw');
    await service.getAccessToken();

    expect(storage.getItem(DEFAULT_STORAGE_KEYS.refreshToken)).toBeNull();
  });
});

describe('forceRefresh', () => {
  it('reuses a different stored token rather than spending a rotation', async () => {
    const {service, storage, calls} = setup();
    await service.login('a@b.c', 'pw');
    // Another tab refreshed: storage now holds a token the 401 was not about.
    storage.setItem(DEFAULT_STORAGE_KEYS.accessToken, 'other-tab-access');
    calls.length = 0;

    await expect(service.forceRefresh('fresh-access')).resolves.toBe('other-tab-access');
    expect(calls).toHaveLength(0);
  });

  it('refreshes when the rejected token is the one still stored', async () => {
    const {service, calls} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first')}}
          : {status: 200, data: {success: true, data: tokens('second')}},
    });
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await expect(service.forceRefresh('first-access')).resolves.toBe('second-access');
    expect(calls[0]?.url).toBe('/v1/auth/refresh-token');
  });

  it('forces a refresh when no rejected token is given', async () => {
    // assert a POST goes out even though the stored token is still valid
  });

  it('clears a transient backoff so the refresh actually runs', async () => {
    // fail once transiently, then forceRefresh, and assert a POST goes out
    // rather than being swallowed by refreshBlockedUntil
  });
});

describe('restoreSession', () => {
  it('returns false with nothing stored', async () => {
    const {service} = setup();
    await expect(service.restoreSession()).resolves.toBe(false);
  });

  it('returns true and arms the timer for a valid stored token', async () => {
    const {service, calls} = setup();
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await expect(service.restoreSession()).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('reports a restored session when a startup refresh fails transiently', async () => {
    // A network blip on startup must not present as being signed out.
    const {service} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 503},
    });
    await service.login('a@b.c', 'pw');

    await expect(service.restoreSession()).resolves.toBe(true);
  });

  it('reports no session when the refresh token is rejected', async () => {
    // same, with a 400: restoreSession resolves false
  });
});

describe('logout', () => {
  it('refreshes a stale access token before calling logout, so the server session dies', async () => {
    const {service, calls} = setup({
      respond: (call) =>
        call.url === '/v1/auth/login'
          ? {status: 200, data: {success: true, data: tokens('first', 10)}}
          : {status: 200, data: {success: true, data: tokens('second')}},
    });
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await service.logout();

    expect(calls.map((c) => c.url)).toEqual(['/v1/auth/refresh-token', '/v1/auth/logout']);
  });

  it('uses the logout-all endpoint when asked', async () => {
    const {service, calls} = setup();
    await service.login('a@b.c', 'pw');
    calls.length = 0;

    await service.logout(true);

    expect(calls.at(-1)?.url).toBe('/v1/auth/logout-all');
  });

  it('clears tokens even when the logout call fails', async () => {
    const {service, storage} = setup({
      respond: (call) => (call.url.includes('logout') ? {status: 500} : {status: 200, data: {success: true, data: tokens('first')}}),
    });
    await service.login('a@b.c', 'pw');

    await service.logout();

    expect(storage.getItem(DEFAULT_STORAGE_KEYS.refreshToken)).toBeNull();
  });
});

describe('dispose', () => {
  it('leaves no timer behind', async () => {
    vi.useFakeTimers();
    const {service, calls} = setup();
    await service.login('a@b.c', 'pw');
    service.dispose();
    calls.length = 0;

    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(calls).toHaveLength(0);
  });
});
```

Fill in every case marked with a comment; they are described, not written, to keep this
task readable, and a plan that ships those comments as code has failed. For the two
"outlives its session" cases, extend `setup` with a deferred adapter: have `respond` return
a promise the test resolves by hand, so the refresh can be held open across a `logout()`.

- [ ] **Step 5: Run, fail, finish token-service.ts**

Port the remaining machinery. Do not simplify any of the four mechanisms while porting.
Each one exists because of a bug that reached production, and each has a test above that
fails if it is removed.

Run: `pnpm --filter @bohar/api-client test token-service`
Expected: PASS, roughly 30 tests.

- [ ] **Step 6: Check the Web Lock path**

`navigator.locks` does not exist in Node, so the node-environment tests exercise the
fallback branch. Add one case in a `token-service.dom.test.ts` that stubs
`navigator.locks.request` with a pass-through and asserts it was called with the configured
lock name, so the branch is covered rather than assumed.

- [ ] **Step 7: Export and hand off**

```ts
export {createTokenService} from './token-service';
export type {AuthEndpoints, AuthTokens, TokenService, TokenServiceConfig} from './token-service';
```

```
feat(api-client): the refresh-token service
```

---

### Task 5: createApiClient, with the 401 interceptor

**Files:**

- Create: `packages/api-client/src/client.ts`
- Test: `packages/api-client/src/client.test.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**

- Consumes: everything from Tasks 1 through 4.
- Produces:
  - `createApiClient(config: ApiClientConfig): ApiClient` where
    `ApiClient = {api: ApiMethods; axiosInstance: AxiosInstance; tokenService: TokenService; dispose(): void}`.
  - `interface ApiClientConfig`: the whole public configuration surface.

`ApiClientConfig`, in full, because it is the thing a consumer reads first:

```ts
export interface ApiClientConfig {
  /** Base URL for every request. */
  readonly baseURL: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  readonly timeout?: number;
  /** Sent as `x-tenant-id` on every request, including the auth calls. */
  readonly tenantId?: string;
  /** Extra static headers. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Header carrying the caller's IANA time zone, so the API can anchor
   * operator-scoped "today" comparisons instead of falling back to UTC.
   * Pass `false` to send nothing. Default `'X-Timezone'`.
   */
  readonly timezoneHeader?: string | false;
  /** Where tokens live. Default: localStorage, or memory where it is unavailable. */
  readonly storage?: TokenStorage;
  readonly storageKeys?: StorageKeys;
  readonly endpoints?: Partial<AuthEndpoints>;
  readonly messages?: ErrorMessages;
  /** Called when the session is definitively gone. Redirect to login from here. */
  readonly onUnauthorized?: () => void;
  /** Cross-tab refresh lock name. Change it if two apps share an origin. */
  readonly lockName?: string;
  /** Diagnostics. Nothing is written to the console unless you pass this. */
  readonly logger?: {debug?: (message: string, data?: unknown) => void; error?: (message: string, error: unknown) => void};
  /** Escape hatch for adapters and proxy settings. Merged into both axios instances. */
  readonly axiosConfig?: AxiosRequestConfig;
}
```

- [ ] **Step 1: Write the failing test**

```ts
describe('createApiClient request interceptor', () => {
  it('attaches the bearer token', async () => {
    // login, then GET, assert Authorization: Bearer fresh-access
  });

  it('sends no Authorization header when there is no session', async () => {
    // GET with empty storage, assert the header is absent rather than 'Bearer null'
  });

  it('sends the tenant id', async () => {
    // assert x-tenant-id: 'ADMIN' on the outgoing config
  });

  it('sends the resolved IANA time zone', async () => {
    // assert X-Timezone matches Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  it('sends no time zone header when disabled', async () => {
    // timezoneHeader: false
  });
});

describe('createApiClient 401 handling', () => {
  it('refreshes and replays the request once', async () => {
    // first GET 401s, refresh succeeds, replayed GET carries the new token and 200s
    // assert the caller sees the successful payload, not the 401
  });

  it('gives up after two replays and ends the session', async () => {
    // every GET 401s; assert exactly 3 GETs went out (original + 2 replays),
    // that onUnauthorized fired, and that storage is empty
  });

  it('does not end the session when the refresh fails transiently', async () => {
    // GET 401s, refresh 503s: onUnauthorized must NOT fire and the refresh token stays
  });

  it('passes the rejected token to forceRefresh', async () => {
    // assert the refresh POST went out rather than the stored token being reused,
    // which is only correct if the rejected token was compared against storage
  });

  it('throws an ApiError, not a raw AxiosError, for a non-401', async () => {
    // 500 → rejects with name 'ApiError' and code SERVER_ERROR
  });

  it('does not retry a 403', async () => {
    // assert exactly one GET
  });

  it('rejects without a retry when the error carries no config', async () => {
    // the `if (!originalRequest)` branch
  });
});
```

Every one of these is described rather than written, for length. Write them out in full
using the same stub-adapter approach as Task 4, where the adapter dispatches on
`config.url` and can be made to fail a fixed number of times.

- [ ] **Step 2: Run, fail, write client.ts**

Assemble: build the two axios instances from the config, create the token store, create the
token service, install the two interceptors, and return the four fields. The 401 logic ports
from `instance.ts` unchanged apart from `console.error` becoming `logger?.error` and the
CustomEvent becoming `onUnauthorized?.()`.

Keep `MAX_AUTH_RETRIES = 2` and its comment. The reason for two rather than one is subtle
and stated in the source: the first attempt may hand back a token another tab just
refreshed, and only the second forces a real rotation.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @bohar/api-client test client`
Expected: PASS, 13 tests.

- [ ] **Step 4: Export and hand off**

```ts
export {createApiClient} from './client';
export type {ApiClient, ApiClientConfig} from './client';
```

```
feat(api-client): createApiClient and the 401 retry
```

---

### Task 6: Permissions

**Files:**

- Create: `packages/api-client/src/permissions.ts`
- Test: `packages/api-client/src/permissions.test.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**

- Consumes: nothing. These are pure functions and stay that way.
- Produces:
  - `interface PermissionTreeNode {key: string; type?: string; children?: PermissionTreeNode[]}`.
  - `formatPermissions(tree): string[]`, `hasPermission`, `hasAnyPermission`, `hasAllPermissions`.
  - `createPermissionGuards(options): {requirePermission, requireAnyPermission, requireAllPermissions}`.

The app's `route-permission-check.ts` imports `redirect` from `@tanstack/react-router`,
`ROUTES`, `getAdminInitQueryOptions`, `tokenService` and `AdminInitResponse`. All five are
app facts. The factory takes two functions instead and the package never learns what a
router is:

```ts
interface PermissionGuardOptions {
  /**
   * Resolves the current user's flat permission list, or `null` when there is no
   * session. Returning `null` lets the guard fall through so the app's own
   * unauthenticated redirect handles it, rather than firing an API call that 401s.
   */
  readonly loadPermissions: () => Promise<readonly string[] | null>;
  /** Called when the check fails. Throw the router's redirect from here. */
  readonly onDenied: () => never;
}
```

- [ ] **Step 1: Write the failing test**

```ts
import {describe, expect, it, vi} from 'vitest';

import {
  createPermissionGuards,
  formatPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from './permissions';

describe('formatPermissions', () => {
  it('returns an empty list for null', () => {
    expect(formatPermissions(null)).toEqual([]);
  });

  it('returns an empty list for undefined', () => {
    expect(formatPermissions(undefined)).toEqual([]);
  });

  it('joins a module and its action with a colon', () => {
    expect(formatPermissions([{key: 'ADMIN', children: [{key: 'VIEW', type: 'action'}]}])).toEqual(['ADMIN:VIEW']);
  });

  it('joins nested modules with dots', () => {
    const tree = [
      {
        key: 'ROUTE',
        children: [
          {key: 'VIEW', type: 'action'},
          {key: 'INSTANCE', children: [{key: 'VIEW', type: 'action'}]},
        ],
      },
    ];
    expect(formatPermissions(tree)).toEqual(['ROUTE:VIEW', 'ROUTE.INSTANCE:VIEW']);
  });

  it('handles three levels', () => {
    const tree = [{key: 'A', children: [{key: 'B', children: [{key: 'C', children: [{key: 'VIEW', type: 'action'}]}]}]}];
    expect(formatPermissions(tree)).toEqual(['A.B.C:VIEW']);
  });

  it('skips a module with no children', () => {
    expect(formatPermissions([{key: 'EMPTY'}])).toEqual([]);
  });
});

describe('predicates', () => {
  const owned = ['ADMIN:VIEW', 'ADMIN:EDIT'];

  it('hasPermission', () => {
    expect(hasPermission(owned, 'ADMIN:VIEW')).toBe(true);
    expect(hasPermission(owned, 'ADMIN:DELETE')).toBe(false);
  });

  it('hasAnyPermission', () => {
    expect(hasAnyPermission(owned, ['ADMIN:DELETE', 'ADMIN:EDIT'])).toBe(true);
    expect(hasAnyPermission(owned, ['ADMIN:DELETE'])).toBe(false);
  });

  it('hasAnyPermission on an empty requirement list is false', () => {
    expect(hasAnyPermission(owned, [])).toBe(false);
  });

  it('hasAllPermissions', () => {
    expect(hasAllPermissions(owned, ['ADMIN:VIEW', 'ADMIN:EDIT'])).toBe(true);
    expect(hasAllPermissions(owned, ['ADMIN:VIEW', 'ADMIN:DELETE'])).toBe(false);
  });

  it('hasAllPermissions on an empty requirement list is true', () => {
    expect(hasAllPermissions(owned, [])).toBe(true);
  });
});

describe('createPermissionGuards', () => {
  function guards(permissions: readonly string[] | null) {
    const onDenied = vi.fn(() => {
      throw new Error('denied');
    }) as unknown as () => never;
    return {
      ...createPermissionGuards({loadPermissions: async () => permissions, onDenied}),
      onDenied,
    };
  }

  it('allows a permitted route', async () => {
    const {requirePermission} = guards(['ADMIN:VIEW']);
    await expect(requirePermission('ADMIN:VIEW')()).resolves.toBeUndefined();
  });

  it('denies a route the user lacks', async () => {
    const {requirePermission} = guards(['ADMIN:VIEW']);
    await expect(requirePermission('ADMIN:DELETE')()).rejects.toThrow('denied');
  });

  it('falls through when there is no session', async () => {
    // loadPermissions returning null must NOT deny: the app's own auth redirect
    // handles an unauthenticated deep link, and denying here sends the user to
    // an access-denied page instead of to login.
    const {requirePermission, onDenied} = guards(null);
    await expect(requirePermission('ADMIN:DELETE')()).resolves.toBeUndefined();
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('allows when any permission matches', async () => {
    const {requireAnyPermission} = guards(['ADMIN:VIEW']);
    await expect(requireAnyPermission(['ADMIN:DELETE', 'ADMIN:VIEW'])()).resolves.toBeUndefined();
  });

  it('denies when none match', async () => {
    const {requireAnyPermission} = guards(['ADMIN:VIEW']);
    await expect(requireAnyPermission(['ADMIN:DELETE'])()).rejects.toThrow('denied');
  });

  it('denies unless every permission is held', async () => {
    const {requireAllPermissions} = guards(['ADMIN:VIEW']);
    await expect(requireAllPermissions(['ADMIN:VIEW', 'ADMIN:EDIT'])()).rejects.toThrow('denied');
  });
});
```

- [ ] **Step 2: Run, fail, write permissions.ts**

Port the four pure functions verbatim, with `PermissionTreeNode` defined locally rather than
imported from a domain types file. Write the guard factory fresh; it is a rewrite, not a
port, and it is three near-identical eight-line functions.

Include the app's usage example in the doc comment, rewritten for the new shape:

```ts
/**
 * @example
 * ```ts
 * const {requirePermission} = createPermissionGuards({
 *   loadPermissions: async () => {
 *     if (!tokenService.hasTokens()) return null;
 *     const init = await queryClient.ensureQueryData(adminInitQueryOptions());
 *     return formatPermissions(init.user?.permissions);
 *   },
 *   onDenied: () => {
 *     throw redirect({to: ROUTES.ACCESS_DENIED});
 *   },
 * });
 *
 * const rolesRoute = createRoute({path: '/roles', beforeLoad: requirePermission('ADMIN_ROLE:VIEW')});
 * ```
 */
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @bohar/api-client test permissions`
Expected: PASS, 18 tests.

- [ ] **Step 4: Export and hand off**

```ts
export {createPermissionGuards, formatPermissions, hasAllPermissions, hasAnyPermission, hasPermission} from './permissions';
export type {PermissionTreeNode} from './permissions';
```

```
feat(api-client): permission predicates and route guards
```

---

### Task 7: The React entry

**Files:**

- Create: `packages/api-client/src/react/query-client.ts`
- Create: `packages/api-client/src/react/context.tsx`
- Create: `packages/api-client/src/react/hooks.ts`
- Create: `packages/api-client/src/react/index.ts`
- Test: `packages/api-client/src/react/query-client.test.ts`
- Test: `packages/api-client/src/react/hooks.test.tsx`

**Interfaces:**

- Consumes: `ApiError`, `isApiError`, `isNetworkOrTimeoutError` (Task 1).
- Produces:
  - `createQueryClient(options?)`: the retry policy, `staleTime`, `refetchOnWindowFocus`.
  - `<ApiClientProvider notify? children>` and `useApiClientOptions()`.
  - `useAppQuery`, `useAppMutation`.

Two things change from the app version. `toastUtil` becomes an injected
`notify?: {error: (message: string) => void}`, so the package does not depend on `sonner`.
And the provider does **not** render `QueryClientProvider` or the devtools: the consumer
already renders those, and a library that renders a second `QueryClientProvider` silently
gives half the app a different cache.

- [ ] **Step 1: Write the failing query-client test**

```ts
import {describe, expect, it} from 'vitest';

import {ApiError, ErrorCode} from '../error';
import {createQueryClient} from './query-client';

function retryFn() {
  const client = createQueryClient();
  const retry = client.getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('expected a retry predicate');
  return retry;
}

describe('createQueryClient', () => {
  it('retries a network error once', () => {
    const error = new ApiError(0, ErrorCode.NETWORK_ERROR, 'offline');
    expect(retryFn()(0, error)).toBe(true);
    expect(retryFn()(1, error)).toBe(false);
  });

  it('retries a 500', () => {
    expect(retryFn()(0, new ApiError(500, ErrorCode.SERVER_ERROR, 'boom'))).toBe(true);
  });

  it.each([408, 429])('retries a transient %i', (status) => {
    expect(retryFn()(0, new ApiError(status, ErrorCode.UNKNOWN, 'slow'))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])('does not retry a deterministic %i', (status) => {
    expect(retryFn()(0, new ApiError(status, ErrorCode.UNKNOWN, 'no'))).toBe(false);
  });

  it('retries a non-ApiError once', () => {
    expect(retryFn()(0, new Error('boom'))).toBe(true);
  });

  it('uses a one minute stale time by default', () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(60_000);
  });

  it('does not refetch on window focus', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it('lets a caller override the defaults', () => {
    const client = createQueryClient({staleTime: 5000, refetchOnWindowFocus: true});
    expect(client.getDefaultOptions().queries?.staleTime).toBe(5000);
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
  });
});
```

- [ ] **Step 2: Run, fail, write query-client.ts**

Port `shouldRetry` unchanged and expose `createQueryClient(options?: {staleTime?: number; refetchOnWindowFocus?: boolean; maxRetries?: number})`. A factory rather than the app's
module-level `const queryClient`: a library that instantiates a QueryClient at import time
creates one in every test file that imports it, and in SSR shares a cache across requests.

The app's `getQueryContext()` does not come along. It exists to feed the TanStack Router
context and is three lines the consumer writes themselves.

Run: PASS, 13 tests.

- [ ] **Step 3: Write context.tsx**

```tsx
interface ApiClientOptions {
  /** Where a toast goes. Without it, nothing is shown and errors are returned only. */
  readonly notify?: {readonly error: (message: string) => void};
}
```

Same pattern as every labels context in the repo: a context whose default value is a real
object (`{}` here), so a hook used outside the provider still works.

- [ ] **Step 4: Write the failing hooks test**

```tsx
describe('useAppMutation', () => {
  it('exposes a friendly message on the error field', async () => {
    // mutationFn rejects with an ApiError carrying 'Email taken';
    // assert result.current.error === 'Email taken' and rawError is the ApiError
  });

  it('clears the message on the next success', async () => {
    // fail, then succeed, assert error goes back to null
  });

  it('clears the message when clearError is called', async () => {
    // ...
  });

  it('does not notify by default', async () => {
    // showToast omitted, a 422 rejection: notify.error must not be called
  });

  it('notifies when showToast is set', async () => {
    // ...
  });

  it('notifies for a network error even without showToast', async () => {
    // this is the isNetworkOrTimeoutError branch and the reason it exists:
    // an offline failure is never a form-level message
  });

  it('still calls the caller onSuccess and onError', async () => {
    // ...
  });
});

describe('useAppQuery', () => {
  it('exposes a friendly message on the error field', async () => {
    // ...
  });

  it('notifies once per error, not once per render', async () => {
    // rerender three times against the same failed query;
    // assert notify.error was called exactly once
  });

  it('notifies again for a different error', async () => {
    // ...
  });

  it('does not notify a validation error by default', async () => {
    // ...
  });
});
```

Write each out in full with `renderHook` from `@testing-library/react`, wrapping in both a
`QueryClientProvider` (with `retry: false`) and the `ApiClientProvider`.

"Notifies once per error, not once per render" is the case the app's `lastErrorRef` exists
for, and the one a refactor to a plain `useEffect` dependency array quietly breaks into a
toast storm.

- [ ] **Step 5: Run, fail, port the hooks**

Two changes: `toastUtil.error(error)` becomes `notify?.error(getErrorMessage(error))`, and
`getErrorMessage` is imported from the error module rather than redefined locally, since it
is now exported.

Keep `networkMode: 'always'` on both. It is what makes a request go out at all when the
browser reports itself offline, which it gets wrong often enough to matter.

Run: PASS, 11 tests.

- [ ] **Step 6: Write `react/index.ts` and hand off**

```ts
export {ApiClientProvider, useApiClientOptions} from './context';
export type {ApiClientOptions} from './context';
export {useAppMutation, useAppQuery} from './hooks';
export type {UseAppMutationOptions, UseAppQueryOptions} from './hooks';
export {createQueryClient} from './query-client';
```

```
feat(api-client): query client, provider and hooks
```

---

### Task 8: Entry points and build verification

**Files:**

- Modify: `packages/api-client/src/index.ts`
- Test: `packages/api-client/src/index.test.ts`

- [ ] **Step 1: Write the final root entry point**

Grouped and commented, in this order: the client factory and its config; the error layer;
the token service; storage; permissions; shared types. Nothing from `./react` is re-exported
from the root, or importing the root pulls React into a Node consumer.

- [ ] **Step 2: Write a test that pins the public surface**

```ts
import {describe, expect, it} from 'vitest';

import * as api from './index';

describe('public surface', () => {
  it('exports exactly what is documented', () => {
    expect(Object.keys(api).sort()).toEqual([
      'ApiError',
      'DEFAULT_MESSAGES',
      'DEFAULT_STORAGE_KEYS',
      'ErrorCode',
      'createApiClient',
      'createApiError',
      'createApiMethods',
      'createLocalStorageAdapter',
      'createMemoryStorage',
      'createPermissionGuards',
      'createTokenService',
      'createTokenStore',
      'formatPermissions',
      'getErrorCode',
      'getErrorMessage',
      'hasAllPermissions',
      'hasAnyPermission',
      'hasPermission',
      'isApiError',
      'isNetworkOrTimeoutError',
      'unwrapResponse',
    ]);
  });
});
```

A test that fails whenever the surface changes is the point. This repo's rule is that
anything in `index.ts` is a semver-major to remove; the test makes adding one a deliberate
act with a visible diff rather than a side effect of an editor auto-import.

Adjust the expected list to whatever the entry actually exports, sorted, and keep them in
step.

- [ ] **Step 3: Verify the root entry is React-free**

Run `pnpm --filter @bohar/api-client build`, then:

```bash
grep -rl "react" packages/api-client/dist --include="*.js" | grep -v "^packages/api-client/dist/react/" | sort
```

Expected: no output. If a file outside `dist/react/` mentions React, the root entry has
picked up a React import and a Node consumer now needs React installed.

Also confirm both entries exist:

```bash
ls packages/api-client/dist/index.js packages/api-client/dist/react/index.js
```

- [ ] **Step 4: Run the whole suite**

Run: `pnpm --filter @bohar/api-client test`
Expected: PASS, roughly 130 tests.

- [ ] **Step 5: Hand off for commit**

```
feat(api-client): finalise the public surface
```

---

### Task 9: README, changeset, and close the plan

**Files:**

- Create: `packages/api-client/README.md`
- Create: `.changeset/<generated-name>.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/README.md`
- Modify: `docs/extraction/README.md`
- Move: this file to `docs/superpowers/plans/done/`

- [ ] **Step 1: Write the README**

Sections, in order:

1. **What it is**, and the honest scope line: this is an axios client shaped around one
   specific backend contract, not a general HTTP library.
2. **Backend contract**, with the five points from this plan's precondition section and the
   answer that was found for each. This is the section that tells the next reader whether
   the package fits their API at all, so it goes near the top rather than in an appendix.
3. **Setup**, one `createApiClient` call with every config field shown and commented.
4. **The token service**, with the four mechanisms described in a paragraph each. Someone
   evaluating this package is choosing it for exactly these, and they are invisible from the
   type signatures.
5. **React**, the `./react` subpath: `createQueryClient`, `ApiClientProvider`, the two hooks.
6. **Permissions**, with the guard factory example.
7. **Errors**, the `ErrorCode` table and `resolveBackendKey`.
8. **Testing against it**, showing `axiosConfig.adapter` and `createMemoryStorage()`.

- [ ] **Step 2: Add the row to the root README**

```
| `packages/api-client` | Axios client, refresh-token service and React Query layer for the admin APIs | ported, not published |
```

- [ ] **Step 3: Record the precondition's answer**

Update the "4. `@bohar/api-client`" section of
[`docs/extraction/README.md`](../../../extraction/README.md) to say what was found about the
envelope, so the paragraph telling the next reader to confirm it becomes a paragraph telling
them what was confirmed.

- [ ] **Step 4: Write the changeset**

`pnpm changeset`, select `@bohar/api-client`, **minor**:

```
Initial release. An axios client with bearer auth, a refresh-token service that
coordinates across tabs and survives an outage without signing the user out, permission
predicates and route guards, and an optional `@bohar/api-client/react` entry with a
configured QueryClient and error-aware query and mutation hooks.
```

- [ ] **Step 5: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS.

- [ ] **Step 6: Close the plan**

```bash
mv docs/superpowers/plans/open/2026-08-28-api-client-package.md \
   docs/superpowers/plans/done/2026-08-28-api-client-package.md
```

Move the row in `docs/superpowers/plans/README.md` from Open to Done and fix its link.

- [ ] **Step 7: Hand off for commit**

```
feat(api-client): README, changeset, first release prep
```

---

## Out of scope

**`lib/toast`.** Four functions over `sonner`, and the package now takes a `notify`
callback instead. Publishing a toast wrapper would make `sonner` a peer of an HTTP client.

**`lib/sse`, `lib/pwa`, `lib/firebase`, `lib/zod`.** Separate concerns that happen to live
in the same `lib/` directory. `sse-client` has its own proposal in
[`docs/extraction/sse-client.md`](../../../extraction/sse-client.md); the rest are below the
size where a package pays for itself.

**A generated API surface.** The endpoints map, the domain types and the service functions
stay in each app. They are the part that genuinely differs between the four, and a shared
`API_ENDPOINTS` would be a coordinated release every time one backend adds a route.

**Adopting the package in the apps.** Needs the package published. When it lands,
`src/lib/axios/`, `src/lib/auth/` and `src/lib/react-query/` collapse into one
`createApiClient` call in `src/lib/api.ts`.

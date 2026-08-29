# Proposal: `@bohar/sse-client`

**Status:** deferred, 2026-08-28. **Source:** `skipwash-admin/src/lib/sse/sse-client.ts`, 141 loc.
**Apps using it:** 1 of 4.

## What it is

A server-sent events client built on `fetch` and a `ReadableStream` rather than the
platform's `EventSource`, because `EventSource` cannot send headers and the stream needs
both `Authorization: Bearer` and `x-tenant-id`. That constraint alone is why the file
exists, and it is the reason the same file will get written again by anyone whose SSE
endpoint sits behind a bearer token.

What it does beyond the reading loop:

- Frames events on the blank-line boundary, keeping the partial trailing event in a buffer
  across chunk boundaries. The naive version splits each chunk on `\n\n` and silently
  drops any event that straddles a TCP packet.
- Drops `event: heartbeat` before it reaches the consumer, so a keepalive does not look
  like data.
- Skips malformed JSON instead of throwing inside the read loop, where a throw would kill
  the connection permanently.
- Reconnects on any failure after a delay, with a `closed` flag checked at every await
  point so a component unmounting mid-read does not schedule a reconnect.
- Stops reconnecting after three consecutive 401 or 403 responses, and resets that counter
  on the first success. Without the cap, an expired session turns into a reconnect loop
  hammering the API every five seconds for as long as the tab is open.
- Distinguishes an `AbortError` from a real failure, so a deliberate close is silent.

## Why it is deferred

One consumer. Everything else in the survey is duplicated in at least two forks, which is
the evidence that the abstraction is right; this has no such evidence. A first extraction
from a single site tends to publish one app's assumptions as an API, and then the second
consumer arrives and needs the shape changed, which is a breaking release on a package
nobody has used yet.

There is also a small honest problem: 141 lines of good code is under the size where a
package pays for its own README, changeset, peer matrix and release. It is worth publishing
when it is either bigger or shared, and right now it is neither.

## What would change the answer

Any one of these:

- A second app needs authenticated SSE. That is the reuse proof, and it flips this
  immediately.
- The reconnect policy grows up. Right now it is a fixed five-second delay with no jitter
  and no ceiling on total attempts. A backend restart therefore produces a thundering herd
  of every open tab reconnecting on the same schedule. Adding exponential backoff with
  jitter, `Last-Event-ID` replay, and an online/offline listener would roughly double the
  size and put it clearly past the threshold.
- `@bohar/api-client` ships. The two share a bearer token, a base URL, a tenant header and
  a 401 policy, and the SSE client currently imports `tokenService` and `env` directly. If
  the API client exists, this becomes `createApiClient(...).createEventStream(url)` reusing
  the config that is already there, which is a subpath on an existing package rather than
  a new one.

The third is the likely path. Revisit it when
[`../superpowers/plans/open/2026-08-28-api-client-package.md`](../superpowers/plans/open/2026-08-28-api-client-package.md)
is done.

## What it would take

Small. Two app imports to invert:

| Now | Would become |
| --- | --- |
| `env.VITE_API_BASE_URL` | `baseURL` in options |
| `tokenService.getAccessToken()` | `getToken: () => Promise<string \| null>` in options |
| `'x-tenant-id': 'ADMIN'` hardcoded | `headers` in options |

Everything else is already parameterised. `MAX_AUTH_RETRIES = 3` and the 5000ms delay would
become options with the current values as defaults.

Testing is straightforward and worth listing, because it is the part that makes this
publishable rather than copied: a fake `fetch` returning a `ReadableStream` the test pushes
chunks into covers event framing across chunk boundaries, heartbeat filtering, malformed
JSON, the reconnect delay under fake timers, the auth cap, and abort-on-close. None of that
needs a network or a browser.

## Recommendation

Do not extract on its own. When `@bohar/api-client` lands, port this into it as
`@bohar/api-client/sse` and keep the tests. If a second app needs it before that, extract it
standalone at that point.

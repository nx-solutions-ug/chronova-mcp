# API client and errors

## `ChronovaClient` (`src/lib/chronova-client.ts`)

A thin wrapper around the global `fetch` with three responsibilities: base-URL normalization, auth header, timeout.

```ts
new ChronovaClient(baseUrl?, apiKey?)
  .get<T>(path, params?) // -> Promise<T>
```

Behavior:

- **Base URL:** trailing slash is enforced. `new URL("users/current", "https://host/api/v1")` resolves to `https://host/users/current` (wrong); with a trailing slash it resolves to `https://host/api/v1/users/current` (correct). The class always appends `/` if missing.
- **Defaults:** reads `CHRONOVA_API_URL` and `CHRONOVA_API_KEY` from `process.env` when not passed explicitly.
- **Auth:** every request sends `Authorization: Bearer <key>` and `Accept: application/json`.
- **Timeout:** 30 seconds via `AbortSignal.timeout(DEFAULT_TIMEOUT_MS)`.
- **Query params:** any value that is `undefined` or `""` is skipped so empty filters don't end up in the URL.
- **Error mapping:**
  - Non-2xx responses are converted to a `ChronovaApiError` by `mapHttpStatusToError(response, url)`.
  - `TypeError` (network failure) and `AbortError` (timeout) are converted to a `ChronovaApiError` by `mapNetworkError(error, url)`.
  - Anything else is re-thrown as-is and surfaces to the tool handler.

Only `GET` is implemented. There are no write endpoints in the current API.

## `ChronovaApiError` (`src/lib/errors.ts`)

```ts
class ChronovaApiError extends Error {
  statusCode: number;       // HTTP status, or 0 for network errors
  code: string;             // "UNAUTHORIZED" | "RATE_LIMITED" | "NOT_FOUND" | "SERVER_ERROR" | "API_ERROR" | "CONNECTION_ERROR"
  retryAfter?: number;      // seconds, only set for 429
}
```

Tool handlers catch `ChronovaApiError` specifically and return its `message` as an `isError: true` text block, so the message is what the agent actually sees.

## HTTP status → error mapping

`mapHttpStatusToError` in `src/lib/errors.ts`:

| Status | Code | Message strategy |
|---|---|---|
| 401 | `UNAUTHORIZED` | `"Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration."` |
| 404 | `NOT_FOUND` | `"Not found: The requested resource does not exist."` |
| 429 | `RATE_LIMITED` | Reads `Retry-After` (seconds) or falls back to `X-RateLimit-Reset` (epoch seconds, clamped to `>= 0`). Message includes the wait: `"Rate limited: Too many requests. Retry after N seconds."` |
| 5xx | `SERVER_ERROR` | `"Chronova server error: <statusText>. Please try again later."` |
| other | `API_ERROR` | `"Chronova API error: <status> <statusText>"` |

The `Retry-After` parser is intentionally lenient: it accepts any numeric value and falls back to the rate-limit reset header. The message only includes the suffix when a value is known.

## Network errors

`mapNetworkError` always returns:

```
Cannot connect to Chronova at <url>. Check CHRONOVA_API_URL configuration.
```

with `statusCode: 0` and `code: "CONNECTION_ERROR"`. Triggered by:

- DNS or TCP failure (`TypeError`)
- Timeout (`AbortError` from `AbortSignal.timeout`)

The `url` passed in is the full request URL the client tried to hit, which makes it easy to diagnose base-URL misconfiguration.

## Tool-side handling

Every tool follows the same pattern (see `src/tools/*.ts`):

```ts
try {
  const response = await chronova.get<{ data: T }>(path, params);
  return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
} catch (error) {
  if (error instanceof ChronovaApiError) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  }
  return { content: [{ type: "text", text: `Unexpected error: ${...}` }], isError: true };
}
```

Two intentional behaviors:

1. **Successful responses are unwrapped from the `{ data: … }` envelope** before being stringified (e.g. `get_developer_context`, `get_productivity_summary`, `get_ai_insights`).
2. **`get_recent_activity` does *not* unwrap** — it returns the full pagination response including `total`, `page`, etc., so the agent can paginate.

## When to update

- **Adding a new status code branch?** Add a case to the `switch` in `mapHttpStatusToError` and a test in `tests/integration/errors.test.ts`.
- **Changing the error message format?** Make sure tests under `tests/integration/errors.test.ts` still pass — they assert on substrings like `Unauthorized`, `Rate limited`, `CHRONOVA_API_KEY`, `Cannot connect`.
- **Supporting a non-GET verb?** Extend `ChronovaClient` with a typed method rather than calling `fetch` directly from a tool.

---
type: Domain
title: "Errors & status mapping"
description: "How HTTP status codes and network failures from the Chronova API are mapped to actionable ChronovaApiError instances."
tags: [domain, errors, error-handling]
---

# Errors & status mapping

`src/lib/errors.ts` defines `ChronovaApiError` and two mappers that translate raw `fetch` outcomes into structured, user-facing errors. Every tool handler catches `ChronovaApiError` and returns it as a tool error (`isError: true` with the message as text) rather than throwing — so AI clients see a readable message.

## ChronovaApiError

```ts
class ChronovaApiError extends Error {
  statusCode: number;  // HTTP status, or 0 for connection errors
  code: string;        // machine-readable code (see below)
  retryAfter?: number;  // seconds, for 429
}
```

## HTTP status mapping — `mapHttpStatusToError`

| Status | `code` | Message | Extra |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | "Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration." | — |
| 429 | `RATE_LIMITED` | "Rate limited: Too many requests." + optional " Retry after N seconds." | `retryAfter` from `Retry-After` header, else computed from `X-RateLimit-Reset` (epoch minus now, floored at 0) |
| 404 | `NOT_FOUND` | "Not found: The requested resource does not exist." | — |
| ≥ 500 | `SERVER_ERROR` | "Chronova server error: {statusText}. Please try again later." | — |
| other | `API_ERROR` | "Chronova API error: {status} {statusText}" | — |

The 429 path is the most intricate: it tries `Retry-After` first (as seconds), then falls back to `X-RateLimit-Reset` (Unix epoch) minus the current time, clamped to a non-negative integer.

## Network/abort mapping — `mapNetworkError

Triggered by `ChronovaClient.get` when the thrown error is a `TypeError` (fetch failure) or an `AbortError` (timeout). Produces:

- `code: "CONNECTION_ERROR"`
- `statusCode: 0`
- message: "Cannot connect to Chronova at {url}. Check CHRONOVA_API_URL configuration."

## How it flows in tools

```
chronova.get(...)
  └─ fetch(...) ok? → mapHttpStatusToError (if !response.ok) → throw ChronovaApiError
  └─ fetch(...) throws TypeError/AbortError? → mapNetworkError → throw ChronovaApiError
tool handler
  └─ catch (error instanceof ChronovaApiError) → { content: [{ text: error.message }], isError: true }
  └─ catch (other) → { content: [{ text: "Unexpected error: ..." }], isError: true }
```

The `CONNECTION_ERROR` (statusCode 0), `RATE_LIMITED` (with `retryAfter`), and `UNAUTHORIZED` codes are the main actionable signals a caller can key off. The integration tests assert the 401 path returns `isError: true` with "Unauthorized" + "CHRONOVA_API_KEY" in the text.
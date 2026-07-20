---
type: Testing
title: "Testing"
description: "Vitest-based integration tests using an in-memory MCP-over-HTTP harness and a fetch mock for the Chronova API."
tags: [testing, vitest, integration]
---

# Testing

Tests run with **Vitest** (`npm test` → `vitest run`). Configuration: `vitest.config.ts` includes `tests/**/*.test.ts` with a 30-second timeout and `.ts` extension priority.

There is no `tests/helpers/mock-server.test.ts` — the helpers are support code consumed by the integration tests.

## Layout

```
tests/
├── helpers/
│   └── mock-server.ts        # fetch mock + MCP-over-HTTP test harness
└── integration/
    ├── config.test.ts        # resolveConfig resolution ladder
    ├── errors.test.ts        # status/network mappers
    ├── server.test.ts        # /health, initialize, tools/list, invalid session
    └── tools.test.ts         # all four tools: success + 401 paths
```

There are **no unit tests** per tool file and **no stdio entrypoint tests** — coverage is integration-level, exercising tools through the real HTTP transport.

## The test harness — `tests/helpers/mock-server.ts`

Provides two layers of fakes:

### `mockChronovaApi()`

Monkeypatches `globalThis.fetch` with a `vi.fn` that matches request URLs against registered handlers (string `includes` or RegExp). Supports:

- `respond(pattern, response)` — persistent handler.
- `respondOnce(pattern, response)` — one-shot (sets `consumed = true`).
- `restore()` — restores the original `fetch`.
- `callCount()` — number of intercepted fetch calls.

Responses are wrapped in a real `Response` with `Content-Type: application/json` plus any extra headers (used to test the 429 `Retry-After` path in `errors.test.ts`).

### MCP-over-HTTP test server

`startMcpTestServer(app)` spins the Express app up on an ephemeral port and exposes:

- `request(mcpReq)` — POSTs a JSON-RPC request to `/mcp` with `Accept: application/json, text/event-stream` and tracks `mcp-session-id`. Parses SSE `data:` lines via `parseSse`.
- `initSession(server)` — sends `initialize` (protocolVersion `2025-03-26`) then `notifications/initialized`.
- `callTool(server, name, args)` — sends `tools/call` and returns `result`, throwing on `res.error`.

This lets tests drive the server exactly as a real MCP client would, without spawning a process.

## Test config

Integration tests use a fixed `TEST_CONFIG`:

```ts
{ apiKey: "test-api-key", apiUrl: "https://chronova.test/api/v1", port: 3001, configSource: "env" }
```

and call `createApp(TEST_CONFIG)` directly (bypassing `resolveConfig`), so tests are deterministic regardless of the host's `~/.chronova.cfg`.

## What the tests assert

- **`server.test.ts`** — `/health` returns `{ status: "ok", version: "1.1.0" }`; `initialize` returns `serverInfo.name = "chronova-mcp"` and `version = "1.1.0"`; `tools/list` returns exactly 4 tools with the expected sorted names; every tool has `annotations.readOnlyHint: true` and an `inputSchema.type = "object"`; an unknown `Mcp-Session-Id` yields HTTP 400 with "Invalid or expired session ID".
- **`tools.test.ts`** — for each tool: a happy path asserting parsed JSON content, a 401 path asserting `isError: true` and the "Unauthorized" message; plus parameter-passthrough checks (e.g. `get_productivity_summary` with `project`, `get_recent_activity` with filters/pagination).
- **`config.test.ts`** — `resolveConfig` priority: env wins over `~/.chronova.cfg`, which wins over `~/.wakatime.cfg`, which wins over `none`; uses injected `readFile`/`getHomeDir`/`env` so no real filesystem access.
- **`errors.test.ts`** — `mapHttpStatusToError` for 401/404/429/5xx/generic; 429 `retryAfter` from `Retry-After` and from `X-RateLimit-Reset`; `mapNetworkError` produces `CONNECTION_ERROR`.

## Running

```bash
npm test           # vitest run (CI mode)
npx vitest         # watch mode
npm run type-check # tsc --noEmit, no tests
```

No test runner script is needed beyond `vitest run`; there is no separate e2e suite or coverage threshold configured.
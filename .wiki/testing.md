---
type: Testing
title: "Testing"
description: "Vitest-based integration tests using an in-memory MCP-over-HTTP harness and a fetch mock for the Chronova API."
tags: [testing, vitest, integration]
---

# Testing

Tests run with **Vitest** (`npm test` → `vitest run`). The lockfile currently resolves Vitest to `4.1.11` (Renovate PR #95, commit `9289547`). Configuration: `vitest.config.ts` includes `tests/**/*.test.ts` with a 30-second timeout and `.ts` extension priority.

There is no `tests/helpers/mock-server.test.ts` — the helpers are support code consumed by the integration tests.

There is also a standalone regression suite at **`test/stream-log.test.ts`** (singular `test/`, not `tests/`). It drives `.omp/stream-log.py` as a Python subprocess and guards the log-formatter regressions that broke the OMP CI pipeline in issue #76. It is **not** picked up by the default `npm test` because `vitest.config.ts` only includes `tests/**/*.test.ts`; run it explicitly with `npx vitest test/stream-log.test.ts` if you change the OMP log formatter.

The suite covers:

- Canonical event flow (`agent_start`, `turn_start`, `tool_execution_start/end`, `message_end`, `agent_end`) formatting without crashing.
- `tool_execution_end` `text` fields that are `null`, numeric, lists, or dicts — all coerced safely instead of raising `TypeError` during string joins.
- `tool_execution_start` `args` payloads that are strings, `null`, lists, or dicts — still producing a tool invocation line so the CI log shows the call was attempted.
- Non-string `text` in `message_end` and `agent_end` events.
- Malformed JSON lines skipped without aborting the formatter.

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

- **`server.test.ts`** — `/health` returns `{ status: "ok", version: VERSION }`; `initialize` returns `serverInfo.name = "chronova-mcp"` and `version = VERSION`; `tools/list` returns exactly 4 tools with the expected sorted names; every tool has `annotations.readOnlyHint: true` and an `inputSchema.type = "object"`; an unknown `Mcp-Session-Id` yields HTTP 400 with "Invalid or expired session ID".

  > Note: `server.test.ts` imports `VERSION` from `src/version.js`, which reads `package.json#version` at import time. This keeps the test assertions in sync with the published package version automatically and avoids the previous drift caused by a hard-coded version string.
- **`stream-log.test.ts`** — `.omp/stream-log.py` exits 0 when fed the canonical OMP JSONL event flow and does not crash on malformed tool `args`, non-string tool `text`, malformed message/agent text, or invalid JSON lines.
- **`tools.test.ts`** — for each tool: a happy path asserting parsed JSON content, a 401 path asserting `isError: true` and the "Unauthorized" message; plus parameter-passthrough checks (e.g. `get_productivity_summary` with `project`, `get_recent_activity` with filters/pagination).
- **`config.test.ts`** — `resolveConfig` priority: env wins over `~/.chronova.cfg`, which wins over `~/.wakatime.cfg`, which wins over `none`; uses injected `readFile`/`getHomeDir`/`env` so no real filesystem access.
- **`errors.test.ts`** — `mapHttpStatusToError` for 401/404/429/5xx/generic; 429 `retryAfter` from `Retry-After` and from `X-RateLimit-Reset`; `mapNetworkError` produces `CONNECTION_ERROR`.

## Running

```bash
npm test                        # vitest run (CI mode, tests/ only)
npx vitest                      # watch mode
npx vitest test/stream-log.test.ts  # OMP log-formatter regression suite
npm run type-check              # tsc --noEmit, no tests
```

No test runner script is needed beyond `vitest run`; there is no separate e2e suite or coverage threshold configured. The `stream-log.test.ts` path is in the separate `test/` directory, not `tests/integration/`, and must be invoked explicitly.
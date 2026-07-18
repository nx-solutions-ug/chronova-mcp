---
type: Architecture
title: "Architecture Overview"
description: "How the Chronova MCP server is structured: entrypoints, transports, the Chronova API client, and tool registration."
tags: [architecture, mcp, chronova]
---

# Architecture Overview

The Chronova MCP server is a thin, read-only bridge between an MCP-capable AI client and the Chronova HTTP API. It does not persist data or mutate any state on Chronova.

## Component map

```
AI client (Claude Desktop / Cursor / OpenCode / HTTP)
          │
          │  stdio  OR  HTTP (Streamable HTTP transport)
          ▼
┌─────────────────────────────────────────────────────┐
│  src/index.ts   (HTTP entrypoint)                  │
│  src/stdio.ts   (stdio entrypoint, npm bin)        │
│      parses CLI flags, resolves config             │
│          │                                          │
│          ▼                                          │
│  src/server.ts  createApp() / startServer()        │
│      Express app, /health, /mcp endpoint            │
│      per-session McpServer + StreamableHTTPServerTransport │
│          │                                          │
│          ▼                                          │
│  src/tools/*   registerXxx(server, chronova)        │
│      zod inputSchema → chronova.get() → JSON text   │
│          │                                          │
│          ▼                                          │
│  src/lib/chronova-client.ts  ChronovaClient.get()  │
│      fetch + Bearer auth + 30s timeout + error map  │
│          │                                          │
│          ▼                                          │
│  Chronova HTTP API (https://chronova.dev/api/v1)   │
└─────────────────────────────────────────────────────┘
```

## Entrypoints

Two independent entrypoints share the same tool registrations and the same `ChronovaClient`:

- **`src/index.ts`** — HTTP entrypoint. `parseArgs()` translates `--port` / `--api-url` / `--help` into `process.env`, then calls `startServer()` from `server.ts`. This is what `npm start` and the Docker image run.
- **`src/stdio.ts`** — stdio entrypoint and the published `chronova-mcp-server` bin (`package.json#bin`). It creates an `McpServer` connected to `StdioServerTransport` and exits with an error if no API key is resolvable (HTTP entrypoint only warns).

Both call `resolveConfig()` (`src/lib/config.ts`) and construct a `ChronovaClient` with the same four tool registrations.

## Server (HTTP transport)

`src/server.ts` exposes:

- `createApp(config?)` — builds an Express app with CORS and JSON body parsing. `GET /health` returns `{ status, version }`. `POST|GET|DELETE /mcp` handle MCP protocol traffic via the Streamable HTTP transport.
- `startServer()` — resolves config, warns on missing API key, listens on `config.port`, wires `SIGTERM`/`SIGINT` graceful shutdown.

Sessions are managed in an in-memory `Map<sessionId, Session>`. Each new session (no `mcp-session-id` header) creates a fresh `McpServer` + `StreamableHTTPServerTransport` pair with a random UUID generator and stores it on `onsessioninitialized`. `server.onclose` deletes the session. The MCP server version constant is `VERSION = "0.1.0"` in `server.ts` (note: this differs from the npm package version in `package.json`).

## Tool registration pattern

Every tool lives in `src/tools/<tool-name>.ts` and exports a `registerXxx(server: McpServer, chronova: ChronovaClient)` function. Inside, `server.registerTool(name, { description, inputSchema: z.object(...), annotations: { readOnlyHint: true } }, async (args) => {...})` registers it. All four tools are read-only.

Each handler:

1. Builds a Chronova API path and query params from the zod-parsed args.
2. Calls `chronova.get<{ data: T }>(path, params)`.
3. Returns `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }` on success.
4. Catches `ChronovaApiError` and returns `{ content: [{ type: "text", text: error.message }], isError: true }`; unexpected errors are stringified into the text content with `isError: true`.

See [Tools reference](../tools/index.md) for per-tool paths, schemas, and response shapes.

## Chronova API client

`src/lib/chronova-client.ts` — `ChronovaClient`:

- Constructor normalizes `baseUrl` to end with `/` so `new URL(path, baseUrl)` resolves correctly (without the trailing slash, `new URL("users/current", "https://host/api/v1")` yields `https://host/users/current`).
- `get<T>(path, params?)` builds the URL, omits empty/undefined params, sets `Authorization: Bearer <key>` and `Accept: application/json`, and uses `AbortSignal.timeout(30_000)`.
- HTTP errors are mapped via `mapHttpStatusToError` and network/abort errors via `mapNetworkError` (see [Errors & status mapping](../domain/errors.md)).

## Types

`src/lib/types.ts` holds the response interfaces for each Chronova endpoint:

- `ChronovaUser` — profile, subscription, `github_connected`, organizations.
- `ChronovaStatsRange` — totals plus arrays of language/project/editor/OS breakdowns, `daily_stats`, `hourly_stats`, `best_day`.
- `ChronovaHeartbeat` / `ChronovaHeartbeatResponse` — raw activity events with pagination metadata.
- `ChronovaAiAnalytics` — adoption timeline, contribution share, with/without-AI comparison, language matrix, project dependency, efficiency trend.

These types describe the Chronova API contract as the server understands it; they are the source of truth for tool response shapes.

## Source map

| Path | Role |
|---|---|
| `src/index.ts` | HTTP entrypoint, CLI arg parsing, `--help` |
| `src/stdio.ts` | stdio entrypoint (npm `bin`) |
| `src/server.ts` | Express app, `/health`, `/mcp`, session lifecycle |
| `src/lib/config.ts` | Config resolution (env → `~/.chronova.cfg` → `~/.wakatime.cfg`) |
| `src/lib/chronova-client.ts` | HTTP client wrapper around `fetch` |
| `src/lib/errors.ts` | `ChronovaApiError` + status/network mappers |
| `src/lib/types.ts` | Chronova response type definitions |
| `src/tools/*.ts` | One file per MCP tool, `registerXxx` pattern |
| `tests/helpers/mock-server.ts` | `fetch` mock + MCP-over-HTTP test harness |
| `tests/integration/*.test.ts` | Integration tests for server + tools |
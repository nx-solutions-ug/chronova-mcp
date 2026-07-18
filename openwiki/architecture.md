# Architecture

The server is a small TypeScript program with two entry points, one shared Express app, and four MCP tools that all funnel through a single HTTP client.

## Entry points

`package.json` declares two compiled entry points:

| File | Purpose | Invoked by |
|---|---|---|
| `src/index.ts` → `dist/index.js` | CLI: parses flags, starts HTTP server | `npm start`, Docker `CMD`, `chronova-mcp-server` |
| `src/stdio.ts` → `dist/stdio.js` | stdio transport for local MCP clients | npm `bin: chronova-mcp-server`, `npx -y @chronova/mcp-server` |

Both call `resolveConfig()` from `src/lib/config.ts`. The HTTP entry warns when no API key is configured; the stdio entry fails fast (`process.exit(1)`) because the client would be unusable without one.

### CLI flag parsing (`src/index.ts`)

A minimal loop over `process.argv.slice(2)`:

- `--help` → prints the embedded `HELP_TEXT` and exits
- `--port <n>` → validates with `Number()`, sets `process.env.PORT`
- `--api-url <url>` → sets `process.env.CHRONOVA_API_URL`
- Anything else → prints error + help, exits with code 1

The flags only mutate `process.env`; resolution happens later in `resolveConfig`.

## Server assembly (`src/server.ts`)

`createApp(config?)` is the single source of truth for the Express app — tests use it directly with a fixed `ChronovaConfig`.

```
createApp(config)
├── express() + cors() + json()
├── /health       → { status: "ok", version: "0.1.0" }
├── /mcp (POST|GET|DELETE) → handleMcpRequest
│       ├── with mcp-session-id header → reuse existing transport
│       └── without it                → create McpServer + StreamableHTTPServerTransport
└── sessions: Map<sessionId, { transport, server }>
```

The `McpServer` is constructed by `createMcpServer(config)`, which:

1. Creates a new `McpServer` named `chronova-mcp` (version `0.1.0` hard-coded in both `server.ts` and `stdio.ts`)
2. Instantiates a `ChronovaClient` with the resolved API URL + key
3. Registers all four tools (see `tools.md`)

A new `McpServer` is created **per session** so that transport `onclose` can remove the entry from the session map without affecting other clients.

### Session lifecycle

- **Init:** when a request arrives without a session ID, a new `McpServer` + `StreamableHTTPServerTransport` pair is created. The transport's `sessionIdGenerator` returns `randomUUID()`; `onsessioninitialized` stores the pair in the in-memory `sessions` map.
- **Reuse:** subsequent requests with `mcp-session-id: <uuid>` look up the existing transport and forward the JSON-RPC body.
- **Invalid ID:** responds with HTTP 400 and a JSON-RPC error (`code: -32600`, `Invalid or expired session ID`).
- **Teardown:** `mcpServer.server.onclose` deletes the entry from `sessions`.

Sessions are in-memory only; there is no persistence and no auth on the HTTP endpoint beyond whatever the AI client provides.

`startServer()` adds `app.listen(port)` plus `SIGTERM`/`SIGINT` handlers that call `httpServer.close()` and `process.exit(0)`.

## stdio transport (`src/stdio.ts`)

Mirrors the HTTP server but uses `StdioServerTransport` and a single `McpServer` for the process lifetime. Because the agent keeps the process running, there is no per-session bookkeeping.

## Shared modules

- **`src/lib/config.ts`** — `ChronovaConfig`, `resolveConfig(options?)`, `parseIniFile`, `readConfigFile`. Pure function with optional `readFile` / `getHomeDir` / `env` overrides for tests.
- **`src/lib/chronova-client.ts`** — `ChronovaClient` class. See `api-client-and-errors.md`.
- **`src/lib/errors.ts`** — `ChronovaApiError` + HTTP/network mappers. See `api-client-and-errors.md`.
- **`src/lib/types.ts`** — `ChronovaUser`, `ChronovaStatsRange`, `ChronovaHeartbeat`, `ChronovaHeartbeatResponse`, `ChronovaAiAnalytics`. Mirrors the upstream API contract.

## Request flow (HTTP)

```
AI client (POST /mcp)
  └── handleMcpRequest
        ├── header: mcp-session-id
        │     ├── present + valid  → transport.handleRequest(body)
        │     └── present + invalid → 400 JSON-RPC error
        └── absent
              ├── new McpServer + ChronovaClient
              ├── new StreamableHTTPServerTransport (UUID generator)
              ├── onsessioninitialized → sessions.set(uuid, …)
              ├── onclose             → sessions.delete(uuid)
              ├── server.connect(transport)
              └── transport.handleRequest(body)
                  └── on tools/call
                        └── tool handler (e.g. get_developer_context)
                              └── chronova.get<…>("users/current")
                                    └── ChronovaApiError on !ok
                                          → returned to client as text content with isError: true
```

## When to read each file

- Adding a new tool? Start in `src/tools/`, then register it in both `server.ts` and `stdio.ts`.
- Changing the API contract? Update `src/lib/types.ts` and the corresponding tool file.
- Changing session handling? Edit `handleMcpRequest` in `src/server.ts` only.
- Changing config resolution? `src/lib/config.ts` is fully covered by `tests/integration/config.test.ts`.

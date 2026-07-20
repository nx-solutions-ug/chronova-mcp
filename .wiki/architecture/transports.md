---
type: Architecture
title: "Transports: stdio vs HTTP"
description: "The two MCP transports the server supports, when to use each, and how they are wired."
tags: [architecture, transports, mcp]
---

# Transports: stdio vs HTTP

The server ships two entrypoints that register the **same four tools** against the **same `ChronovaClient`**, differing only in the MCP transport.

## stdio transport — `src/stdio.ts`

- Published as the npm `bin` (`chronova-mcp-server`), so `npx -y @chronova/mcp-server` runs it.
- Uses `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
- Builds a single `McpServer({ name: "chronova-mcp", version: VERSION })` (where `VERSION` is read from `package.json`) and connects the stdio transport.
- **Hard-fails on missing API key** — exits with code 1 and a message pointing to `CHRONOVA_API_KEY` / `~/.chronova.cfg` / `~/.wakatime.cfg`. This is the right behavior for clients that spawn the server as a child process: a missing key is unrecoverable.
- No HTTP server, no port, no session map. One process = one client.

Use stdio when an AI client (Claude Desktop, Cursor, OpenCode) launches the server as a local subprocess. This is the common case and the one the README's client snippets target.

## HTTP transport — `src/index.ts` + `src/server.ts`

- Runs an Express app (`createApp`) listening on `config.port` (default `3001`).
- Exposes `POST`, `GET`, and `DELETE` on `/mcp` — all handled by `handleMcpRequest`.
- Uses `StreamableHTTPServerTransport` with a `sessionIdGenerator: () => randomUUID()`.
- Sessions are tracked in an in-memory `Map<string, Session>` where `Session = { transport, server }`. New sessions are created lazily when a request arrives without an `mcp-session-id`; subsequent requests reuse the existing session by ID.
- `GET /health` returns `{ status: "ok", version: VERSION }` — useful for liveness probes in containers.
- Graceful shutdown on `SIGTERM`/`SIGINT` closes the HTTP server and exits.
- **Warns** (does not exit) on missing API key, because HTTP mode may be shared/remote and the key could come from a config file at runtime.

Use HTTP when you need a shared/remote server, containerized deployment (see [Operations](../operations.md) → Docker), or when the client speaks Streamable HTTP rather than spawning a process.

## Choosing between them

| Need | Transport | Entry point |
|---|---|---|
| Claude Desktop / Cursor / OpenCode local subprocess | stdio | `chronova-mcp-server` (`dist/stdio.js`) |
| Docker / remote / multi-client | HTTP | `node dist/index.js` |
| Health-check endpoint needed | HTTP | `/health` |
| Per-client isolation in one process | HTTP (sessions) | `mcp-session-id` header |

Both entrypoints call `resolveConfig()` and register all four tools, so the tool surface is identical regardless of transport.
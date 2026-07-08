# Chronova MCP Server — OpenWiki

The Chronova MCP Server (`@chronova/mcp-server`) is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Chronova developer-productivity API to AI clients (Claude Desktop, Cursor, OpenCode, etc.). It provides four read-only tools that let an agent query developer profile, productivity stats, AI-assisted coding metrics, and recent coding activity.

## Repository at a glance

- **Package:** `@chronova/mcp-server` (ISC)
- **Version:** `1.1.0` (see `package.json`, `CHANGELOG.md`)
- **Runtime:** Node.js >= 18, built with TypeScript (`tsconfig.json` uses `target: ES2022`, `module: Node16`, `strict: true`)
- **Transports:**
  - **Streamable HTTP** on `POST|GET|DELETE /mcp` (default port `3001`, started by `dist/index.js`)
  - **stdio** for local MCP clients (npm bin `chronova-mcp-server`, `dist/stdio.js`)
- **API client:** A thin `fetch`-based `ChronovaClient` (`src/lib/chronova-client.ts`) with a 30s timeout and Bearer auth
- **Tests:** Vitest integration suite under `tests/integration/` driving a real Express app via a custom MCP test harness

## Install and run

The server is published to npm. Two ways to use it:

```bash
# Run via npx (stdio transport — what AI clients invoke)
npx -y @chronova/mcp-server

# Or install globally and start the HTTP server
npm install -g @chronova/mcp-server
chronova-mcp-server        # exposes /mcp on port 3001
```

CLI flags override env vars (see `src/index.ts`):

| Flag | Effect |
|---|---|
| `--port <n>` | Sets `PORT` for HTTP server |
| `--api-url <url>` | Sets `CHRONOVA_API_URL` |
| `--help` | Prints usage and exits |

## Configure the API key

`src/lib/config.ts → resolveConfig` checks, in order:

1. `CHRONOVA_API_KEY` env var (and `CHRONOVA_API_URL`, `PORT`)
2. `~/.chronova.cfg` — `api_key`/`api_url` under `[settings]`
3. `~/.wakatime.cfg` — WakaTime-compatible fallback
4. Defaults: empty key, `https://chronova.dev/api/v1`, port `3001`

INI example (`~/.chronova.cfg`):

```ini
[settings]
api_key = waka_your-api-key-here
api_url = https://chronova.dev/api/v1
```

A template lives at `.env.example`.

## Wire it into an AI client

### Claude Desktop — `claude_desktop_config.json`
```json
{
  "mcpServers": {
    "chronova": {
      "command": "npx",
      "args": ["-y", "@chronova/mcp-server"],
      "env": { "CHRONOVA_API_KEY": "your-api-key" }
    }
  }
}
```

### Cursor — `.cursor/mcp.json`
```json
{
  "mcpServers": {
    "chronova": {
      "command": "npx",
      "args": ["-y", "@chronova/mcp-server"],
      "env": { "CHRONOVA_API_KEY": "your-api-key" }
    }
  }
}
```

### OpenCode — `opencode.json`
```json
{
  "mcp": {
    "chronova": {
      "type": "local",
      "command": ["npx", "-y", "@chronova/mcp-server"],
      "enabled": true,
      "env": { "CHRONOVA_API_KEY": "your-api-key" }
    }
  }
}
```

## MCP tools

All four tools are registered in `src/server.ts` and `src/stdio.ts` via `McpServer.registerTool`. Each is annotated `readOnlyHint: true`. See `tools.md` for parameter details and response shapes.

| Tool | Purpose | Required params |
|---|---|---|
| `get_developer_context` | Profile, subscription, GitHub status, orgs | none |
| `get_productivity_summary` | Coding time + language/editor/project breakdown | `range` |
| `get_ai_insights` | AI vs manual coding analytics | `range` |
| `get_recent_activity` | Recent heartbeats with filters + pagination | none (all filters optional) |

Named `range` values: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`. `get_productivity_summary` also accepts custom `YYYY`/`YYYY-MM`/`YYYY-MM-DD_to_YYYY-MM-DD`.

## Development

```bash
npm install
npm run dev          # tsc --watch + node --watch
npm run build        # tsc -> dist/
npm test             # vitest run (integration suite)
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
```

Build output goes to `dist/` (declared in `package.json` `files`). `prepublishOnly` runs the build so npm only ships compiled output.

## Docker

`Dockerfile` is a two-stage Node 24 Alpine image:

```bash
docker build -t chronova-mcp .
docker run -e CHRONOVA_API_KEY=your-key -p 3001:3001 chronova-mcp
```

The container starts the HTTP server via `node dist/index.js` on `PORT=3001`.

## Where to go next

- [Architecture](architecture.md) — entry points, transport flow, session lifecycle
- [Configuration](configuration.md) — env / INI / CLI resolution details
- [Tools](tools.md) — per-tool parameters and response shapes
- [API client and errors](api-client-and-errors.md) — `ChronovaClient` and error mapping
- [Operations](operations.md) — release, CI, OpenWiki automation
- [Testing](testing.md) — Vitest layout, mock harness, what to run after changes

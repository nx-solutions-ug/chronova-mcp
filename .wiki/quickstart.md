---
type: Quickstart
title: "Chronova MCP Server — Quickstart"
description: "Install, configure, and run the Chronova MCP server with AI clients like Claude Desktop, Cursor, and OpenCode."
tags: [quickstart, mcp, chronova]
---

# Chronova MCP Server — Quickstart

`@chronova/mcp-server` is a Model Context Protocol (MCP) server that exposes [Chronova](https://chronova.dev) developer productivity data — coding stats, recent activity, and AI-assisted coding analytics — to AI agents such as Claude Desktop, Cursor, and OpenCode.

The package ships **two transports**:

- **stdio** (`chronova-mcp-server` bin) — for MCP clients that spawn a local process.
- **HTTP / Streamable HTTP** (`dist/index.js`) — a stateful Express server at `/mcp`, suited for remote/shared hosting and Docker.

See [Architecture → Transports](architecture/transports.md) for the distinction.

## Install

```bash
# Run directly via npx (stdio transport, the common path for MCP clients)
npx -y @chronova/mcp-server

# Or install globally
npm install -g @chronova/mcp-server
chronova-mcp-server
```

## Configure the API key

The server needs a Chronova API key. It resolves configuration in priority order (highest first):

1. `CHRONOVA_API_KEY` environment variable
2. `~/.chronova.cfg` — `api_key` under `[settings]`
3. `~/.wakatime.cfg` — `api_key` under `[settings]` (WakaTime-compatible)
4. Default: empty — API requests will fail with `401 Unauthorized`

`api_url` follows the same ladder (`CHRONOVA_API_URL` → config file → `https://chronova.dev/api/v1`). See [Configuration](configuration.md) for the full resolution rules and CLI flags.

Config files use INI format:

```ini
[settings]
api_key = waka_your-api-key-here
api_url = https://chronova.dev/api/v1
```

## Connect an AI client

### Claude Desktop

`claude_desktop_config.json`:

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

### Cursor

`.cursor/mcp.json`:

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

### OpenCode

`opencode.json`:

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

## Tools available to the agent

Once connected, the agent can call four read-only tools. See [Tools reference](tools/index.md) for full parameter schemas.

| Tool | Purpose | Required params |
|---|---|---|
| `get_developer_context` | User profile, subscription, GitHub status, org memberships | none |
| `get_productivity_summary` | Aggregated coding stats by time range | `range` |
| `get_ai_insights` | AI vs manual coding analytics | `range` |
| `get_recent_activity` | Paginated coding heartbeats with filters | none (all filters optional) |

Named ranges: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`. A custom range in the format `YYYY-MM-DD_to_YYYY-MM-DD` is only supported by `get_ai_insights`; `get_productivity_summary` accepts the named ranges only.

## Development

```bash
npm run dev          # tsc --watch + node --watch
npm test             # vitest run
npm run build        # tsc
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
```

See [Testing](testing.md) for the mock-based integration test harness and [Operations](operations.md) for Docker and release details.
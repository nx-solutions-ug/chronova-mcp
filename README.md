# Chronova MCP Server

MCP server that exposes Chronova developer productivity data to AI agents. Built on the Model Context Protocol, it lets tools like Claude Desktop, Cursor, and OpenCode query your coding stats, activity, and AI-assisted coding metrics.

## Installation

```bash
# Run directly
npx @chronova/mcp-server

# Or install globally
npm install -g @chronova/mcp-server
chronova-mcp
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHRONOVA_API_KEY` | Yes | — | Your Chronova API key |
| `CHRONOVA_API_URL` | No | `https://chronova.dev` | Chronova API base URL |
| `PORT` | No | `3001` | Server listen port |

CLI flags override env vars: `--port 3001`, `--api-url https://chronova.dev`, `--help`.

## Usage with AI Clients

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chronova": {
      "command": "npx",
      "args": ["@chronova/mcp-server"],
      "env": {
        "CHRONOVA_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chronova": {
      "command": "npx",
      "args": ["@chronova/mcp-server"],
      "env": {
        "CHRONOVA_API_KEY": "your-api-key"
      }
    }
  }
}
```

### OpenCode

Add to `opencode.json` under `mcp`:

```json
{
  "mcp": {
    "chronova": {
      "type": "local",
      "command": ["npx", "@chronova/mcp-server"],
      "enabled": true,
      "env": {
        "CHRONOVA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

| Tool | Description | Parameters |
|---|---|---|
| `get_developer_context` | Get user profile, subscription, GitHub status, org memberships | None |
| `get_productivity_summary` | Aggregated coding stats by time range | `range` (required), `project` (optional) |
| `get_ai_insights` | AI vs manual coding analytics | `range` (required) |
| `get_recent_activity` | Recent coding heartbeats with filters and pagination | `date`, `start`, `end`, `project`, `language`, `editor`, `page`, `per_page` (all optional) |

Named ranges: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`. Custom: `YYYY-MM-DD_to_YYYY-MM-DD`.

## Development

```bash
npm run dev          # Watch mode
npm test             # Run tests
npm run build        # Compile TypeScript
npm run type-check   # Type check only
```

## Docker

```bash
docker build -t chronova-mcp .
docker run -e CHRONOVA_API_KEY=your-key -p 3001:3001 chronova-mcp
```

## License

Proprietary
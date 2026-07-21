---
type: Configuration
title: "Configuration"
description: "How the Chronova MCP server resolves API key, API URL, and port from env vars, config files, CLI flags, and defaults."
tags: [configuration, env, cli]
---

# Configuration

All configuration funnels through `resolveConfig()` in `src/lib/config.ts`, which returns a `ChronovaConfig`:

```ts
interface ChronovaConfig {
  apiKey: string;
  apiUrl: string;
  port: number;
  configSource: "env" | "chronova.cfg" | "wakatime.cfg" | "none";
}
```

`configSource` records which source supplied the API key, used by `startServer()` to print a diagnostic to stderr (only when the source is not `env`, to avoid leaking).

## Resolution order

Config is resolved **first match wins**, with `apiKey` as the gating value:

1. **Environment variable** `CHRONOVA_API_KEY` — if present, the entire config is built from env:
   - `apiKey = CHRONOVA_API_KEY`
   - `apiUrl = CHRONOVA_API_URL ?? "https://chronova.dev/api/v1"`
   - `port = PORT ? Number(PORT) : 3001`
   - `configSource = "env"`
2. **`~/.chronova.cfg`** — INI-like file; if it has an `api_key` entry:
   - `apiKey = chronovaCfg.api_key`
   - `apiUrl = CHRONOVA_API_URL env ?? chronovaCfg.api_url ?? default`
   - `port = PORT env ?? 3001`
   - `configSource = "chronova.cfg"`
3. **`~/.wakatime.cfg`** — same shape as above (WakaTime-compatible), `configSource = "wakatime.cfg"`.
4. **None** — `apiKey = ""`, `configSource = "none"`. API requests will fail with `401`.

Note: `apiUrl` and `port` can be overridden by env vars even when the *key* comes from a config file — env `CHRONOVA_API_URL` and `PORT` take precedence over the config-file `api_url` in the cfg branches.

## Config file format

The parser in `src/lib/config.ts` reads any line matching `key = value`. Lines that are blank or start with `[`, `#`, or `;` are ignored, so section headers have no effect. Put `api_key` and `api_url` as top-level keys:

```ini
api_key = waka_your-api-key-here
api_url = https://chronova.dev/api/v1
```

## CLI flags (HTTP entrypoint only)

`src/index.ts` parses a small flag set before calling `startServer()`. These override the equivalent env vars (they set `process.env` directly), so they win over config files too:

| Flag | Effect |
|---|---|
| `--port <number>` | Sets `PORT` |
| `--api-url <url>` | Sets `CHRONOVA_API_URL` |
| `--help` | Prints help text and exits 0 |

Unknown flags exit 1 with the help text. `--port`/`--api-url` missing their value also exit 1.

The stdio entrypoint (`src/stdio.ts`) does **not** parse these flags — stdio clients pass config via env (typical for MCP client `env` blocks).

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHRONOVA_API_KEY` | Yes* | — | Chronova API key (*or from a config file) |
| `CHRONOVA_API_URL` | No | `https://chronova.dev/api/v1` | Chronova API base URL |
| `PORT` | No | `3001` | HTTP listen port |

`.env.example` ships with `CHRONOVA_API_URL=https://chronova.dev` (note: the client normalizes the base URL by appending `/` and the code default already includes `/api/v1`; the runtime default used in `config.ts` is `https://chronova.dev/api/v1`).

## Testability

`resolveConfig` accepts an optional `ResolveConfigOptions`:

```ts
interface ResolveConfigOptions {
  readFile?: (path: string) => Record<string, string> | null;
  getHomeDir?: () => string;
  env?: NodeJS.ProcessEnv;
}
```

This lets tests inject a fake file reader, a fake home dir, and a fake `process.env` without touching the real filesystem — used by `tests/integration/config.test.ts`.
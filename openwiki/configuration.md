# Configuration

Configuration is resolved by `resolveConfig()` in `src/lib/config.ts` and returns a `ChronovaConfig`:

```ts
interface ChronovaConfig {
  apiKey: string;
  apiUrl: string;
  port: number;
  configSource: "env" | "chronova.cfg" | "wakatime.cfg" | "none";
}
```

The `configSource` field lets the server log where the key came from (`src/server.ts:startServer` writes a one-liner to stderr unless the source is `env`).

## Resolution order

1. **`CHRONOVA_API_KEY` env var** — wins immediately. `apiUrl` falls back to `CHRONOVA_API_URL` env var or the default; `port` comes from `PORT` or the default.
2. **`~/.chronova.cfg`** — INI file. The first section is read (section markers are ignored); keys `api_key` and `api_url` are recognized.
3. **`~/.wakatime.cfg`** — same INI format, used for WakaTime compatibility. Read only if `chronova.cfg` had no `api_key`.
4. **Defaults** — empty `apiKey`, `apiUrl = "https://chronova.dev/api/v1"`, `port = 3001`. `configSource` is `"none"`.

`apiUrl` precedence: env var > matching config file value > default. Env var wins for `apiUrl` even when the key came from a config file (see `tests/integration/config.test.ts`).

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `CHRONOVA_API_KEY` | — | Required for actual API calls. Omitted → server warns (HTTP) or exits 1 (stdio) |
| `CHRONOVA_API_URL` | `https://chronova.dev/api/v1` | The base URL the HTTP client prepends to API paths |
| `PORT` | `3001` | HTTP server listen port (HTTP transport only) |

A template is provided at `.env.example`.

## CLI flags

`src/index.ts` parses these before config resolution and writes them to `process.env`:

- `--port <n>` — must parse as a number, otherwise exits 1
- `--api-url <url>` — required value
- `--help` — prints help, exits 0

Flags only set env vars, so they participate in the same resolution order described above.

## Config file format

INI, with a single section:

```ini
[settings]
api_key = waka_your-api-key-here
api_url = https://chronova.dev/api/v1
```

`parseIniFile` (in `src/lib/config.ts`) handles:

- Skipping blank lines, lines starting with `[`, `#`, or `;`
- Trimming whitespace around keys and values
- Values that contain `=` (only the first `=` splits key/value)
- Malformed lines (no `=`) being ignored

`readConfigFile` swallows `ENOENT` and other read errors and returns `null`, so missing files do not break startup.

## Testability

`resolveConfig` accepts an optional `ResolveConfigOptions` to inject:

- `readFile(path) → Record<string,string> | null` — bypass the real filesystem
- `getHomeDir() → string` — return a fake home dir
- `env: NodeJS.ProcessEnv` — fake env vars

The integration tests use these hooks to cover every branch in `tests/integration/config.test.ts` without touching the real filesystem or env.

## Where to look

- `src/lib/config.ts` — implementation
- `src/lib/config.ts` → `parseIniFile` — INI parser
- `src/index.ts` — CLI flags
- `src/server.ts` → `startServer` — startup-time logging of `configSource`
- `tests/integration/config.test.ts` — exhaustive coverage of priority rules

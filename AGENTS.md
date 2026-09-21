# Repository Guidelines

## Project Overview

`@chronova/mcp-server` is a Model Context Protocol (MCP) server that exposes [Chronova](https://chronova.dev) developer-productivity data to AI agents (Claude Desktop, Cursor, OpenCode, etc.). It ships four **read-only** tools that wrap the Chronova REST API: `get_developer_context`, `get_productivity_summary`, `get_recent_activity`, and `get_ai_insights`. The server supports two transports — stdio (for local subprocess clients) and HTTP/Express (for shared or containerised hosting) — with an identical tool surface.

Published to npm as `@chronova/mcp-server`; the `chronova-mcp-server` bin launches stdio mode.

## Architecture & Data Flow

```
MCP client (Claude/Cursor/OpenCode)
        │  stdio or HTTP /mcp
        ▼
McpServer (src/server.ts)  ── registerTool(name, inputSchema, handler)
        │
        ▼
ChronovaClient (src/lib/chronova-client.ts)  ── fetch + Bearer, 30s timeout
        │
        ▼
Chronova REST API  (https://chronova.dev/api/v1)
```

- **Entrypoints**: `src/index.ts` (HTTP, Express, `createApp`/`startServer`) and `src/stdio.ts` (stdio, npm bin). Both construct the same `McpServer` from `src/server.ts`.
- **Transports**: `StreamableHTTPServerTransport` (HTTP, session via `mcp-session-id` header, `/mcp` POST/GET/DELETE) and `StdioServerTransport`, both from `@modelcontextprotocol/sdk`.
- **Tool registration**: `server.registerTool(name, { description, inputSchema: zod, annotations: { readOnlyHint: true } }, async handler)`. Handlers call `chronovaClient.get(...)` and return `{ content: [{ type: "text", text: JSON.stringify(data) }] }`, or `{ content, isError: true }` on failure.
- **Error mapping**: HTTP 401 → `UNAUTHORIZED`, 429 → `RATE_LIMITED` (with `retryAfter`), 404 → `NOT_FOUND`, 5xx → `SERVER_ERROR`, network/abort → `CONNECTION_ERROR`. All surface as `ChronovaApiError` in `src/lib/errors.ts` and are returned to the client as `isError: true` text content (no stack traces).
- **Config resolution**: env vars → `~/.chronova.cfg` → `~/.wakatime.cfg` → defaults (INI file format).

## Key Directories

| Path                                    | Purpose                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                          | HTTP entrypoint; exports `createApp`, `startServer`; CLI flags `--port`, `--api-url`, `--help`                                                             |
| `src/stdio.ts`                          | stdio entrypoint (npm `bin`); exits if `CHRONOVA_API_KEY` missing                                                                                          |
| `src/server.ts`                         | `McpServer` construction; registers all four tools; Express app with `/health` and `/mcp`                                                                  |
| `src/lib/chronova-client.ts`            | `ChronovaClient`: `get<T>(path, params)`, `fetch`, Bearer auth, 30s `AbortSignal.timeout`                                                                  |
| `src/lib/config.ts`                     | `resolveConfig()` — env → `~/.chronova.cfg` → `~/.wakatime.cfg` → defaults                                                                                 |
| `src/lib/errors.ts`                     | `ChronovaApiError`, `mapHttpStatusToError`, `mapNetworkError`                                                                                              |
| `src/lib/types.ts`                      | Response interfaces: `ChronovaUser`, `ChronovaStatsRange`, `ChronovaHeartbeat`, `ChronovaHeartbeatResponse`, `ChronovaAiAnalytics`                         |
| `src/tools/get-developer-context.ts`    | `get_developer_context` → `users/current` (profile, subscription, GitHub orgs)                                                                             |
| `src/tools/get-productivity-summary.ts` | `get_productivity_summary` → `users/current/stats/{range}` (languages, projects, editors)                                                                  |
| `src/tools/get-recent-activity.ts`      | `get_recent_activity` → `users/current/heartbeats` (paginated coding events)                                                                               |
| `src/tools/get-ai-insights.ts`          | `get_ai_insights` → `users/current/analytics/ai` (AI-assisted coding analytics)                                                                            |
| `tests/integration/`                    | `*.test.ts` integration tests (server, tools, errors, config)                                                                                              |
| `tests/helpers/mock-server.ts`          | `mockChronovaApi`, `startMcpTestServer`, `initSession`, `callTool`                                                                                         |
| `.github/workflows/`                    | CI: `test.yml`, `release.yml`, Claude Code automation (`claude.yml`, `claude-ci.yml`, `claude-code-review.yml`, `claude-fix-issue.yml`), `auto-manage.yml` |

## Development Commands

```bash
bun install                # install deps (uses bun.lock)
bun run build              # bun build → dist/ (ESM) + tsc --emitDeclarationOnly → .d.ts
bun run type-check         # tsc --noEmit
bun run lint               # oxlint --react-plugin --vitest-plugin --import-plugin
bun run lint:fix           # oxlint --fix
bun run format             # oxfmt (write)
bun run format:check       # oxfmt --check
bun run test               # vitest run
bun run start              # bun dist/index.js   (HTTP mode)
bun run dev                # bun --watch src/index.ts
bun run semantic-release   # release pipeline (CI only)
```

Package manager and build tool: **Bun** (`bun.lock` committed; `packageManager` pins the version). `bun build` bundles the two entrypoints with `--packages external`, and `tsc --emitDeclarationOnly` emits the `.d.ts` tree alongside.

Runtime: the Docker image runs **Bun** (`oven/bun:1-alpine`). The published npm bin keeps its `#!/usr/bin/env node` shebang and targets **Node.js ≥ 18**, so `dist/` is built with `--target node`.

Required env (see `.env.example`):

- `CHRONOVA_API_KEY` — required Bearer token (no default; stdio exits without it)
- `CHRONOVA_API_URL` — default `https://chronova.dev/api/v1`
- `PORT` — default `3001`

## Code Conventions & Common Patterns

- **Module system**: ESM (`"type": "module"`). Imports from `@modelcontextprotocol/sdk` use deep paths (`/server/mcp.js`, `/server/streamableHttp.js`, `/server/stdio.js`).
- **TypeScript**: `strict`, ES2022, Node16 module/resolution. Declarations + source maps emitted. No `any`, no `ts-ignore`, no `console.log` (oxlint enforced — use `console.error`/`console.warn` only). Unused vars allowed if prefixed `_`.
- **File naming**: `kebab-case` for tool files (`get-recent-activity.ts`), `camelCase` for lib files (`chronova-client.ts`). Test files `*.test.ts`.
- **Exports**: Named exports only; no `default` exports. Factory functions named `create<X>` (`createApp`), resolvers `resolve<X>` (`resolveConfig`), tool registrars `register<ToolName>`.
- **Tool handler shape**: `async (args) => { try { const data = await chronova.get(...); return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }; } catch (e) { return { content: [{ type: "text", text: (e as Error).message }], isError: true }; } }`.
- **Input validation**: Zod v4 schemas passed as `inputSchema` to `registerTool`. The MCP SDK validates before the handler runs.
- **Tool annotations**: All tools set `annotations.readOnlyHint: true` (no mutations).
- **HTTP client**: Single `ChronovaClient` instance injected into tools. `fetch` with `AbortSignal.timeout(30_000)`. Non-2xx → `mapHttpStatusToError`; `TypeError`/`AbortError` → `mapNetworkError`. Bearer token from resolved config.
- **Error surface**: Handlers catch `ChronovaApiError` and return `isError: true` text — never rethrow, never leak stack traces.
- **Config precedence**: env > `~/.chronova.cfg` > `~/.wakatime.cfg` > defaults. Config files are INI.

## Important Files

- `src/index.ts` — HTTP entrypoint, CLI flag parsing, `createApp`/`startServer`
- `src/stdio.ts` — stdio entrypoint (the npm `bin` target)
- `src/server.ts` — central file: builds `McpServer`, registers all tools, wires Express `/health` + `/mcp`
- `src/lib/chronova-client.ts` — the only outward HTTP boundary; every tool goes through it
- `src/lib/config.ts` — `resolveConfig()`; the single source of truth for runtime config
- `src/lib/errors.ts` — error class + two mappers; extend here when adding new HTTP status handling
- `package.json` — scripts, deps, `engines.node`, `bin`, `publishConfig.access: public`
- `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `vitest.config.ts` — toolchain config
- `Dockerfile` — two-stage `oven/bun:1-alpine`, exposes 3001, runs `bun dist/index.js` (HTTP only)
- `.releaserc.json` — semantic-release: `main`/`beta`/`alpha` branches, conventional commits
- `.env.example` — canonical env var list

## Runtime/Tooling Preferences

- **Bun** is the package manager and build tool (`bun.lock`); do not introduce `npm`/`pnpm`/`yarn` lockfiles. `npm` remains the _publish registry_ only.
- ESM throughout. `bun build --target node` produces `dist/`, so the published bin still runs under **Node.js ≥ 18**; the container runs it under Bun.
- **`bun build` is the bundler** (`--packages external`, so declared dependencies stay external). `tsc` is kept solely for `--noEmit` type-checking and `--emitDeclarationOnly`. What ships is `dist/` + `README.md` (see `package.json` `files`).
- **Express v5** for HTTP transport; **Zod v4** for tool input schemas; **`@modelcontextprotocol/sdk` v1.29+** for the MCP protocol layer.
- **Vitest** for tests; **oxlint** (`.oxlintrc.json`, `correctness` category + the SG rules) for linting and **oxfmt** (`.oxfmtrc.json`) for formatting. Lint runs with `--react-plugin --vitest-plugin --import-plugin`.
- **semantic-release** handles versioning on `main` — do not manually bump `package.json` version or edit `CHANGELOG.md`.

## Testing & QA

- **Framework**: Vitest (`vitest.config.ts`). No coverage config; tests live in `tests/integration/*.test.ts`. Default 30s timeout.
- **Naming**: `*.test.ts`. Integration tests in `tests/integration/`; shared helpers in `tests/helpers/`.
- **Harness** (`tests/helpers/mock-server.ts`):
  - `mockChronovaApi` — mock `fetch` for the Chronova API (`respond`/`respondOnce`); no real network.
  - `startMcpTestServer(app)` — spawns the Express server on a random port.
  - `initSession` — sends MCP `initialize`.
  - `callTool` — invokes a tool and returns the parsed result.
- **Pattern**: tests exercise the full MCP-over-HTTP path (initialize → call tool → assert). Tool responses are parsed from `content[0].text` (JSON strings). Errors asserted via `isError: true` and message text.
- **Mocking**: all external calls go through `mockChronovaApi`; never hit `chronova.dev` in tests. Inline fixtures (e.g. `mockUser`, `mockStats`); no external fixture files.
- **Error cases**: tests cover 401, 429, 500, 502, 404, and network failure paths.

### Adding a new tool — checklist

1. Create `src/tools/<tool-name>.ts` exporting `register<ToolName>(server, chronova)` (follow existing files).
2. Define a Zod schema for inputs; set `annotations.readOnlyHint: true` (all tools are read-only).
3. Handler: `try { return { content: [{ type: "text", text: JSON.stringify(await chronova.get(path, params), null, 2) }] } } catch (e) { return { content: [{ type: "text", text: (e as Error).message }], isError: true } }`.
4. Wire it into `src/server.ts` alongside the other `register<ToolName>` calls.
5. Add response types to `src/lib/types.ts` if the Chronova endpoint returns a new shape.
6. Add an integration test in `tests/integration/tools.test.ts` using `mockChronovaApi` + `callTool`; cover the success path and at least one error status.

### Adding a new Chronova endpoint error class

- Extend `mapHttpStatusToError` in `src/lib/errors.ts` for new status codes; add a `code` constant and any extra fields (e.g. `retryAfter`).
- Add a test case in `tests/integration/errors.test.ts` using `mockChronovaApi.respond(path, { status, body })`.

## CI/CD

- `test.yml` — type-check + lint (oxlint) + format check (oxfmt) + build + test on push/PR to `main`, `develop`, feature branches. All jobs install with `bun install --frozen-lockfile`.
- `release.yml` — runs tests then `semantic-release` on `main` pushes (conventional commits → npm + GitHub release + `CHANGELOG.md`).
- `claude.yml`, `claude-ci.yml`, `claude-code-review.yml`, `claude-fix-issue.yml` — Claude Code automation (issue triage, PR labeling, PR review, `/claude` comment triggers).
- `auto-manage.yml` — auto-tags issues `needs-triage`, assigns to `niklasschaeffer`.
- `renovate.json` — recommended preset; automated dependency PRs.

Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `docs:`, `ci:`, `BREAKING CHANGE:`). `feat` → minor, `fix` → patch, `BREAKING CHANGE` → major. Do not manually version or edit `CHANGELOG.md`.

## Structural code search (ast-grep)

Use `ast-grep` — not `grep`/`rg` — for anything **structural**: finding call
sites, function/class/JSX shapes, or code matching a pattern rather than a
string. Use it for **every multi-file rewrite**. Text search also hits
comments, strings and unrelated identifiers; ast-grep matches AST nodes.

Fall back to `rg` only for literal text, non-code files (Markdown, JSON, lock
files), or languages ast-grep cannot parse.

```bash
# Search — single-node patterns. Always single-quote: "$A" is shell-expanded.
ast-grep run -p 'console.log($ARG)' -l ts src/
ast-grep run -p 'useEffect($CB, $DEPS)' -l tsx --json src/ | jq -r '.[].file'

# Search — relational / composite queries
ast-grep scan --inline-rules 'id: await-in-loop
language: TypeScript
rule:
  kind: for_in_statement
  has:
    pattern: await $E
    stopBy: end' src/

# Rewrite — prints a diff by default; -i reviews each edit, -U applies all
ast-grep run -p 'var $N = $V' -r 'let $N = $V' -l ts -i src/
```

Non-obvious rules, in the order they bite:

- Invoke it as `ast-grep`, never the `sg` alias — `sg` collides with
  shadow-utils' setgid tool on Linux.
- **Single-quote patterns.** `"$PROP && $PROP()"` reaches ast-grep as `" && ()"`
  after shell expansion.
- In relational rules (`has`, `inside`, `precedes`, `follows`) set
  `stopBy: end`, or the search stops at the first non-matching node.
- **Write inline rules in block YAML, not flow maps.** `has: { pattern: f() { $$$B }, stopBy: end }`
  fails to parse — the pattern's `}` closes the flow mapping. Indented keys
  always work.
- **Zero matches ≠ code absent.** Patterns match whole AST nodes, so
  `-p 'log($MSG)'` does _not_ match `console.log("hello")`. Before concluding
  something isn't there, inspect the parse: `--debug-query=pattern` shows how
  ast-grep read your pattern, `--debug-query=ast` shows the named nodes.
- `--inline-rules` works in any directory; bare `ast-grep scan` (project rule
  dirs) requires an `sgconfig.yml` at the repo root.
- Not on `PATH` — CI runners included: `bun add -g @ast-grep/cli`.

Full reference: <https://ast-grep.github.io/llms-full.txt>

When a query needs a real YAML rule rather than a one-line pattern, invoke the
`ast-grep:ast-grep` skill (rule syntax, relational/composite rules, debugging
checklist); `ast-grep:outline` gives a file's structure. Both ship with the
`ast-grep` plugin; when it isn't installed (CI runners), fall back to the
reference linked above rather than reconstructing rule syntax from memory.

## Claude Code CI automation

The `.github/workflows/claude-*.yml` workflows run Claude Code through
`anthropics/claude-code-action@v1` and invoke the project commands in
`.claude/commands/` as slash commands, e.g. `/review-pr 42`. `$ARGUMENTS` is
expanded by Claude Code itself.

Tool permissions for those runs are declared centrally per job via
`claude_args: --allowedTools ...` in the workflow — deliberately not in command
frontmatter, so there is one place to look.

`gh label create` is not idempotent: it exits 422 when the label already
exists. Always append `|| true`.

# Repository Guidelines

`@chronova/mcp-server` exposes Chronova's developer-productivity data to MCP
clients through four **read-only** tools, over two transports — stdio (the npm
bin, for local subprocess clients) and HTTP/Express — with an identical tool
surface.

**What belongs in this file: what you cannot infer from the repository in a
minute, and what you would otherwise get wrong by assuming.** File lists,
script names and dependency versions are deliberately absent — `ls`,
`package.json` and `.env.example` answer those, and they stay correct, which a
copy here does not.

## Shape

`src/index.ts` (HTTP) and `src/stdio.ts` (stdio) both build the same
`McpServer` from `src/server.ts`. Every tool reaches the Chronova API through
the single `ChronovaClient` in `src/lib/chronova-client.ts` — that is the only
outward HTTP boundary, and new code keeps it that way.

Config resolves in this order, INI format: environment → `~/.chronova.cfg` →
`~/.wakatime.cfg` → defaults. Reading the WakaTime file is deliberate; a user
who already has a WakaTime setup should not need a second one.

## Tool contract

- Every tool sets `annotations.readOnlyHint: true`. This server mutates
  nothing, and a tool that needs to would be a different conversation.
- Inputs are Zod v4 schemas passed as `inputSchema`; the MCP SDK validates
  before the handler runs, so a handler never re-checks its arguments.
- A handler **never rethrows**. It catches, and returns
  `{ content: [...], isError: true }` with the message — an MCP client shows
  that to a user, so no stack traces and no internal paths.
- Responses are JSON in a text block: `JSON.stringify(data, null, 2)`.

`src/lib/errors.ts` maps transport failures to the codes clients branch on:
401 → `UNAUTHORIZED`, 429 → `RATE_LIMITED` (carrying `retryAfter`), 404 →
`NOT_FOUND`, 5xx → `SERVER_ERROR`, network or abort → `CONNECTION_ERROR`.
Adding a status means extending the mapper, not handling it at the call site.

## Adding a tool

1. `src/tools/<tool-name>.ts` exporting `register<ToolName>(server, chronova)`.
2. Zod schema, `readOnlyHint: true`, the handler shape above.
3. Wire it into `src/server.ts` beside the other registrars.
4. New response shape → `src/lib/types.ts`.
5. Integration test in `tests/integration/tools.test.ts`: the success path and
   at least one error status.

## Build and runtime

`bun build ... --target node` is the load-bearing detail. Bun is the package
manager and bundler, the Docker image runs Bun, but the published bin keeps its
`#!/usr/bin/env node` shebang and must run under **Node ≥ 18** on a user's
machine. `tsc` is kept only for `--noEmit` and `--emitDeclarationOnly`;
`--packages external` keeps declared dependencies out of the bundle.

Do not add an `npm`, `pnpm` or `yarn` lockfile. npm is the publish registry,
not the package manager.

`semantic-release` owns the version and `CHANGELOG.md` on `main`. Never bump
either by hand.

## Conventions

- ESM throughout. `@modelcontextprotocol/sdk` is imported by deep path
  (`/server/mcp.js`, `/server/streamableHttp.js`, `/server/stdio.js`).
- Named exports only — no `default`. `create<X>` for factories, `resolve<X>`
  for resolvers, `register<ToolName>` for tool registrars.
- `console.log` is banned by oxlint; `console.error` and `console.warn` are
  fine. A stdio server writing to stdout corrupts the protocol stream.
- Unused variables are allowed when prefixed `_`.

## Testing

Vitest, everything under `tests/integration/`, exercising the real path:
initialize over HTTP → call tool → assert. Results are parsed out of
`content[0].text`, errors asserted through `isError: true`.

`tests/helpers/mock-server.ts` provides `mockChronovaApi`,
`startMcpTestServer`, `initSession` and `callTool`. **No test reaches
chronova.dev** — every outward call goes through the mock, including the
failure cases (401, 429, 500, 502, 404, network).

## Gates

```bash
bun run type-check
bun run lint
bun run format:check
bun run test
```

## Structural search (ast-grep)

Use `ast-grep`, not `grep`, for anything structural — call sites, function
shapes, and every multi-file rewrite. Repo-specific, in the order they bite:

- Invoke it as `ast-grep`, never the `sg` alias — `sg` collides with
  shadow-utils' setgid tool on Linux.
- Single-quote every pattern: `"$A && $A()"` reaches ast-grep as `" && ()"`
  after shell expansion.
- Zero matches is not absence — patterns match whole AST nodes, so
  `-p 'log($MSG)'` does not match `console.log("x")`. Check with
  `--debug-query=pattern` before concluding anything.
- Not on `PATH`, CI runners included: `bun add -g @ast-grep/cli`.
- `sgconfig.yml` points at `sg/rules`, so a bare `ast-grep scan` runs the
  project rules; `ast-grep test` runs them against `sg/rule-tests` and its
  snapshots. Neither is wired into a gate — run them deliberately, and
  regenerate snapshots with `ast-grep test -U` after changing a rule.

Reference: <https://ast-grep.github.io/llms-full.txt>

## Claude Code CI automation

The `.github/workflows/claude-*.yml` workflows run Claude Code through
`anthropics/claude-code-action@v1` and invoke the commands in
`.claude/commands/` as slash commands, e.g. `/review-pr 42`. Tool permissions
are declared per job via `claude_args: --allowedTools ...` in the workflow —
deliberately not in command frontmatter, so there is one place to look.

`gh label create` exits 422 when the label already exists. Always pass
`--force`: it upserts, and unlike `|| true` it still surfaces a real failure
such as a bad token or the wrong repository.

Commits follow Conventional Commits, and the squash subject of a pull request
is what `semantic-release` reads.

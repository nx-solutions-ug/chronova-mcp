# Testing

The project uses [Vitest](https://vitest.dev/) with a custom MCP test harness. There is no separate unit-test layer; all four suites are integration tests that boot the real Express app.

## Layout

```
tests/
├── helpers/
│   └── mock-server.ts      # mockChronovaApi, startMcpTestServer, initSession, callTool
└── integration/
    ├── config.test.ts      # resolveConfig + parseIniFile behavior
    ├── errors.test.ts      # HTTP/network error propagation through tool calls
    ├── server.test.ts      # /health, MCP initialize, tools/list, session handling
    └── tools.test.ts       # Per-tool happy path + 401 propagation
```

`vitest.config.ts` matches `tests/**/*.test.ts` and uses a 30 s timeout (the ChronovaClient also has a 30 s timeout).

## Running

```bash
npm test                 # vitest run
npm run type-check       # before opening a PR
npm run lint             # before opening a PR
```

CI (`.github/workflows/test.yml`) runs the same commands on push and PR to `main`, `develop`, `feat/*`, `fix/*`.

## Test harness (`tests/helpers/mock-server.ts`)

Two cooperating utilities make the integration tests possible without a real Chronova backend.

### `mockChronovaApi()`

Replaces `globalThis.fetch` with a Vitest `vi.fn` that matches URLs against registered handlers. The match runs **last-to-first**, so later handlers shadow earlier ones.

```ts
const mockApi = mockChronovaApi();
mockApi.setup();

mockApi.respond("users/current", { status: 200, body: { data: mockUser } });
mockApi.respondOnce("users/current/stats/last_7_days", {
  status: 200, body: { data: mockStats },
});
// ...exercise code under test...
mockApi.restore();
mockApi.callCount();      // total fetch invocations
```

- `respond` — persistent handler
- `respondOnce` — consumed on first match
- `setup` / `restore` — install / uninstall the mock
- `callCount` — diagnostic

The mock only intercepts URLs that match a registered pattern. Anything else falls through to the original `fetch` (useful when the test code also talks to the MCP test server over `http://127.0.0.1:...`).

### `startMcpTestServer(app)` + `initSession(server)`

`startMcpTestServer` boots the Express app on an ephemeral port (`listen(0)`) and exposes a `request(mcpReq)` helper that:

- Sets `Content-Type: application/json` and `Accept: application/json, text/event-stream`
- Attaches the current `Mcp-Session-Id` if the test already initialized one
- Parses the SSE response back into a single `McpResponse`

`initSession(server)` runs the standard MCP handshake:

1. `initialize` (with `protocolVersion: "2025-03-26"`, `clientInfo: { name: "test-client", version: "1.0.0" }`)
2. `notifications/initialized`

`callTool(server, name, args)` wraps `tools/call` and returns the `result` payload.

## Conventions

- **Test config is fixed.** Every integration test creates a `ChronovaConfig` with `apiKey: "test-api-key"` and `apiUrl: "https://chronova.test/api/v1"`. There is no env-var juggling.
- **One app per test.** `beforeEach` calls `createApp(TEST_CONFIG)`; `afterEach` calls `mockApi.restore()` and `mcpServer.close()`.
- **Mock URLs use substring matches.** `"users/current"` matches any URL containing that string, so the test does not need to know about query strings.
- **Error tests assert on substrings**, not exact text. The tests check for `Unauthorized`, `CHRONOVA_API_KEY`, `Rate limited`, `30`, `Cannot connect`, `Chronova server error`, `Not found`. If you rewrite an error message, update the test strings.

## What to run after common changes

| Change | Minimum checks |
|---|---|
| New tool or tool params | `npm test` (covers `tools.test.ts`) + update schema in `tools.md` |
| `ChronovaClient` behavior | `npm test` (covers `errors.test.ts` for HTTP/network) + consider new error test |
| `mapHttpStatusToError` | `npm test` (covers 401/404/429/500/502/network) |
| `resolveConfig` / `parseIniFile` | `npm test` (covers `config.test.ts`) |
| MCP transport (`server.ts`) | `npm test` (covers `server.test.ts`) + consider new session lifecycle test |
| Workflows / Dockerfile | Trigger CI, observe `test` job results |
| Dependency bumps | `npm test`, `npm run type-check`, `npm run lint` |

## Adding a test

1. Import the harness from `tests/helpers/mock-server.ts` and `createApp` from `src/server.ts`.
2. In `beforeEach`, set up `mockChronovaApi`, `createApp(TEST_CONFIG)`, `startMcpTestServer`, and `initSession`.
3. Register mock responses with `mockApi.respond` using the upstream path the tool will hit.
4. Use `callTool(mcpServer, "tool_name", args)` to invoke the tool and assert on the result.
5. In `afterEach`, call `mockApi.restore()` and `await mcpServer.close()`.

Keep the assertions in the same shape as the existing tests (`result.content[0].text` JSON-parsed, `result.isError` checked separately) so the suite stays uniform.

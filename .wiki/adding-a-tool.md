---
type: Development Guide
title: "Adding a new MCP tool"
description: "Step-by-step checklist for adding a new read-only MCP tool to @chronova/mcp-server, from registration to integration test."
tags: [development, tools, mcp, contributing]
---

# Adding a new MCP tool

The server follows a strict, repeatable shape for every tool. Use this checklist to add a new read-only MCP tool end-to-end.

## 1. Create the tool file

`src/tools/<tool-name>.ts` — kebab-case filename, one tool per file. Export a single `register<ToolName>(server: McpServer, chronova: ChronovaClient)` function.

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";
import { formatToolError } from "../lib/errors.js";
import type { MyNewResponse } from "../lib/types.js";

export function registerMyNewTool(
  server: McpServer,
  chronova: ChronovaClient,
): void {
  server.registerTool(
    "my_new_tool",
    {
      description: "Short, action-oriented description for the agent.",
      inputSchema: z.object({
        // … Zod schema, all fields documented with .describe()
      }),
      annotations: { readOnlyHint: true }, // required — all tools are read-only
    },
    async (args) => {
      try {
        const response = await chronova.get<{ data: MyNewResponse }>(
          "users/current/my-endpoint",
          { /* query params */ },
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}
```

Conventions enforced by ESLint and code review:

- **No `any`** (`@typescript-eslint/no-explicit-any: error`).
- **No `ts-ignore`** (`@typescript-eslint/ban-ts-comment: error`).
- **No `console.log`** — use `console.error` or `console.warn` (to stderr) if you must.
- **No empty catch blocks**.
- Unused arguments must be prefixed with `_` to silence `no-unused-vars`.
- Always set `annotations.readOnlyHint: true`.

## 2. Add response types to `src/lib/types.ts`

If the Chronova endpoint returns a shape the existing types don't cover, add a new interface here. The server passes JSON through unchanged, so field names should match the wire format (snake_case).

## 3. Wire the tool into `src/tools/index.ts`

`src/tools/index.ts` exports `registerAllTools(server, chronova)`. Import your new registrar and call it from `registerAllTools`. Because both `src/server.ts` (HTTP) and `src/stdio.ts` (stdio) call `registerAllTools`, a new tool only needs to be added in one place.

```ts
import { registerMyNewTool } from "./my-new-tool.js";

export function registerAllTools(server: McpServer, chronova: ChronovaClient): void {
  registerGetAiInsights(server, chronova);
  registerGetDeveloperContext(server, chronova);
  registerGetProductivitySummary(server, chronova);
  registerGetRecentActivity(server, chronova);
  registerMyNewTool(server, chronova);   // <- new tool
}
```

If the Chronova endpoint needs a new error code (e.g. `402`, `503` with retry semantics), extend `mapHttpStatusToError` in `src/lib/errors.ts` rather than special-casing inside the handler.

## 4. Write the integration test

Add a `describe("<tool_name>")` block to `tests/integration/tools.test.ts`. The pattern is uniform:

```ts
describe("my_new_tool", () => {
  it("should return <expected shape>", async () => {
    mockApi.respond("users/current/my-endpoint", {
      status: 200,
      body: { data: mockMyNewResponse },
    });

    const result = (await callTool(mcpServer, "my_new_tool", { /* args */ })) as {
      content: Array<{ type: string; text: string }>;
    };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.<field>).toBe(<expected>);
  });

  it("should return error for 401 response", async () => {
    mockApi.respond("users/current/my-endpoint", {
      status: 401,
      body: { error: "Unauthorized" },
    });

    const result = (await callTool(mcpServer, "my_new_tool", { /* args */ })) as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unauthorized");
  });
});
```

For a new status-code path (e.g. `503` with `Retry-After`), add a test in `tests/integration/errors.test.ts` using the same `mockApi.respond(path, { status, body, headers })` pattern.

Mock fixtures are defined inline in `tools.test.ts` — there are no external fixture files.

## 5. Update the `tools/list` count and document the tool

`tests/integration/server.test.ts` asserts that `tools/list` returns **exactly 4 tools**. After adding a tool, update the count and add the new tool name to the sorted expected list in the `should list exactly N tools` test.

The wiki is auto-regenerated, but you should add a dedicated page under `.wiki/tools/`:

- `<tool-name>.md` — description, parameters, response shape, error behavior, test coverage.
- Update `.wiki/tools/index.md` "Tools at a glance" table to include the new row.
- Update `.wiki/domain/chronova-api.md` if you added a new endpoint or response type.

## 6. Sanity checks before opening the PR

```bash
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run (full integration suite)
```

The CI pipeline (`.github/workflows/test.yml`) runs all three in parallel on every push and PR.

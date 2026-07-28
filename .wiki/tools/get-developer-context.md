---
type: Tools Reference
title: "get_developer_context"
description: "Returns the authenticated user's Chronova profile, subscription, GitHub integration status, and organization memberships."
tags: [tools, mcp, chronova, profile]
---

# `get_developer_context`

Returns the authenticated user's developer profile as recorded by Chronova. Takes **no parameters** — the API key in the resolved config identifies the user.

- **Source**: `src/tools/get-developer-context.ts` → `registerGetDeveloperContext`
- **Chronova endpoint**: `GET users/current`
- **Annotations**: `readOnlyHint: true`
- **Response envelope**: `{ data: ChronovaUser }` (handler returns `response.data`)

## Parameters

None. The input schema is `z.object({})`.

## Response shape

The handler returns `JSON.stringify(response.data, null, 2)`. The full `ChronovaUser` interface (from `src/lib/types.ts`):

```ts
interface ChronovaUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  subscription: {
    plan: string;
    status: string;
  };
  github_connected: boolean;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  created_at: string;  // ISO 8601
  modified_at: string; // ISO 8601
}
```

## Example

```json
{
  "id": "1",
  "username": "testuser",
  "email": "test@example.com",
  "avatar_url": null,
  "subscription": { "plan": "pro", "status": "active" },
  "github_connected": true,
  "organizations": [{ "id": "org1", "name": "TestOrg", "role": "admin" }],
  "created_at": "2024-01-01T00:00:00Z",
  "modified_at": "2024-06-01T00:00:00Z"
}
```

## Error behavior

Same as all tools: non-2xx responses and network failures are mapped through `formatToolError`. A 401 returns `isError: true` with the message `"Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration."`. See [Domain: Errors](../domain/errors.md) for the full mapping table.

## Test coverage

`tests/integration/tools.test.ts` → `describe("get_developer_context")` covers the happy path (asserts `username`, `email`, and `subscription.plan` on the parsed JSON) and the 401 path (asserts `isError: true` plus the `CHRONOVA_API_KEY` guidance string).

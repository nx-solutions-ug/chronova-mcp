---
type: Tool
id: get_developer_context
title: "Tool: get_developer_context"
description: "Fetch the authenticated Chronova user's profile, subscription, GitHub status, and organization memberships."
tags: [tools, reference, developer-context]
---

# `get_developer_context`

Returns the authenticated user's developer profile, subscription status, GitHub integration status, and organization memberships.

## Registration

- **Source**: `src/tools/get-developer-context.ts`
- **Function**: `registerGetDeveloperContext(server, chronova)`
- **Handler shape**: `async () => { ... }` — no parameters.

## Input schema

```ts
z.object({})
```

No input is required. The tool uses the configured API key to identify the user.

## Chronova API call

| Method | Path | Auth |
|---|---|---|
| GET | `users/current` | `Authorization: Bearer <api_key>` |

The response is typed as `{ data: ChronovaUser }` in `src/lib/types.ts` and unwrapped before returning.

## Response shape (`ChronovaUser`)

```ts
interface ChronovaUser {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  subscription?: { plan: string; status: string };
  github_connected: boolean;
  organizations: Array<{ id: string; name: string; role?: string }>;
  created_at: string;
  modified_at: string;
}
```

## MCP response

On success:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{ \"id\": \"...\", \"username\": \"...\", ... }"
    }
  ]
}
```

On error:

```json
{
  "content": [
    { "type": "text", "text": "Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration." }
  ],
  "isError": true
}
```

Errors are formatted by `formatToolError` in `src/lib/errors.ts` and never include stack traces. Common errors are `401 Unauthorized` (missing/invalid key) and `SERVER_ERROR` for Chronova API failures.

## Related

- [Chronova API contract & types](../domain/chronova-api.md)
- [Errors & status mapping](../domain/errors.md)
- [Architecture → Tool registration pattern](../architecture/overview.md#tool-registration-pattern)
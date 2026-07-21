---
type: Tool Reference
title: "Tool: get_developer_context"
description: "Read the authenticated Chronova user's profile, subscription, GitHub integration, and organization memberships."
tags: [tools, mcp, get-developer-context]
---

# `get_developer_context`

Returns the authenticated user's developer profile from the Chronova API.

- **Endpoint**: `GET users/current`
- **Source**: `src/tools/get-developer-context.ts`
- **Parameters**: none
- **Read-only hint**: `true`

## Handler

```ts
const response = await chronova.get<{ data: ChronovaUser }>("users/current");
return {
  content: [
    { type: "text", text: JSON.stringify(response.data, null, 2) },
  ],
};
```

## Response shape (`ChronovaUser`)

```ts
{
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  subscription: { plan: string; status: string };
  github_connected: boolean;
  organizations: Array<{ id: string; name: string; role: string }>;
  created_at: string;
  modified_at: string;
}
```

## Errors

- `401 UNAUTHORIZED` if the API key is missing or invalid.

No input schema parameters are required — the tool uses the API key resolved at startup.

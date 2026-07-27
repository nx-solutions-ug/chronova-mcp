---
type: Tool
title: "get_developer_context"
description: "Return the authenticated user's Chronova developer profile."
tags: [tools, mcp, chronova]
---

# `get_developer_context`

Returns the authenticated user's developer profile, subscription status, GitHub integration status, and organization memberships.

## Parameters

None. The tool uses the configured API key (`CHRONOVA_API_KEY` or a config file) to identify the user.

## Chronova endpoint

- **Method:** GET
- **Path:** `users/current`
- **Response envelope:** `{ data: ChronovaUser }`

See [Chronova API contract & types](../domain/chronova-api.md#type-reference) for the `ChronovaUser` shape.

## MCP registration

Registered in `src/server.ts` via `registerGetDeveloperContext(server, chronova)`. The handler lives in `src/tools/get-developer-context.ts`.

## Returns

A JSON text content object containing:

- `id` — user identifier
- `username`
- `email`
- `avatar_url`
- `subscription` — `{ plan, status }`
- `github_connected`
- `organizations` — array of `{ id, name, role }`
- `created_at` / `modified_at`

## Errors

A missing or invalid API key surfaces as a tool error (`isError: true`) with the message:

> Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration.

See [Errors & status mapping](../domain/errors.md) for the full mapping.

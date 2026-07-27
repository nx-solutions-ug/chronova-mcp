---
type: Tool
title: "get_recent_activity"
description: "Return paginated recent coding heartbeats with optional filters."
tags: [tools, mcp, chronova]
---

# `get_recent_activity`

Returns recent coding heartbeats (activity events) for the authenticated user. Results are paginated and can be filtered by date, date range, project, language, or editor.

## Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `date` | string (`YYYY-MM-DD`) | No | Filter by a specific date. |
| `start` | string (`YYYY-MM-DD`) | No | Start date for a range filter. |
| `end` | string (`YYYY-MM-DD`) | No | End date for a range filter. |
| `project` | string | No | Filter by project name. |
| `language` | string | No | Filter by programming language. |
| `editor` | string | No | Filter by editor/IDE name. |
| `page` | positive integer | No | Page number (default: 1). |
| `per_page` | positive integer | No | Results per page (default: 100, max: 100). |

All parameters are optional.

## Chronova endpoint

- **Method:** GET
- **Path:** `users/current/heartbeats`
- **Query params:** `date`, `start`, `end`, `project`, `language`, `editor`, `page`, `per_page`
- **Response envelope:** `ChronovaHeartbeatResponse` (no `{ data }` wrapper)

See [Chronova API contract & types](../domain/chronova-api.md#type-reference) for the `ChronovaHeartbeat` and `ChronovaHeartbeatResponse` shapes.

## MCP registration

Registered in `src/server.ts` via `registerGetRecentActivity(server, chronova)`. The handler lives in `src/tools/get-recent-activity.ts`.

## Returns

A JSON text content object containing:

- `heartbeats` — array of heartbeat objects with `id`, `time`, `type`, `project`, `language`, `editor`, `operating_system`, `machine`, `branch`, `created_at`
- `total` — total number of matching events

## Errors

- Invalid API key → `UNAUTHORIZED` tool error.
- Server-side failures → `SERVER_ERROR` tool error.

See [Errors & status mapping](../domain/errors.md) for the full mapping.

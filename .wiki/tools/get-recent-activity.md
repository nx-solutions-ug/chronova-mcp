---
type: Tool Reference
title: "Tool: get_recent_activity"
description: "Fetch paginated recent coding heartbeats from the Chronova API with date, project, language, and editor filters."
tags: [tools, mcp, get-recent-activity]
---

# `get_recent_activity`

Returns recent coding activity events (heartbeats) as a paginated list.

- **Endpoint**: `GET users/current/heartbeats`
- **Source**: `src/tools/get-recent-activity.ts`
- **Read-only hint**: `true`

## Input schema

All parameters are optional.

| Parameter | Type | Description |
|---|---|---|
| `date` | `string` (`YYYY-MM-DD`) | Filter to a single date |
| `start` | `string` (`YYYY-MM-DD`) | Start of a date range |
| `end` | `string` (`YYYY-MM-DD`) | End of a date range (use with `start`) |
| `project` | `string` | Filter by project name |
| `language` | `string` | Filter by programming language |
| `editor` | `string` | Filter by editor/IDE name |
| `page` | `number` (positive int) | Page number (default: 1) |
| `per_page` | `number` (positive int) | Results per page (default: 100, max: 100) |

## Handler

The handler builds a query-params record from every supplied filter, converts `page`/`per_page` numbers to strings, and calls `chronova.get<ChronovaHeartbeatResponse>("users/current/heartbeats", params)`.

Unlike the other tools, this endpoint returns the raw response object (not wrapped in `{ data: ... }`), so the tool serializes `response` directly.

## Response shape (`ChronovaHeartbeatResponse`)

```ts
{
  heartbeats: ChronovaHeartbeat[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
```

### `ChronovaHeartbeat`

```ts
{
  id: string;
  time: string;
  type: string;
  project: string | null;
  language: string | null;
  editor: string | null;
  operating_system: string | null;
  machine: string | null;
  branch: string | null;
  created_at: string;
}
```

## Errors

- `401 UNAUTHORIZED` for an invalid/missing API key.

Use `page`/`per_page` to navigate large result sets; the response includes `total_pages`.

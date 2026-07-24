---
type: Tool
id: get_recent_activity
title: "Tool: get_recent_activity"
description: "Fetch paginated recent coding heartbeats with optional date, project, language, editor, and pagination filters."
tags: [tools, reference, activity]
---

# `get_recent_activity`

Returns recent coding heartbeats — individual coding activity events recorded by the Chronova tracker — with optional filters and pagination.

## Registration

- **Source**: `src/tools/get-recent-activity.ts`
- **Function**: `registerGetRecentActivity(server, chronova)`

## Input schema

```ts
z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter by specific date (YYYY-MM-DD)"),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Start date for range (YYYY-MM-DD)"),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date for range (YYYY-MM-DD)"),
  project: z.string().optional().describe("Filter by project name"),
  language: z.string().optional().describe("Filter by programming language"),
  editor: z.string().optional().describe("Filter by editor/IDE name"),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Page number for pagination (default: 1)"),
  per_page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Results per page (default: 100, max: 100)"),
})
```

All parameters are optional.

## Chronova API call

| Method | Path | Query params |
|---|---|---|
| GET | `users/current/heartbeats` | `date`, `start`, `end`, `project`, `language`, `editor`, `page`, `per_page` |

Only provided filters are sent. Pagination parameters are converted to strings before the request.

## Response shape (`ChronovaHeartbeatResponse`)

```ts
interface ChronovaHeartbeat {
  id: string;
  time: string;
  type: string;
  project?: string;
  language?: string;
  editor?: string;
  operating_system?: string;
  machine?: string;
  branch?: string;
  created_at: string;
}

interface ChronovaHeartbeatResponse {
  heartbeats: ChronovaHeartbeat[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
```

Unlike the other three tools, `get_recent_activity` returns the raw `ChronovaHeartbeatResponse` object directly (no `{ data: ... }` envelope).

## MCP response

Success:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{ \"heartbeats\": [...], \"total\": ..., \"page\": 1, \"per_page\": 100, \"total_pages\": ... }"
    }
  ]
}
```

Error:

```json
{
  "content": [
    { "type": "text", "text": "Cannot connect to Chronova at https://chronova.dev/api/v1. Check CHRONOVA_API_URL configuration." }
  ],
  "isError": true
}
```

## Related

- [Chronova API contract & types](../domain/chronova-api.md)
- [Errors & status mapping](../domain/errors.md)
- [Architecture → Tool registration pattern](../architecture/overview.md#tool-registration-pattern)
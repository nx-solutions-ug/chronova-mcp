---
type: Tools Reference
title: "get_recent_activity"
description: "Paginated list of raw coding heartbeats (activity events) with optional filters by date, project, language, editor, and pagination."
tags: [tools, mcp, chronova, heartbeats, activity]
---

# `get_recent_activity`

Returns raw coding heartbeats — the most granular view of a user's coding activity. All filters are optional; without them the endpoint returns the most recent events.

- **Source**: `src/tools/get-recent-activity.ts` → `registerGetRecentActivity`
- **Chronova endpoint**: `GET users/current/heartbeats`
- **Annotations**: `readOnlyHint: true`
- **Response envelope**: raw `ChronovaHeartbeatResponse` (no `data` wrapper — `tools.test.ts` asserts `parsed.heartbeats` directly)

## Parameters

All optional. Each filter is a Zod-validated query parameter, omitted from the request when undefined or empty (see [Configuration notes](#configuration-notes)).

| Name | Type | Description |
|---|---|---|
| `date` | `YYYY-MM-DD` | Filter by a single day |
| `start` | `YYYY-MM-DD` | Inclusive range start (use with `end`) |
| `end` | `YYYY-MM-DD` | Inclusive range end (use with `start`) |
| `project` | string | Filter by project name |
| `language` | string | Filter by programming language |
| `editor` | string | Filter by editor/IDE name |
| `page` | positive integer | Page number (1-based) |
| `per_page` | positive integer | Results per page (default 100, max 100) |

`date`, `start`, and `end` are validated with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`. `page` and `per_page` use `z.number().int().positive()`.

## Response shape

```ts
interface ChronovaHeartbeatResponse {
  heartbeats: ChronovaHeartbeat[];
  total: number;       // total records across all pages
  page: number;        // current page (1-based)
  per_page: number;    // page size actually applied
  total_pages: number; // = ceil(total / per_page)
}

interface ChronovaHeartbeat {
  id: string;
  time: string;             // ISO 8601 timestamp
  type: string;             // e.g. "coding"
  project: string | null;
  language: string | null;
  editor: string | null;
  operating_system: string | null;
  machine: string | null;
  branch: string | null;
  created_at: string;       // ISO 8601
}
```

## Example

```json
{
  "heartbeats": [
    {
      "id": "hb1",
      "time": "2024-06-01T09:00:00Z",
      "type": "coding",
      "project": "chronova",
      "language": "TypeScript",
      "editor": "VS Code",
      "operating_system": "Linux",
      "machine": "dev-box",
      "branch": "main",
      "created_at": "2024-06-01T09:00:05Z"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 100,
  "total_pages": 1
}
```

## Configuration notes

- The handler builds the params object explicitly (`if (date !== undefined) params.date = date;` …) and passes it to `chronova.get` only if non-empty. The client omits undefined/empty values (see `src/lib/chronova-client.ts`).
- Numeric `page` and `per_page` are stringified (`String(page)`, `String(per_page)`) because `URLSearchParams` only accepts strings.
- The pagination model is offset-based, not cursor-based. For very large result sets, page through with `page` + `per_page`.

## Test coverage

`tests/integration/tools.test.ts` → `describe("get_recent_activity")` covers the no-arg happy path, a multi-filter call (`date` + `language` + `page` + `per_page`), and the 401 path. The mock fixture `mockHeartbeats` matches the shape above.

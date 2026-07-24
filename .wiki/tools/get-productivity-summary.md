---
type: Tool
id: get_productivity_summary
title: "Tool: get_productivity_summary"
description: "Fetch aggregated coding productivity statistics for a named time range, year, month, or custom date range."
tags: [tools, reference, productivity]
---

# `get_productivity_summary`

Returns aggregated coding productivity statistics — total time, language/project/editor/OS breakdowns, daily/hourly stats, and best day — for a given time range.

## Registration

- **Source**: `src/tools/get-productivity-summary.ts`
- **Function**: `registerGetProductivitySummary(server, chronova)`

## Input schema

```ts
z.object({
  range: z
    .enum([
      "today",
      "last_7_days",
      "last_30_days",
      "last_3_months",
      "last_6_months",
      "last_year",
      "all_time",
    ])
    .describe(
      'Time range for statistics. Named ranges or custom formats (YYYY for year, YYYY-MM for month, YYYY-MM-DD_to_YYYY-MM-DD for date range).',
    ),
  project: z
    .string()
    .optional()
    .describe("Filter results to a specific project name"),
})
```

## Range values

| Format | Example | Meaning |
|---|---|---|
| Named | `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time` | Predefined ranges |
| Year | `2024` | Whole year |
| Month | `2024-08` | Single month |
| Custom | `2024-08-01_to_2024-08-31` | Inclusive date range |

## Chronova API call

| Method | Path | Query params |
|---|---|---|
| GET | `users/current/stats/{range}` | `project` (optional) |

The range is interpolated into the path. If `project` is provided, it is sent as a query parameter; otherwise no params are sent.

## Response shape (`ChronovaStatsRange`)

```ts
interface ChronovaStatsRange {
  range: string;
  total_seconds: number;
  languages: Array<{ name: string; total_seconds: number; percent: number }>;
  projects: Array<{ name: string; total_seconds: number; percent: number }>;
  editors: Array<{ name: string; total_seconds: number; percent: number }>;
  operating_systems: Array<{ name: string; total_seconds: number; percent: number }>;
  daily_stats: Array<{ date: string; total_seconds: number }>;
  hourly_stats: Array<{ hour: number; total_seconds: number }>;
  best_day: { date: string; total_seconds: number } | null;
  start: string;
  end: string;
}
```

## MCP response

Success:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{ \"range\": \"last_7_days\", \"total_seconds\": ..., ... }"
    }
  ]
}
```

Error:

```json
{
  "content": [
    { "type": "text", "text": "Rate limited: Too many requests. Retry after 30 seconds." }
  ],
  "isError": true
}
```

## Related

- [Chronova API contract & types](../domain/chronova-api.md)
- [Errors & status mapping](../domain/errors.md)
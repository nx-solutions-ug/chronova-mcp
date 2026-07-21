---
type: Tool Reference
title: "Tool: get_productivity_summary"
description: "Get aggregated coding productivity statistics for a Chronova time range, with optional project filter."
tags: [tools, mcp, get-productivity-summary]
---

# `get_productivity_summary`

Returns aggregated coding stats for the requested time range.

- **Endpoint**: `GET users/current/stats/{range}`
- **Source**: `src/tools/get-productivity-summary.ts`
- **Read-only hint**: `true`

## Input schema

| Parameter | Type | Required | Description |
|---|---|---|---|
| `range` | `string` | Yes | Named range or custom date format |
| `project` | `string` | No | Filter to a single project name |

### Accepted `range` values

- Named ranges: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`
- Year: `YYYY`
- Month: `YYYY-MM`
- Custom date range: `YYYY-MM-DD_to_YYYY-MM-DD`

## Handler

```ts
const path = `users/current/stats/${range}`;
const params: Record<string, string> = {};
if (project) params.project = project;

const response = await chronova.get<{ data: ChronovaStatsRange }>(
  path,
  Object.keys(params).length > 0 ? params : undefined,
);
```

## Response shape (`ChronovaStatsRange`)

```ts
{
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

## Errors

- `401 UNAUTHORIZED` for an invalid/missing API key.
- `404 NOT_FOUND` if the requested range is not recognized.

The `project` parameter is passed as a query string only when supplied.

---
type: Tools Reference
title: "get_productivity_summary"
description: "Aggregated coding productivity statistics (totals, language/editor/project/OS breakdowns, daily and hourly stats) for a time range."
tags: [tools, mcp, chronova, stats, productivity]
---

# `get_productivity_summary`

Returns aggregated coding productivity statistics for a time range. The Chronova backend rolls up raw heartbeats into totals and per-language, per-project, per-editor, per-OS breakdowns, plus a daily and hourly profile.

- **Source**: `src/tools/get-productivity-summary.ts` → `registerGetProductivitySummary`
- **Chronova endpoint**: `GET users/current/stats/{range}?project={project}`
- **Annotations**: `readOnlyHint: true`
- **Response envelope**: `{ data: ChronovaStatsRange }` (handler returns `response.data`)

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `range` | enum (see below) | **yes** | Time range to aggregate over |
| `project` | string | no | Restrict the aggregation to a single project name |

`range` accepts the following values (Zod `enum`):

```
today, last_7_days, last_30_days, last_3_months,
last_6_months, last_year, all_time
```

The tool description also documents custom shapes the Chronova API supports (and that the server passes through as path segments):

- `YYYY` — single year (e.g. `2025`)
- `YYYY-MM` — single month (e.g. `2025-03`)
- `YYYY-MM-DD_to_YYYY-MM-DD` — custom date range (e.g. `2025-01-01_to_2025-01-31`)

> The named enums are validated by Zod. Custom date formats are documented in the tool description but not constrained by the schema — Chronova returns 404 if the format is invalid.

## Response shape

```ts
interface ChronovaStatsRange {
  range: string;       // echoed back from the request
  total_seconds: number;
  languages: Array<{ name: string; total_seconds: number; percent: number }>;
  projects: Array<{ name: string; total_seconds: number; percent: number }>;
  editors: Array<{ name: string; total_seconds: number; percent: number }>;
  operating_systems: Array<{ name: string; total_seconds: number; percent: number }>;
  daily_stats: Array<{ date: string; total_seconds: number }>;
  hourly_stats: Array<{ hour: number; total_seconds: number }>;
  best_day: { date: string; total_seconds: number } | null;
  start: string;       // YYYY-MM-DD
  end: string;         // YYYY-MM-DD
}
```

All `*_seconds` values are wall-clock coding seconds within the range. `percent` values on breakdowns sum to ~100 within their category.

## Example

```json
{
  "range": "last_7_days",
  "total_seconds": 36000,
  "languages": [{ "name": "TypeScript", "total_seconds": 18000, "percent": 50 }],
  "projects":  [{ "name": "chronova",   "total_seconds": 36000, "percent": 100 }],
  "editors":   [{ "name": "VS Code",    "total_seconds": 36000, "percent": 100 }],
  "operating_systems": [{ "name": "Linux", "total_seconds": 36000, "percent": 100 }],
  "daily_stats":  [{ "date": "2024-06-01", "total_seconds": 7200 }],
  "hourly_stats": [{ "hour": 9, "total_seconds": 3600 }],
  "best_day": { "date": "2024-06-01", "total_seconds": 7200 },
  "start": "2024-05-25",
  "end":   "2024-06-01"
}
```

## Test coverage

`tests/integration/tools.test.ts` → `describe("get_productivity_summary")` covers the happy path, parameter passthrough (the `project` filter is asserted to produce a valid request), and the 401 path. The mock fixture `mockStats` matches the shape above.

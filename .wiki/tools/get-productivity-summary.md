---
type: Tool
title: "get_productivity_summary"
description: "Return aggregated coding productivity statistics for a named time range."
tags: [tools, mcp, chronova]
---

# `get_productivity_summary`

Returns aggregated coding productivity statistics for the authenticated user over a named time range, including total coding time and breakdowns by language, project, editor, and operating system.

## Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `range` | string enum | Yes | One of the named ranges listed below. |
| `project` | string | No | Filter results to a specific project name. |

### Named ranges

- `today`
- `last_7_days`
- `last_30_days`
- `last_3_months`
- `last_6_months`
- `last_year`
- `all_time`

The source Zod schema in `src/tools/get-productivity-summary.ts` only accepts these named values.

## Chronova endpoint

- **Method:** GET
- **Path:** `users/current/stats/{range}`
- **Query params:** `project` (optional)
- **Response envelope:** `{ data: ChronovaStatsRange }`

See [Chronova API contract & types](../domain/chronova-api.md#type-reference) for the `ChronovaStatsRange` shape.

## MCP registration

Registered in `src/server.ts` via `registerGetProductivitySummary(server, chronova)`. The handler lives in `src/tools/get-productivity-summary.ts`.

## Returns

A JSON text content object containing:

- `range`
- `total_seconds`
- `languages` — array of `{ name, total_seconds, percent }`
- `projects` — array of `{ name, total_seconds, percent }`
- `editors` — array of `{ name, total_seconds, percent }`
- `operating_systems` — array of `{ name, total_seconds, percent }`
- `daily_stats` — array of `{ date, total_seconds }`
- `hourly_stats` — array of `{ hour, total_seconds }`
- `best_day` — `{ date, total_seconds }` or `null`
- `start` / `end`

## Errors

- Invalid API key → `UNAUTHORIZED` tool error.
- Server-side failures → `SERVER_ERROR` tool error.

See [Errors & status mapping](../domain/errors.md) for the full mapping.

---
type: Tool
title: "get_ai_insights"
description: "Return AI-assisted vs manual coding analytics for the authenticated user."
tags: [tools, mcp, chronova, ai]
---

# `get_ai_insights`

Returns AI-assisted coding analytics for the authenticated user over a given time range: adoption timeline, contribution share, human vs AI comparison, language matrix, project-level AI dependency, and efficiency trends.

## Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `range` | string enum or custom | Yes | Named range or `YYYY-MM-DD_to_YYYY-MM-DD` custom date range. |

### Allowed values

- Named ranges: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`
- Custom range: `YYYY-MM-DD_to_YYYY-MM-DD`

The source Zod schema in `src/tools/get-ai-insights.ts` accepts the named enum or a custom date-range string matching `^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$`.

## Chronova endpoint

- **Method:** GET
- **Path:** `users/current/analytics/ai`
- **Query params:** `range` (required)
- **Response envelope:** `{ data: ChronovaAiAnalytics }`

See [Chronova API contract & types](../domain/chronova-api.md#type-reference) for the `ChronovaAiAnalytics` shape.

## MCP registration

Registered in `src/server.ts` via `registerGetAiInsights(server, chronova)`. The handler lives in `src/tools/get-ai-insights.ts`.

## Returns

A JSON text content object containing:

- `adoptionTimeline` — array of `{ date, aiSeconds, manualSeconds }`
- `contributionShare` — `{ aiPercent, manualPercent, aiHours, manualHours }`
- `comparison` — `{ withAi: { totalSeconds, avgDaily }, withoutAi: { totalSeconds, avgDaily } }`
- `languageMatrix` — array of `{ language, aiPercent, manualPercent }`
- `projectDependency` — array of `{ project, aiPercent, manualPercent }`
- `efficiencyTrend` — array of `{ period, productivity }`

## Errors

- Invalid API key → `UNAUTHORIZED` tool error.
- 404 from the API → `NOT_FOUND` tool error.
- Server-side failures → `SERVER_ERROR` tool error.

See [Errors & status mapping](../domain/errors.md) for the full mapping.

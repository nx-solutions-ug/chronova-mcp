---
type: Tool Reference
title: "Tool: get_ai_insights"
description: "Get AI-assisted vs manual coding analytics for a Chronova time range."
tags: [tools, mcp, get-ai-insights]
---

# `get_ai_insights`

Returns AI-assisted coding analytics for the requested time range.

- **Endpoint**: `GET users/current/analytics/ai`
- **Source**: `src/tools/get-ai-insights.ts`
- **Read-only hint**: `true`

## Input schema

| Parameter | Type | Required | Description |
|---|---|---|---|
| `range` | `string` | Yes | Named range or custom date range |

### Accepted `range` values

- Named ranges: `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time`
- Custom date range: `YYYY-MM-DD_to_YYYY-MM-DD`

## Handler

```ts
const response = await chronova.get<{ data: ChronovaAiAnalytics }>(
  "users/current/analytics/ai",
  { range },
);
```

## Response shape (`ChronovaAiAnalytics`)

```ts
{
  adoptionTimeline: Array<{
    date: string;
    aiSeconds: number;
    manualSeconds: number;
  }>;
  contributionShare: {
    aiPercent: number;
    manualPercent: number;
    aiHours: number;
    manualHours: number;
  };
  comparison: {
    withAi: { totalSeconds: number; avgDaily: number };
    withoutAi: { totalSeconds: number; avgDaily: number };
  };
  languageMatrix: Array<{
    language: string;
    aiPercent: number;
    manualPercent: number;
  }>;
  projectDependency: Array<{
    project: string;
    aiPercent: number;
    manualPercent: number;
  }>;
  efficiencyTrend: Array<{
    period: string;
    productivity: number;
  }>;
}
```

## Errors

- `401 UNAUTHORIZED` for an invalid/missing API key.

The range is sent as a query parameter (`?range=...`).

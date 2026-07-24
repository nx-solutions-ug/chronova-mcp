---
type: Tool
id: get_ai_insights
title: "Tool: get_ai_insights"
description: "Fetch AI-assisted coding analytics including adoption timeline, contribution share, and efficiency trends."
tags: [tools, reference, ai-insights]
---

# `get_ai_insights`

Returns AI-assisted coding analytics: adoption timeline, contribution share of AI vs manual work, human/AI comparison by language, project-level AI dependency, and efficiency trends.

## Registration

- **Source**: `src/tools/get-ai-insights.ts`
- **Function**: `registerGetAiInsights(server, chronova)`

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
    .or(
      z.string().regex(/^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/),
    )
    .describe(
      'Time range for analytics. Named ranges (today, last_7_days, etc.) or custom date range (YYYY-MM-DD_to_YYYY-MM-DD).',
    ),
})
```

## Range values

| Format | Example |
|---|---|
| Named | `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, `all_time` |
| Custom | `2024-08-01_to_2024-08-31` |

Year (`YYYY`) and month (`YYYY-MM`) formats are **not** accepted by this tool.

## Chronova API call

| Method | Path | Query params |
|---|---|---|
| GET | `users/current/analytics/ai` | `range` (required) |

## Response shape (`ChronovaAiAnalytics`)

```ts
interface ChronovaAiAnalytics {
  adoptionTimeline: Array<{
    date: string;
    ai_seconds: number;
    manual_seconds: number;
  }>;
  contributionShare: Array<{
    category: string;
    seconds: number;
    percent: number;
  }>;
  comparison: {
    ai_total_seconds: number;
    manual_total_seconds: number;
    efficiency_gain_percent: number;
  };
  languageMatrix: Array<{
    language: string;
    ai_seconds: number;
    manual_seconds: number;
  }>;
  projectDependency: Array<{
    project: string;
    ai_percent: number;
    manual_percent: number;
  }>;
  efficiencyTrend: Array<{
    date: string;
    efficiency_gain_percent: number;
  }>;
}
```

## MCP response

Success:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{ \"adoptionTimeline\": [...], \"contributionShare\": [...], ... }"
    }
  ]
}
```

Error:

```json
{
  "content": [
    { "type": "text", "text": "Chronova API error: 500 Internal Server Error" }
  ],
  "isError": true
}
```

## Related

- [Chronova API contract & types](../domain/chronova-api.md)
- [Errors & status mapping](../domain/errors.md)
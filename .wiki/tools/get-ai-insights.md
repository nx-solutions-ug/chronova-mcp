---
type: Tools Reference
title: "get_ai_insights"
description: "AI-assisted vs manual coding analytics: adoption timeline, contribution share, language matrix, project AI-dependency, and efficiency trend."
tags: [tools, mcp, chronova, ai, analytics]
---

# `get_ai_insights`

Returns analytics that compare AI-assisted coding against manual coding over a time range. The Chronova backend rolls up heartbeats tagged with AI assistance (e.g. Cursor, Copilot) into a small dashboard of breakdowns.

- **Source**: `src/tools/get-ai-insights.ts` → `registerGetAiInsights`
- **Chronova endpoint**: `GET users/current/analytics/ai?range={range}`
- **Annotations**: `readOnlyHint: true`
- **Response envelope**: `{ data: ChronovaAiAnalytics }` (handler returns `response.data`)

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `range` | enum or `YYYY-MM-DD_to_YYYY-MM-DD` | **yes** | Time range to analyze |

`range` is `z.union([z.enum([...]), z.string().regex(/^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/)])`. Named values:

```
today, last_7_days, last_30_days, last_3_months,
last_6_months, last_year, all_time
```

Unlike `get_productivity_summary`, this tool does **not** accept `YYYY` or `YYYY-MM` — only named ranges and the custom date-range format.

## Response shape

```ts
interface ChronovaAiAnalytics {
  adoptionTimeline: Array<{
    date: string;          // YYYY-MM-DD
    aiSeconds: number;
    manualSeconds: number;
  }>;
  contributionShare: {
    aiPercent: number;     // 0–100
    manualPercent: number; // 0–100
    aiHours: number;
    manualHours: number;
  };
  comparison: {
    withAi: { totalSeconds: number; avgDaily: number };
    withoutAi: { totalSeconds: number; avgDaily: number };
  };
  languageMatrix: Array<{
    language: string;
    aiPercent: number;     // 0–100
    manualPercent: number; // 0–100
  }>;
  projectDependency: Array<{
    project: string;
    aiPercent: number;     // 0–100
    manualPercent: number; // 0–100
  }>;
  efficiencyTrend: Array<{
    period: string;        // e.g. ISO week "2024-W22"
    productivity: number;  // backend-defined scalar
  }>;
}
```

## Reading the response

- **`adoptionTimeline`** — daily `aiSeconds` / `manualSeconds` series; useful for plotting AI uptake over time.
- **`contributionShare`** — overall % and hours of AI vs manual; the percentages sum to 100 (rounding aside).
- **`comparison.withAi` / `withoutAi`** — total seconds and average daily seconds in periods the user did or did not use AI; lets an agent reason about AI's effect on output.
- **`languageMatrix`** — per-language AI vs manual share.
- **`projectDependency`** — per-project AI vs manual share; useful for "which repos do I lean on AI most in?".
- **`efficiencyTrend`** — time-bucketed productivity scalar (definition is backend-side; the server passes it through unchanged).

## Example

```json
{
  "adoptionTimeline": [
    { "date": "2024-06-01", "aiSeconds": 3600, "manualSeconds": 7200 }
  ],
  "contributionShare": { "aiPercent": 33, "manualPercent": 67, "aiHours": 1, "manualHours": 2 },
  "comparison": {
    "withAi":    { "totalSeconds": 10800, "avgDaily": 3600 },
    "withoutAi": { "totalSeconds":  5400, "avgDaily": 1800 }
  },
  "languageMatrix":    [{ "language": "TypeScript", "aiPercent": 40, "manualPercent": 60 }],
  "projectDependency": [{ "project":   "chronova",   "aiPercent": 35, "manualPercent": 65 }],
  "efficiencyTrend":   [{ "period": "2024-W22", "productivity": 1.2 }]
}
```

## Test coverage

`tests/integration/tools.test.ts` → `describe("get_ai_insights")` covers the happy path (asserts `contributionShare.aiPercent` and `adoptionTimeline` length) and the 401 path. The mock fixture `mockAiAnalytics` matches the shape above.

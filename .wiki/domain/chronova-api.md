---
type: Domain
title: "Chronova API contract & types"
description: "The Chronova HTTP API endpoints, response shapes, and typed models the server depends on."
tags: [domain, chronova-api, types]
---

# Chronova API contract & types

The server is a typed read-only client for a subset of the Chronova HTTP API. `src/lib/types.ts` is the canonical description of the responses the server expects; `src/lib/chronova-client.ts` performs the calls.

## Base URL & auth

- Base URL default: `https://chronova.dev/api/v1` (see [Configuration](../configuration.md)).
- All requests use `Authorization: Bearer <api_key>` and `Accept: application/json`.
- The `ChronovaClient` constructor appends a trailing `/` to `baseUrl` so that `new URL(path, baseUrl)` resolves `path` *under* the API root rather than replacing the last path segment. Without this, `new URL("users/current", "https://host/api/v1")` yields `https://host/users/current` (wrong). This is a load-bearing normalization.
- Every request has a 30-second timeout via `AbortSignal.timeout(30_000)`.

## Endpoints used

| Tool | Method | Path | Query params |
|---|---|---|---|
| `get_developer_context` | GET | `users/current` | — |
| `get_productivity_summary` | GET | `users/current/stats/{range}` | `project` (optional) |
| `get_ai_insights` | GET | `users/current/analytics/ai` | `range` (required) |

`range` values for both tools include the named ranges `today`, `last_7_days`, `last_30_days`, `last_3_months`, `last_6_months`, `last_year`, and `all_time`. `get_productivity_summary` additionally accepts `YYYY` for a year, `YYYY-MM` for a month, and `YYYY-MM-DD_to_YYYY-MM-DD` for a custom date range. `get_ai_insights` accepts named ranges and `YYYY-MM-DD_to_YYYY-MM-DD`.
| `get_recent_activity` | GET | `users/current/heartbeats` | `date`, `start`, `end`, `project`, `language`, `editor`, `page`, `per_page` |

All paths are relative to the configured base URL.

## Response envelope

`get_developer_context`, `get_productivity_summary`, and `get_ai_insights` expect a `{ data: T }` envelope and return `response.data`. `get_recent_activity` returns the raw `ChronovaHeartbeatResponse` object (no `data` wrapper) — verified by the integration test, which asserts `parsed.heartbeats` directly.

## Type reference

The shapes below mirror `src/lib/types.ts`. Field names use snake_case to match the API wire format; the server passes JSON through to the MCP client unchanged (no camelCase conversion).

- **`ChronovaUser`** — `id`, `username`, `email`, `avatar_url`, `subscription: { plan, status }`, `github_connected`, `organizations: Array<{ id, name, role }>`, `created_at`, `modified_at`.
- **`ChronovaStatsRange`** — `range`, `total_seconds`; arrays `languages` / `projects` / `editors` / `operating_systems` each of `{ name, total_seconds, percent }`; `daily_stats: [{ date, total_seconds }]`; `hourly_stats: [{ hour, total_seconds }]`; `best_day: { date, total_seconds } | null`; `start`, `end`.
- **`ChronovaHeartbeat`** — `id`, `time`, `type`, `project`, `language`, `editor`, `operating_system`, `machine`, `branch`, `created_at`.
- **`ChronovaHeartbeatResponse`** — `heartbeats: ChronovaHeartbeat[]`, `total`, `page`, `per_page`, `total_pages`.
- **`ChronovaAiAnalytics`** — `adoptionTimeline`, `contributionShare`, `comparison`, `languageMatrix`, `projectDependency`, `efficiencyTrend` (see [Tools reference](../tools/index.md#get_ai_insights) for sub-shapes).

## Heartbeats concept

A *heartbeat* is a single coding activity event recorded by a Chronova/WakaTime-style tracker: timestamp (`time`), `type` (e.g. `coding`), the `project`/`language`/`editor`/`operating_system`/`machine` context, and the git `branch`. `get_recent_activity` exposes these as a paginated list; `get_productivity_summary` and `get_ai_insights` aggregate them into time ranges and AI-vs-manual analytics.
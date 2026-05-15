import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";
import { ChronovaApiError } from "../lib/errors.js";
import type { ChronovaStatsRange } from "../lib/types.js";

export function registerGetProductivitySummary(
  server: McpServer,
  chronova: ChronovaClient,
): void {
  server.registerTool(
    "get_productivity_summary",
    {
      description:
        "Get aggregated coding productivity statistics for a time range. Returns total coding time, language breakdown, editor breakdown, and project breakdown.",
      inputSchema: z.object({
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
            'Time range for statistics. Named ranges (today, last_7_days, etc.) or custom formats (YYYY for year, YYYY-MM for month, YYYY-MM-DD_to_YYYY-MM-DD for date range).',
          ),
        project: z
          .string()
          .optional()
          .describe("Filter results to a specific project name"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ range, project }) => {
      try {
        const path = `/api/v1/users/current/stats/${range}`;
        const params: Record<string, string> = {};
        if (project) {
          params.project = project;
        }

        const response = await chronova.get<{ data: ChronovaStatsRange }>(
          path,
          Object.keys(params).length > 0 ? params : undefined,
        );

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        if (error instanceof ChronovaApiError) {
          return {
            content: [{ type: "text" as const, text: error.message }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
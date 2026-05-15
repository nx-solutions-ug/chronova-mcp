import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";
import { ChronovaApiError } from "../lib/errors.js";
import type { ChronovaAiAnalytics } from "../lib/types.js";

export function registerGetAiInsights(
  server: McpServer,
  chronova: ChronovaClient,
): void {
  server.registerTool(
    "get_ai_insights",
    {
      description:
        "Get AI-assisted coding analytics including adoption timeline (AI vs manual coding over time), contribution share (percentage of AI vs manual work), human vs AI comparison by language, project-level AI dependency, and efficiency trends.",
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
          .or(
            z.string().regex(/^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/),
          )
          .describe(
            'Time range for analytics. Named ranges (today, last_7_days, etc.) or custom date range (YYYY-MM-DD_to_YYYY-MM-DD).',
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ range }) => {
      try {
        const response = await chronova.get<{ data: ChronovaAiAnalytics }>(
          "/api/v1/users/current/analytics/ai",
          { range },
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
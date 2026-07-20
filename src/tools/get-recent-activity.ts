import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";
import { formatToolError } from "../lib/errors.js";
import type { ChronovaHeartbeatResponse } from "../lib/types.js";

export function registerGetRecentActivity(
  server: McpServer,
  chronova: ChronovaClient,
): void {
  server.registerTool(
    "get_recent_activity",
    {
      description:
        "Get recent coding heartbeats (activity events). Returns paginated results — use 'page' and 'per_page' parameters to navigate through large result sets. The response includes 'total' count and pagination metadata.",
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Filter by specific date (YYYY-MM-DD)"),
        start: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Start date for range (YYYY-MM-DD)"),
        end: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("End date for range (YYYY-MM-DD)"),
        project: z
          .string()
          .optional()
          .describe("Filter by project name"),
        language: z
          .string()
          .optional()
          .describe("Filter by programming language"),
        editor: z
          .string()
          .optional()
          .describe("Filter by editor/IDE name"),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Page number for pagination (default: 1)"),
        per_page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Results per page (default: 100, max: 100)"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ date, start, end, project, language, editor, page, per_page }) => {
      try {
        const params: Record<string, string> = {};
        if (date !== undefined) params.date = date;
        if (start !== undefined) params.start = start;
        if (end !== undefined) params.end = end;
        if (project !== undefined) params.project = project;
        if (language !== undefined) params.language = language;
        if (editor !== undefined) params.editor = editor;
        if (page !== undefined) params.page = String(page);
        if (per_page !== undefined) params.per_page = String(per_page);

        const response = await chronova.get<ChronovaHeartbeatResponse>(
          "users/current/heartbeats",
          Object.keys(params).length > 0 ? params : undefined,
        );

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response, null, 2) },
          ],
        };
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";
import { ChronovaApiError } from "../lib/errors.js";
import type { ChronovaUser } from "../lib/types.js";

export function registerGetDeveloperContext(
  server: McpServer,
  chronova: ChronovaClient,
): void {
  server.registerTool(
    "get_developer_context",
    {
      description:
        "Get the authenticated user's developer profile including coding statistics, subscription status, GitHub integration status, and organization memberships. No parameters required — uses the configured API key.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const response = await chronova.get<{ data: ChronovaUser }>(
          "/api/v1/users/current",
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
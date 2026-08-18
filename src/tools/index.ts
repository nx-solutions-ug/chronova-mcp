import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "../lib/chronova-client.js";

import { registerGetAiInsights } from "./get-ai-insights.js";
import { registerGetDeveloperContext } from "./get-developer-context.js";
import { registerGetProductivitySummary } from "./get-productivity-summary.js";
import { registerGetRecentActivity } from "./get-recent-activity.js";

export function registerAllTools(server: McpServer, chronova: ChronovaClient): void {
  registerGetAiInsights(server, chronova);
  registerGetDeveloperContext(server, chronova);
  registerGetProductivitySummary(server, chronova);
  registerGetRecentActivity(server, chronova);
}

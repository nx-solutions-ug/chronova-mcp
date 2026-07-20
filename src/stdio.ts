#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronovaClient } from "./lib/chronova-client.js";
import { resolveConfig } from "./lib/config.js";
import { registerGetDeveloperContext } from "./tools/get-developer-context.js";
import { registerGetAiInsights } from "./tools/get-ai-insights.js";
import { registerGetProductivitySummary } from "./tools/get-productivity-summary.js";
import { registerGetRecentActivity } from "./tools/get-recent-activity.js";
import { VERSION } from "./version.js";

async function main() {
  const config = resolveConfig();

  if (!config.apiKey) {
    console.error(
      "Error: No API key found. Set CHRONOVA_API_KEY env var, or add api_key to ~/.chronova.cfg or ~/.wakatime.cfg.",
    );
    process.exit(1);
  }

  const server = new McpServer({ name: "chronova-mcp", version: VERSION });
  const chronova = new ChronovaClient(config.apiUrl, config.apiKey);

  registerGetAiInsights(server, chronova);
  registerGetDeveloperContext(server, chronova);
  registerGetProductivitySummary(server, chronova);
  registerGetRecentActivity(server, chronova);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
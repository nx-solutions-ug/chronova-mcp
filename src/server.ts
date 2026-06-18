import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ChronovaClient } from "./lib/chronova-client.js";
import { resolveConfig, type ChronovaConfig } from "./lib/config.js";
import { registerGetDeveloperContext } from "./tools/get-developer-context.js";
import { registerGetAiInsights } from "./tools/get-ai-insights.js";
import { registerGetProductivitySummary } from "./tools/get-productivity-summary.js";
import { registerGetRecentActivity } from "./tools/get-recent-activity.js";

const VERSION = "0.1.0";

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

function createMcpServer(config: ChronovaConfig): { server: McpServer; chronova: ChronovaClient } {
  const server = new McpServer({ name: "chronova-mcp", version: VERSION });
  const chronova = new ChronovaClient(config.apiUrl, config.apiKey);

  registerGetAiInsights(server, chronova);
  registerGetDeveloperContext(server, chronova);
  registerGetProductivitySummary(server, chronova);
  registerGetRecentActivity(server, chronova);

  return { server, chronova };
}

export function createApp(config?: ChronovaConfig): express.Express {
  const resolvedConfig = config ?? resolveConfig();
  const app = express();
  app.use(cors());
  app.use(express.json());

  const sessions = new Map<string, Session>();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: VERSION });
  });

  async function handleMcpRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid or expired session ID" },
          id: null,
        });
        return;
      }
      await session.transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body,
      );
      return;
    }

    const { server: mcpServer } = createMcpServer(resolvedConfig);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        sessions.set(newSessionId, { transport, server: mcpServer });
      },
    });

    mcpServer.server.onclose = () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        sessions.delete(sid);
      }
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );
  }

  app.post("/mcp", handleMcpRequest);
  app.get("/mcp", handleMcpRequest);
  app.delete("/mcp", handleMcpRequest);

  return app;
}

export function startServer() {
  const config = resolveConfig();

  if (!config.apiKey) {
    console.warn(
      "Warning: No API key found. Set CHRONOVA_API_KEY env var, or add api_key to ~/.chronova.cfg or ~/.wakatime.cfg. API requests will fail.",
    );
  } else if (config.configSource !== "env") {
    process.stderr.write(`Using API key from ${config.configSource}\n`);
  }

  const app = createApp(config);
  const httpServer = app.listen(config.port, () => {
    process.stderr.write(`Chronova MCP server listening on port ${config.port}\n`);
  });

  async function shutdown(): Promise<void> {
    process.stderr.write("Shutting down...\n");
    httpServer.close();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return httpServer;
}
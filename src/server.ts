import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ChronovaClient } from "./lib/chronova-client.js";

const PORT = Number(process.env.PORT) || 3001;
const CHRONOVA_API_URL = process.env.CHRONOVA_API_URL || "https://chronova.dev";
const CHRONOVA_API_KEY = process.env.CHRONOVA_API_KEY;

const VERSION = "0.1.0";

export interface ServerContext {
  server: McpServer;
  app: express.Express;
  chronova: ChronovaClient;
}

export function createServer(): ServerContext {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = new McpServer({ name: "chronova-mcp", version: VERSION });
  const chronova = new ChronovaClient(CHRONOVA_API_URL, CHRONOVA_API_KEY);

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: VERSION });
  });

  async function handleMcpRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid or expired session ID" },
          id: null,
        });
        return;
      }
      await transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body,
      );
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        transports.set(newSessionId, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );
  }

  app.post("/mcp", handleMcpRequest);
  app.get("/mcp", handleMcpRequest);
  app.delete("/mcp", handleMcpRequest);

  return { server, app, chronova };
}

export function startServer(): ServerContext {
  if (!CHRONOVA_API_KEY) {
    console.warn(
      "Warning: CHRONOVA_API_KEY is not set. API requests will fail.",
    );
  }

  const ctx = createServer();
  const httpServer = ctx.app.listen(PORT, () => {
    console.log(`Chronova MCP server listening on port ${PORT}`);
  });

  async function shutdown(): Promise<void> {
    console.log("Shutting down...");
    httpServer.close();
    await ctx.server.close();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return ctx;
}
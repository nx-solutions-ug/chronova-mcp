import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server.js";
import type { ChronovaConfig } from "../../src/lib/config.js";
import { startMcpTestServer, initSession } from "../helpers/mock-server.js";
import type { McpTestServer } from "../helpers/mock-server.js";

const TEST_CONFIG: ChronovaConfig = {
  apiKey: "test-api-key",
  apiUrl: "https://chronova.test/api/v1",
  port: 3001,
  configSource: "env",
};

describe("MCP Server - Protocol negotiation and tool listing", () => {
  let app: ReturnType<typeof createApp>;
  let mcpServer: McpTestServer;

  beforeEach(() => {
    app = createApp(TEST_CONFIG);
  });

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.close();
    }
  });

  it("should respond to health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", version: "0.1.0" });
  });

  it("should initialize an MCP session via POST /mcp", async () => {
    mcpServer = await startMcpTestServer(app);
    const res = await mcpServer.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(res.jsonrpc).toBe("2.0");
    expect(res.result).toBeDefined();
    const result = res.result as {
      serverInfo: { name: string; version: string };
    };
    expect(result.serverInfo.name).toBe("chronova-mcp");
    expect(result.serverInfo.version).toBe("0.1.0");
    expect(mcpServer.sessionId()).toBeDefined();
  });

  it("should list exactly 4 tools", async () => {
    mcpServer = await startMcpTestServer(app);
    await initSession(mcpServer);

    const res = await mcpServer.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const result = res.result as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(4);

    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      "get_ai_insights",
      "get_developer_context",
      "get_productivity_summary",
      "get_recent_activity",
    ]);
  });

  it("should include annotations and inputSchema for each tool", async () => {
    mcpServer = await startMcpTestServer(app);
    await initSession(mcpServer);

    const res = await mcpServer.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const result = res.result as {
      tools: Array<{
        name: string;
        annotations: { readOnlyHint: boolean };
        inputSchema: { type: string };
      }>;
    };
    for (const tool of result.tools) {
      expect(tool.annotations).toBeDefined();
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("should return 400 for invalid session ID", async () => {
    mcpServer = await startMcpTestServer(app);
    await initSession(mcpServer);

    const res = await fetch(`${mcpServer.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": "nonexistent-session-id",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid or expired session ID");
  });
});
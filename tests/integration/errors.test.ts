import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp } from "../../src/server.js";
import {
  mockChronovaApi,
  startMcpTestServer,
  initSession,
  callTool,
} from "../helpers/mock-server.js";
import type { MockChronovaApi, McpTestServer } from "../helpers/mock-server.js";

describe("MCP Error propagation", () => {
  let app: ReturnType<typeof createApp>;
  let mockApi: MockChronovaApi;
  let mcpServer: McpTestServer;

  beforeEach(async () => {
    mockApi = mockChronovaApi();
    mockApi.setup();
    app = createApp();
    process.env.CHRONOVA_API_KEY = "test-api-key";
    process.env.CHRONOVA_API_URL = "https://chronova.test";
    mcpServer = await startMcpTestServer(app);
    await initSession(mcpServer);
  });

  afterEach(async () => {
    mockApi.restore();
    await mcpServer.close();
  });

  async function callToolAsResult(
    name: string,
    args: Record<string, unknown> = {},
  ) {
    const result = (await callTool(mcpServer, name, args)) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    return result;
  }

  it("should propagate 401 Unauthorized with CHRONOVA_API_KEY guidance", async () => {
    mockApi.respond("/api/v1/users/current", {
      status: 401,
      body: { error: "Invalid API key" },
    });

    const result = await callToolAsResult("get_developer_context");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unauthorized");
    expect(result.content[0].text).toContain("CHRONOVA_API_KEY");
  });

  it("should propagate 429 Rate limited with Retry-After guidance", async () => {
    mockApi.respond("/api/v1/users/current", {
      status: 429,
      body: { error: "Too many requests" },
      headers: { "Retry-After": "30" },
    });

    const result = await callToolAsResult("get_developer_context");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limited");
    expect(result.content[0].text).toContain("30");
  });

  it("should propagate 429 without Retry-After header", async () => {
    mockApi.respond("/api/v1/users/current", {
      status: 429,
      body: { error: "Too many requests" },
    });

    const result = await callToolAsResult("get_developer_context");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limited");
  });

  it("should propagate 500 server error", async () => {
    mockApi.respond("/api/v1/users/current/stats/last_7_days", {
      status: 500,
      body: { error: "Internal Server Error" },
    });

    const result = await callToolAsResult("get_productivity_summary", {
      range: "last_7_days",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Chronova server error");
  });

  it("should propagate 502 bad gateway", async () => {
    mockApi.respond("/api/v1/users/current/heartbeats", {
      status: 502,
      body: { error: "Bad Gateway" },
    });

    const result = await callToolAsResult("get_recent_activity");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Chronova server error");
  });

  it("should propagate 404 not found error", async () => {
    mockApi.respond("/api/v1/users/current/analytics/ai", {
      status: 404,
      body: { error: "Not found" },
    });

    const result = await callToolAsResult("get_ai_insights", {
      range: "last_7_days",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Not found");
  });

  it("should handle network connection errors", async () => {
    const originalFetch = globalThis.fetch;
    const testBaseUrl = mcpServer.baseUrl;
    globalThis.fetch = async (url: string | Request | URL, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.startsWith(testBaseUrl)) {
        return originalFetch(url, init);
      }
      throw new TypeError("fetch failed");
    };

    const result = await callToolAsResult("get_developer_context");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot connect");

    globalThis.fetch = originalFetch;
  });
});
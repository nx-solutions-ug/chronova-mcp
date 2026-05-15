import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp } from "../../src/server.js";
import {
  mockChronovaApi,
  startMcpTestServer,
  initSession,
  callTool,
} from "../helpers/mock-server.js";
import type { MockChronovaApi, McpTestServer } from "../helpers/mock-server.js";

describe("MCP Tools", () => {
  let app: ReturnType<typeof createApp>;
  let mockApi: MockChronovaApi;
  let mcpServer: McpTestServer;

  const mockUser = {
    id: "1",
    username: "testuser",
    email: "test@example.com",
    avatar_url: null,
    subscription: { plan: "pro", status: "active" },
    github_connected: true,
    organizations: [{ id: "org1", name: "TestOrg", role: "admin" }],
    created_at: "2024-01-01T00:00:00Z",
    modified_at: "2024-06-01T00:00:00Z",
  };

  const mockStats = {
    range: "last_7_days",
    total_seconds: 36000,
    languages: [{ name: "TypeScript", total_seconds: 18000, percent: 50 }],
    projects: [{ name: "chronova", total_seconds: 36000, percent: 100 }],
    editors: [{ name: "VS Code", total_seconds: 36000, percent: 100 }],
    operating_systems: [{ name: "Linux", total_seconds: 36000, percent: 100 }],
    daily_stats: [{ date: "2024-06-01", total_seconds: 7200 }],
    hourly_stats: [{ hour: 9, total_seconds: 3600 }],
    best_day: { date: "2024-06-01", total_seconds: 7200 },
    start: "2024-05-25",
    end: "2024-06-01",
  };

  const mockHeartbeats = {
    heartbeats: [
      {
        id: "hb1",
        time: "2024-06-01T09:00:00Z",
        type: "coding",
        project: "chronova",
        language: "TypeScript",
        editor: "VS Code",
        operating_system: "Linux",
        machine: "dev-box",
        branch: "main",
        created_at: "2024-06-01T09:00:05Z",
      },
    ],
    total: 1,
    page: 1,
    per_page: 100,
    total_pages: 1,
  };

  const mockAiAnalytics = {
    adoptionTimeline: [
      { date: "2024-06-01", aiSeconds: 3600, manualSeconds: 7200 },
    ],
    contributionShare: {
      aiPercent: 33,
      manualPercent: 67,
      aiHours: 1,
      manualHours: 2,
    },
    comparison: {
      withAi: { totalSeconds: 10800, avgDaily: 3600 },
      withoutAi: { totalSeconds: 5400, avgDaily: 1800 },
    },
    languageMatrix: [
      { language: "TypeScript", aiPercent: 40, manualPercent: 60 },
    ],
    projectDependency: [
      { project: "chronova", aiPercent: 35, manualPercent: 65 },
    ],
    efficiencyTrend: [{ period: "2024-W22", productivity: 1.2 }],
  };

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

  describe("get_developer_context", () => {
    it("should return developer profile data", async () => {
      mockApi.respond("/api/v1/users/current", {
        status: 200,
        body: { data: mockUser },
      });

      const result = (await callTool(mcpServer, "get_developer_context")) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.username).toBe("testuser");
      expect(parsed.email).toBe("test@example.com");
      expect(parsed.subscription.plan).toBe("pro");
    });

    it("should return error for 401 response", async () => {
      mockApi.respond("/api/v1/users/current", {
        status: 401,
        body: { error: "Unauthorized" },
      });

      const result = (await callTool(mcpServer, "get_developer_context")) as {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unauthorized");
      expect(result.content[0].text).toContain("CHRONOVA_API_KEY");
    });
  });

  describe("get_productivity_summary", () => {
    it("should return productivity stats", async () => {
      mockApi.respond("/api/v1/users/current/stats/last_7_days", {
        status: 200,
        body: { data: mockStats },
      });

      const result = (await callTool(mcpServer, "get_productivity_summary", {
        range: "last_7_days",
      })) as { content: Array<{ type: string; text: string }> };

      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total_seconds).toBe(36000);
      expect(parsed.languages[0].name).toBe("TypeScript");
    });

    it("should pass project filter parameter", async () => {
      mockApi.respond("/api/v1/users/current/stats/last_7_days", {
        status: 200,
        body: { data: mockStats },
      });

      const result = (await callTool(mcpServer, "get_productivity_summary", {
        range: "last_7_days",
        project: "chronova",
      })) as { content: Array<{ type: string; text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total_seconds).toBe(36000);
    });

    it("should return error for 401 response", async () => {
      mockApi.respond("/api/v1/users/current/stats/last_7_days", {
        status: 401,
        body: { error: "Unauthorized" },
      });

      const result = (await callTool(mcpServer, "get_productivity_summary", {
        range: "last_7_days",
      })) as { content: Array<{ type: string; text: string }>; isError: boolean };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unauthorized");
    });
  });

  describe("get_recent_activity", () => {
    it("should return heartbeat data", async () => {
      mockApi.respond("/api/v1/users/current/heartbeats", {
        status: 200,
        body: mockHeartbeats,
      });

      const result = (await callTool(mcpServer, "get_recent_activity")) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.heartbeats).toHaveLength(1);
      expect(parsed.heartbeats[0].language).toBe("TypeScript");
      expect(parsed.total).toBe(1);
    });

    it("should pass optional filter parameters", async () => {
      mockApi.respond("/api/v1/users/current/heartbeats", {
        status: 200,
        body: mockHeartbeats,
      });

      const result = (await callTool(mcpServer, "get_recent_activity", {
        date: "2024-06-01",
        language: "TypeScript",
        page: 1,
        per_page: 50,
      })) as { content: Array<{ type: string; text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.heartbeats).toHaveLength(1);
    });

    it("should return error for 401 response", async () => {
      mockApi.respond("/api/v1/users/current/heartbeats", {
        status: 401,
        body: { error: "Unauthorized" },
      });

      const result = (await callTool(mcpServer, "get_recent_activity")) as {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unauthorized");
    });
  });

  describe("get_ai_insights", () => {
    it("should return AI analytics data", async () => {
      mockApi.respond("/api/v1/users/current/analytics/ai", {
        status: 200,
        body: { data: mockAiAnalytics },
      });

      const result = (await callTool(mcpServer, "get_ai_insights", {
        range: "last_7_days",
      })) as { content: Array<{ type: string; text: string }> };

      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.contributionShare.aiPercent).toBe(33);
      expect(parsed.adoptionTimeline).toHaveLength(1);
    });

    it("should return error for 401 response", async () => {
      mockApi.respond("/api/v1/users/current/analytics/ai", {
        status: 401,
        body: { error: "Unauthorized" },
      });

      const result = (await callTool(mcpServer, "get_ai_insights", {
        range: "last_7_days",
      })) as { content: Array<{ type: string; text: string }>; isError: boolean };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unauthorized");
    });
  });
});
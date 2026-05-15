import { vi } from "vitest";
import http from "node:http";
import type { Express } from "express";

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface MockChronovaApi {
  setup: () => void;
  respond: (urlPattern: string | RegExp, response: MockResponse) => void;
  respondOnce: (urlPattern: string | RegExp, response: MockResponse) => void;
  restore: () => void;
  callCount: () => number;
}

export function mockChronovaApi(): MockChronovaApi {
  const originalFetch = globalThis.fetch;
  const handlers: Array<{
    pattern: string | RegExp;
    respond: () => MockResponse;
    once: boolean;
    consumed: boolean;
  }> = [];
  let fetchCallCount = 0;

  return {
    setup() {
      globalThis.fetch = vi.fn(async (url: string | Request | URL, _init?: RequestInit) => {
        fetchCallCount++;
        const urlStr = typeof url === "string" ? url : url.toString();

        for (let i = handlers.length - 1; i >= 0; i--) {
          const handler = handlers[i];
          if (handler.consumed) continue;

          const matches =
            typeof handler.pattern === "string"
              ? urlStr.includes(handler.pattern)
              : handler.pattern.test(urlStr);

          if (matches) {
            if (handler.once) {
              handler.consumed = true;
            }
            const resp = handler.respond();
            return new Response(JSON.stringify(resp.body), {
              status: resp.status,
              headers: { "Content-Type": "application/json", ...resp.headers },
            });
          }
        }

        return originalFetch(url, _init);
      }) as unknown as typeof globalThis.fetch;
    },

    respond(urlPattern: string | RegExp, response: MockResponse) {
      handlers.push({
        pattern: urlPattern,
        respond: () => response,
        once: false,
        consumed: false,
      });
    },

    respondOnce(urlPattern: string | RegExp, response: MockResponse) {
      handlers.push({
        pattern: urlPattern,
        respond: () => response,
        once: true,
        consumed: false,
      });
    },

    restore() {
      globalThis.fetch = originalFetch;
    },

    callCount() {
      return fetchCallCount;
    },
  };
}

const ACCEPT_HEADER = "application/json, text/event-stream";
const CONTENT_TYPE = "application/json";

interface McpRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function parseSse(text: string): McpResponse[] {
  const results: McpResponse[] = [];
  let currentData = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      currentData += line.slice(6);
    } else if (line.startsWith("event: ") || line === "") {
      if (currentData) {
        results.push(JSON.parse(currentData));
        currentData = "";
      }
    }
  }
  if (currentData) {
    results.push(JSON.parse(currentData));
  }
  return results;
}

export interface McpTestServer {
  sessionId: () => string | undefined;
  baseUrl: string;
  request: (mcpReq: McpRequest) => Promise<McpResponse>;
  close: () => Promise<void>;
}

export async function startMcpTestServer(app: Express): Promise<McpTestServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  let currentSessionId: string | undefined;

  async function mcpRequest(mcpReq: McpRequest): Promise<McpResponse> {
    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPE,
      Accept: ACCEPT_HEADER,
    };
    if (currentSessionId) {
      headers["Mcp-Session-Id"] = currentSessionId;
    }

    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(mcpReq),
    });

    const newSid = res.headers.get("mcp-session-id");
    if (newSid) {
      currentSessionId = newSid;
    }

    const text = await res.text();

    if (res.status === 202 && text === "") {
      return { jsonrpc: "2.0", id: null };
    }

    if (text === "") {
      return { jsonrpc: "2.0", id: mcpReq.id ?? null };
    }

    const messages = parseSse(text);

    if (messages.length > 0) {
      return messages[0];
    }

    if (res.status !== 200) {
      try {
        const errBody = JSON.parse(text);
        return errBody as McpResponse;
      } catch {
        return {
          jsonrpc: "2.0",
          id: mcpReq.id ?? null,
          error: { code: res.status, message: text },
        };
      }
    }

    throw new Error(`No SSE messages in response: ${text}`);
  }

  return {
    sessionId: () => currentSessionId,
    baseUrl,
    request: mcpRequest,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export async function initSession(server: McpTestServer): Promise<void> {
  const res = await server.request({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  if (res.error) {
    throw new Error(`Initialize failed: ${res.error.message}`);
  }

  await server.request({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

export async function callTool(
  server: McpTestServer,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await server.request({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: { name, arguments: args },
  });
  if (res.error) {
    throw new Error(`Tool call failed: ${res.error.message}`);
  }
  return res.result;
}
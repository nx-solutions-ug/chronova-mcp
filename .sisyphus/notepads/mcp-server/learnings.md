# MCP Server Learnings

## SDK Export Names
- The MCP SDK exports `StreamableHTTPServerTransport` (not `NodeStreamableHTTPServerTransport` as in older docs)
- Import path: `@modelcontextprotocol/sdk/server/streamableHttp.js`
- Import path for McpServer: `@modelcontextprotocol/sdk/server/mcp.js`

## Express 5 + MCP Transport Type Compatibility
- `transport.handleRequest()` expects Node.js `IncomingMessage` and `ServerResponse`
- Express 5 `req`/`res` extend these but TypeScript doesn't see them as compatible
- Must cast: `req as unknown as IncomingMessage`, `res as unknown as ServerResponse`

## Streamable HTTP Session Management
- Use `sessionIdGenerator: () => randomUUID()` for stateful mode
- `onsessioninitialized` callback fires when a new session is created — use it to track transports in a Map
- `transport.onclose` fires on session termination — use it to clean up the Map
- On POST /mcp: check `mcp-session-id` header to reuse or create transport
- GET and DELETE /mcp also need session handling for SSE notifications and session termination

## ChronovaClient Constructor
- `new ChronovaClient(baseUrl, apiKey)` — both string params, no options object
- Defaults from env vars when no args passed

## CRITICAL: One McpServer per Transport (not shared)
- `McpServer.connect(transport)` can only be called ONCE per server instance
- Second call throws: "Already connected to a transport"
- Fix: create a fresh McpServer + ChronovaClient per new session, register tools on each
- Store `{ transport, server }` in the session map, not just the transport
- On session close (`mcpServer.server.onclose`), delete from session map
- This is the official pattern from modelcontextprotocol/servers repo

## Streamable HTTP Accept Header
- Clients MUST send `Accept: application/json, text/event-stream` 
- Without it, transport returns 406 "Not Acceptable"
- This is per the MCP Streamable HTTP spec
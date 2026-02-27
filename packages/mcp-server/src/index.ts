import { createServer as createHttpServer } from 'node:http';
import { BridgeClient } from './bridge.js';
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';

const ipcPort = process.env['TERRASTUDIO_IPC_PORT'];

if (!ipcPort) {
  console.error(
    '[terrastudio-mcp] TERRASTUDIO_IPC_PORT environment variable is not set.\n' +
    'This server must be launched by the TerraStudio desktop app.\n' +
    'Start TerraStudio first, then the MCP server will be launched automatically.'
  );
  process.exit(1);
}

const port = parseInt(ipcPort, 10);
if (isNaN(port) || port <= 0 || port > 65535) {
  console.error(`[terrastudio-mcp] Invalid IPC port: ${ipcPort}`);
  process.exit(1);
}

const bridge = new BridgeClient(port);

/**
 * Start an HTTP server with StreamableHTTP transport for SSE-based MCP access.
 * Tries ports 7777-7800, returns the bound port.
 */
async function startHttpTransport(bridge: BridgeClient): Promise<number> {
  // Map of sessionId -> transport for multi-session support
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const server = createHttpServer(async (req, res) => {
    // Health check endpoint
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
      return;
    }

    if (req.url !== '/mcp' && req.url !== '/') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // Handle session termination (DELETE)
    if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.close();
        sessions.delete(sessionId);
        res.writeHead(200);
        res.end();
      } else {
        res.writeHead(404);
        res.end('Session not found');
      }
      return;
    }

    // Check for existing session
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      // Route to existing session's transport
      sessions.get(sessionId)!.handleRequest(req, res);
      return;
    }

    // New session: only allowed for initialize requests (POST without session ID)
    if (req.method === 'POST' && !sessionId) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Create a new MCP server instance for this session
      const mcpServer = createServer(bridge);
      await mcpServer.connect(transport);

      // Track session after connect (sessionId is set after first handleRequest)
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await transport.handleRequest(req, res);

      // Store session after handling the initialize request
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }
      return;
    }

    // Invalid request
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: invalid or missing session' },
      id: null,
    }));
  });

  // Try ports 7777-7800
  for (let tryPort = 7777; tryPort <= 7800; tryPort++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(tryPort, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      return tryPort;
    } catch {
      // Port in use, try next
    }
  }

  throw new Error('No available port in range 7777-7800');
}

async function main() {
  // Connect to Tauri IPC bridge
  await bridge.connect();
  console.error('[terrastudio-mcp] Connected to IPC bridge');

  // Create and configure MCP server for stdio
  const server = createServer(bridge);

  // Start stdio transport for Claude Desktop / VS Code
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  console.error('[terrastudio-mcp] MCP server ready (stdio transport)');

  // Start HTTP/SSE transport
  try {
    const httpPort = await startHttpTransport(bridge);
    console.error(`[terrastudio-mcp] HTTP transport listening on http://127.0.0.1:${httpPort}/mcp`);

    // Report port to Rust bridge
    bridge.request('mcp_report_http_port', { port: httpPort }).catch(() => {
      // Best-effort — bridge may not handle this command yet
    });
  } catch (err) {
    console.error('[terrastudio-mcp] Failed to start HTTP transport:', err);
    // Non-fatal — stdio still works
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('[terrastudio-mcp] Shutting down...');
  bridge.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[terrastudio-mcp] Shutting down...');
  bridge.close();
  process.exit(0);
});

main().catch((err) => {
  console.error('[terrastudio-mcp] Fatal error:', err);
  bridge.close();
  process.exit(1);
});

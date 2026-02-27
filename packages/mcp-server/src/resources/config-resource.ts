import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';

export function registerConfigResource(server: McpServer, bridge: BridgeClient): void {
  server.resource(
    'terrastudio://project/config',
    'terrastudio://project/config',
    async (uri) => {
      try {
        const result = await bridge.request('mcp_get_project_config');
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: '{}',
          }],
        };
      }
    }
  );
}

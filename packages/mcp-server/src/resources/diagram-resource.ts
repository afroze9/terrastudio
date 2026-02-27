import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';

export function registerDiagramResource(server: McpServer, bridge: BridgeClient): void {
  server.resource(
    'terrastudio://diagram/current',
    'terrastudio://diagram/current',
    async (uri) => {
      const result = await bridge.request('mcp_get_diagram_snapshot');
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';

export function registerHclResources(server: McpServer, bridge: BridgeClient): void {
  // Dynamic resource template for HCL files
  server.resource(
    'terrastudio://hcl/main.tf',
    'terrastudio://hcl/main.tf',
    async (uri) => {
      try {
        const result = await bridge.request('mcp_generate_hcl') as Record<string, string> | null;
        const filename = uri.pathname.split('/').pop() ?? 'main.tf';
        const content = result?.[filename] ?? `// File not generated: ${filename}`;
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: content,
          }],
        };
      } catch {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: '// Error: Could not generate HCL files',
          }],
        };
      }
    }
  );
}

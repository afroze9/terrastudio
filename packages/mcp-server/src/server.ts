import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from './bridge.js';
import { registerQueryTools } from './tools/query-tools.js';
import { registerResourceTools } from './tools/resource-tools.js';
import { registerProjectTools } from './tools/project-tools.js';
import { registerTerraformTools } from './tools/terraform-tools.js';
import { registerDiagramResource } from './resources/diagram-resource.js';
import { registerHclResources } from './resources/hcl-resources.js';
import { registerConfigResource } from './resources/config-resource.js';

export function createServer(bridge: BridgeClient): McpServer {
  const server = new McpServer({
    name: 'terrastudio',
    version: '0.1.0',
  });

  // Register all tools
  registerQueryTools(server, bridge);
  registerResourceTools(server, bridge);
  registerProjectTools(server, bridge);
  registerTerraformTools(server, bridge);

  // Register resources
  registerDiagramResource(server, bridge);
  registerHclResources(server, bridge);
  registerConfigResource(server, bridge);

  return server;
}
